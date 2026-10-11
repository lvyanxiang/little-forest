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
    const mock = jest
      .fn()
      .mockResolvedValue({
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
});
