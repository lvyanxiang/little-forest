import { ConfigService } from '@nestjs/config';
import { WechatGateway } from './wechat.gateway';

describe('WeChat code exchange', () => {
  const originalFetch = global.fetch;
  const gateway = () =>
    new WechatGateway(
      new ConfigService({
        WECHAT_APPID: 'test-appid',
        WECHAT_APP_SECRET: 'test-secret',
      }),
    );
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requires server credentials before calling WeChat', async () => {
    global.fetch = jest.fn();
    await expect(
      new WechatGateway(
        new ConfigService({ WECHAT_APPID: '', WECHAT_APP_SECRET: '' }),
      ).exchangeCode('code'),
    ).rejects.toThrow('暂未配置');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('exchanges the login code but keeps the WeChat session key private', async () => {
    const mock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        openid: 'user-openid',
        session_key: 'private-wechat-key',
      }),
    });
    global.fetch = mock;
    expect(await gateway().exchangeCode('one-time-code')).toBe('user-openid');
    const url = new URL(mock.mock.calls[0][0]);
    expect(url.origin).toBe('https://api.weixin.qq.com');
    expect(url.searchParams.get('appid')).toBe('test-appid');
    expect(url.searchParams.get('secret')).toBe('test-secret');
    expect(url.searchParams.get('js_code')).toBe('one-time-code');
    expect(url.searchParams.get('grant_type')).toBe('authorization_code');
  });

  it('handles invalid codes and hides upstream request details', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ errcode: 40029 }) });
    await expect(gateway().exchangeCode('expired-code')).rejects.toThrow(
      '凭证已过期',
    );
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('https://api.weixin.qq.com?secret=private'));
    await expect(gateway().exchangeCode('code')).rejects.toThrow(
      '服务暂时不可用',
    );
  });

  const response = (data: unknown) => ({ ok: true, json: async () => data });
  const phoneResponse = () => ({
    errcode: 0,
    phone_info: {
      purePhoneNumber: '13800000000',
      countryCode: '86',
      watermark: { appid: 'test-appid' },
    },
  });

  it('exchanges phone authorization codes and caches server-only access tokens', async () => {
    const mock = jest
      .fn()
      .mockResolvedValueOnce(
        response({ access_token: 'private-access-token', expires_in: 7200 }),
      )
      .mockResolvedValue(response(phoneResponse()));
    global.fetch = mock;
    const instance = gateway();
    expect(await instance.exchangePhoneCode('phone-code-1')).toEqual({
      phoneNumber: '13800000000',
    });
    expect(await instance.exchangePhoneCode('phone-code-2')).toEqual({
      phoneNumber: '13800000000',
    });
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock.mock.calls[0][0]).toBe(
      'https://api.weixin.qq.com/cgi-bin/stable_token',
    );
    expect(JSON.parse(mock.mock.calls[0][1].body)).toMatchObject({
      appid: 'test-appid',
      secret: 'test-secret',
      force_refresh: false,
    });
    expect(JSON.parse(mock.mock.calls[1][1].body)).toEqual({
      code: 'phone-code-1',
    });
    expect(
      new URL(mock.mock.calls[1][0]).searchParams.get('access_token'),
    ).toBe('private-access-token');
  });

  it('refreshes an invalid token once without exposing it to the client', async () => {
    const mock = jest
      .fn()
      .mockResolvedValueOnce(
        response({ access_token: 'old-token', expires_in: 7200 }),
      )
      .mockResolvedValueOnce(response({ errcode: 40001 }))
      .mockResolvedValueOnce(
        response({ access_token: 'new-token', expires_in: 7200 }),
      )
      .mockResolvedValueOnce(response(phoneResponse()));
    global.fetch = mock;
    expect(await gateway().exchangePhoneCode('phone-code')).toEqual({
      phoneNumber: '13800000000',
    });
    expect(mock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(mock.mock.calls[2][1].body).force_refresh).toBe(true);
  });

  it('does not invalidate the login session for an expired phone authorization', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        response({ access_token: 'token', expires_in: 7200 }),
      )
      .mockResolvedValueOnce(response({ errcode: 40029 }));
    await expect(
      gateway().exchangePhoneCode('expired-code'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects another app watermark and unsupported phone numbers', async () => {
    const wrongApp = phoneResponse();
    wrongApp.phone_info.watermark.appid = 'other-appid';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        response({ access_token: 'token', expires_in: 7200 }),
      )
      .mockResolvedValueOnce(response(wrongApp));
    await expect(gateway().exchangePhoneCode('code')).rejects.toThrow(
      '暂不可用',
    );
    const foreignPhone = phoneResponse();
    foreignPhone.phone_info.countryCode = '1';
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        response({ access_token: 'token', expires_in: 7200 }),
      )
      .mockResolvedValueOnce(response(foreignPhone));
    await expect(gateway().exchangePhoneCode('code')).rejects.toThrow(
      '中国大陆手机号',
    );
  });

  it('handles missing permissions and hides upstream credentials on failures', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        response({ access_token: 'token', expires_in: 7200 }),
      )
      .mockResolvedValueOnce(response({ errcode: 48001 }));
    await expect(gateway().exchangePhoneCode('code')).rejects.toThrow(
      '尚未开通',
    );
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('secret=private&access_token=private'));
    await expect(gateway().exchangePhoneCode('code')).rejects.toThrow(
      '微信手机号暂不可用，请手动填写',
    );
  });
});
