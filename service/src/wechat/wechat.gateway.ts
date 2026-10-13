import {
  BadRequestException,
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WechatGateway {
  private phoneAccessToken: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;
  constructor(private readonly config: ConfigService) {}

  async exchangeCode(code: string): Promise<string> {
    const appid = this.config.get<string>('WECHAT_APPID');
    const secret = this.config.get<string>('WECHAT_APP_SECRET');
    if (!appid || !secret) {
      throw new ServiceUnavailableException(
        '微信登录暂未配置，请联系书店管理员',
      );
    }
    const parameters = new URLSearchParams({
      appid,
      secret,
      js_code: code,
      grant_type: 'authorization_code',
    });
    let result: { openid?: string; errcode?: number };
    try {
      const response = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?${parameters}`,
        {
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) throw new Error('WeChat service unavailable');
      result = (await response.json()) as typeof result;
    } catch {
      throw new BadGatewayException('微信登录服务暂时不可用，请稍后重试');
    }
    if (result.errcode === 40029 || result.errcode === 40163) {
      throw new UnauthorizedException('微信登录凭证已过期，请重新登录');
    }
    if (result.errcode || !result.openid) {
      throw new BadGatewayException('微信登录失败，请稍后重试或联系管理员');
    }
    // Never forward session_key, app secret or OpenID to the mini program.
    return result.openid;
  }

  async exchangePhoneCode(code: string): Promise<{ phoneNumber: string }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.accessToken(attempt > 0);
      const result = await this.wechatJson(
        `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token)}`,
        { code },
      );
      if ([40001, 40014, 42001].includes(result.errcode) && attempt === 0) {
        this.phoneAccessToken = null;
        continue;
      }
      if (result.errcode === 40029 || result.errcode === 40163)
        throw new BadRequestException('手机号授权已过期，请重新授权或手动填写');
      if (result.errcode === 48001)
        throw new ServiceUnavailableException(
          '微信手机号能力尚未开通，请手动填写',
        );
      const info = result.phone_info;
      if (
        result.errcode ||
        info?.watermark?.appid !== this.config.get<string>('WECHAT_APPID')
      )
        throw new BadGatewayException('微信手机号暂不可用，请手动填写');
      if (
        String(info.countryCode) !== '86' ||
        typeof info.purePhoneNumber !== 'string' ||
        !/^1\d{10}$/.test(info.purePhoneNumber)
      )
        throw new BadRequestException('暂仅支持中国大陆手机号，请手动填写');
      return { phoneNumber: info.purePhoneNumber };
    }
    throw new BadGatewayException('微信手机号暂不可用，请手动填写');
  }

  private async accessToken(forceRefresh = false): Promise<string> {
    if (
      !forceRefresh &&
      this.phoneAccessToken &&
      this.phoneAccessToken.expiresAt > Date.now()
    )
      return this.phoneAccessToken.value;
    if (this.tokenRequest) return this.tokenRequest;
    const appid = this.config.get<string>('WECHAT_APPID');
    const secret = this.config.get<string>('WECHAT_APP_SECRET');
    if (!appid || !secret)
      throw new ServiceUnavailableException('微信手机号暂未配置，请手动填写');
    const task = this.wechatJson(
      'https://api.weixin.qq.com/cgi-bin/stable_token',
      {
        grant_type: 'client_credential',
        appid,
        secret,
        force_refresh: forceRefresh,
      },
    ).then((result) => {
      if (
        result.errcode ||
        typeof result.access_token !== 'string' ||
        !result.access_token ||
        !Number.isFinite(result.expires_in) ||
        result.expires_in <= 0
      )
        throw new BadGatewayException('微信手机号暂不可用，请手动填写');
      this.phoneAccessToken = {
        value: result.access_token,
        expiresAt: Date.now() + Math.max(0, result.expires_in - 120) * 1000,
      };
      return result.access_token as string;
    });
    this.tokenRequest = task;
    try {
      return await task;
    } finally {
      if (this.tokenRequest === task) this.tokenRequest = null;
    }
  }

  private async wechatJson(
    url: string,
    body: Record<string, unknown>,
  ): Promise<{
    errcode?: number;
    access_token?: string;
    expires_in?: number;
    phone_info?: {
      purePhoneNumber: string;
      countryCode: string;
      watermark?: { appid: string };
    };
  }> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('WeChat service unavailable');
      const result = await response.json();
      if (!result || typeof result !== 'object')
        throw new Error('Invalid WeChat response');
      return result;
    } catch {
      // Do not expose credentials, upstream URLs or access tokens in errors.
      throw new BadGatewayException('微信手机号暂不可用，请手动填写');
    }
  }
}
