import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WechatGateway {
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
}
