import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import * as request from 'supertest';
import { Repository } from 'typeorm';
import { WechatAuthGuard } from './wechat-auth.guard';
import { WechatController } from './wechat.controller';
import { WechatGateway } from './wechat.gateway';
import { WechatService } from './wechat.service';
import { WechatSession } from './wechat-session.entity';
import { WechatUser } from './wechat-user.entity';

// Exercise the real guard, controller, DTO validation and service with isolated session storage.
describe('WeChat phone authorization endpoint', () => {
  let app: INestApplication;
  let sessionExpiresAt: Date;
  const token = 'a'.repeat(43);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const exchangePhoneCode = jest.fn();

  beforeAll(async () => {
    const gateway = { exchangePhoneCode } as unknown as WechatGateway;
    const sessions = {
      findOneBy: async (query: {
        tokenHash: string;
        expiresAt: { value: Date };
      }) =>
        query.tokenHash === tokenHash &&
        sessionExpiresAt > query.expiresAt.value
          ? { tokenHash, userId: 'user-a', expiresAt: sessionExpiresAt }
          : null,
    } as unknown as Repository<WechatSession>;
    const service = new WechatService(
      gateway,
      {} as Repository<WechatUser>,
      sessions,
    );
    const module = await Test.createTestingModule({
      controllers: [WechatController],
      providers: [
        WechatAuthGuard,
        { provide: WechatService, useValue: service },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    sessionExpiresAt = new Date(Date.now() + 60000);
    exchangePhoneCode.mockReset();
    exchangePhoneCode.mockResolvedValue({ phoneNumber: '13800000000' });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('does not call WeChat for missing or unrelated sessions', async () => {
    await request(app.getHttpServer())
      .post('/api/wechat/phone-number')
      .send({ code: 'phone-code' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/wechat/phone-number')
      .set('Authorization', `Bearer ${'b'.repeat(43)}`)
      .send({ code: 'phone-code' })
      .expect(401);
    expect(exchangePhoneCode).not.toHaveBeenCalled();
  });

  it('does not call WeChat for an expired session', async () => {
    sessionExpiresAt = new Date(0);
    await request(app.getHttpServer())
      .post('/api/wechat/phone-number')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'phone-code' })
      .expect(401);
    expect(exchangePhoneCode).not.toHaveBeenCalled();
  });

  it('validates the authorization code before requesting a phone number', async () => {
    for (const code of ['', 123, 'x'.repeat(513)]) {
      await request(app.getHttpServer())
        .post('/api/wechat/phone-number')
        .set('Authorization', `Bearer ${token}`)
        .send({ code })
        .expect(400);
    }
    expect(exchangePhoneCode).not.toHaveBeenCalled();
  });

  it('returns the WeChat-authorized number with no-cache headers and ignores client-supplied numbers', async () => {
    await request(app.getHttpServer())
      .post('/api/wechat/phone-number')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'phone-code', phoneNumber: 'fake-number' })
      .expect(201)
      .expect('Cache-Control', 'no-store')
      .expect(({ body }) =>
        expect(body).toEqual({ phoneNumber: '13800000000' }),
      );
    expect(exchangePhoneCode).toHaveBeenCalledWith('phone-code');
  });
});
