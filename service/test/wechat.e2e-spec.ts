import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as request from 'supertest';
import { DataSource, In } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Booking } from '../src/bookings/booking.entity';
import { WechatGateway } from '../src/wechat/wechat.gateway';
import { WechatSession } from '../src/wechat/wechat-session.entity';
import { WechatUser } from '../src/wechat/wechat-user.entity';
import { TimeSlot } from '../src/slots/time-slot.entity';
import { StoreService } from '../src/store/store.service';
import { toDateKey } from '../src/common/time';

// The WeChat exchange alone is mocked. Sessions, profiles and bookings use PostgreSQL.
describe('WeChat users and booking ownership (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let adminToken: string;
  let userA: { token: string; user: { id: string } };
  let userB: typeof userA;
  const suffix = randomUUID();
  const createdBookings: string[] = [];
  let testSlot: TimeSlot;
  let visitDate: string;
  const hash = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WechatGateway)
      .useValue({
        exchangePhoneCode: jest.fn(async (code: string) => {
          if (code !== 'authorized-phone-code') throw new UnauthorizedException('未授权手机号');
          return { phoneNumber: '13800000000' };
        }),
        exchangeCode: async (code: string) => {
          if (!['user-a', 'user-b'].includes(code))
            throw new UnauthorizedException('微信登录凭证已过期');
          return `test-openid-${suffix}-${code}`;
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    db = app.get(DataSource);
    const config = app.get(ConfigService);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: config.get('ADMIN_EMAIL', 'lvyanxiang088@gmail.com'),
        password: config.get('ADMIN_PASSWORD', '19970804'),
      })
      .expect(201);
    adminToken = login.body.token;
    userA = (
      await request(app.getHttpServer())
        .post('/api/wechat/login')
        .send({ code: 'user-a' })
        .expect(201)
    ).body;
    userB = (
      await request(app.getHttpServer())
        .post('/api/wechat/login')
        .send({ code: 'user-b' })
        .expect(201)
    ).body;
  });

  afterAll(async () => {
    if (db?.isInitialized) {
      if (createdBookings.length)
        await db.getRepository(Booking).delete({ id: In(createdBookings) });
      if (testSlot) await db.getRepository(TimeSlot).delete({ id: testSlot.id });
      if (userA && userB)
        await db
          .getRepository(WechatUser)
          .delete({ id: In([userA.user.id, userB.user.id]) });
      if (adminToken)
        await request(app.getHttpServer())
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${adminToken}`);
    }
    await app?.close();
  });

  it('returns only settings used by the mini program', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/store')
      .expect(200);
    expect(Object.keys(response.body).sort()).toEqual(
      [
        'id',
        'name',
        'quickDateDays',
        'bookingAdvanceDays',
        'uiText',
        'uiTextLabels',
        'brandLogoUrl',
        'address',
        'closedWeekdays',
        'noticeHeading',
        'noticeItems',
        'noticeFoot',
        'homeHeroText',
        'homeHeroImageUrl',
        'successNoticeLines',
      ].sort(),
    );
  });

  it('rejects unauthenticated bookings and separates administrator and user sessions', async () => {
    await request(app.getHttpServer())
      .get('/api/bookings?clientId=somebody-else')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/bookings')
      .send({ clientId: 'forged-client' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/wechat/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/bookings')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/wechat/login')
      .send({ code: 'invalid' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/wechat/login')
      .send({ code: 123 })
      .expect(400);
  });

  it('keeps the same user across logins and never exposes OpenID or session keys', async () => {
    const next = await request(app.getHttpServer())
      .post('/api/wechat/login')
      .send({ code: 'user-a' })
      .expect(201);
    expect(next.body.user.id).toBe(userA.user.id);
    expect(JSON.stringify(next.body)).not.toMatch(
      /openid|session_key|app_secret/i,
    );
    const session = await db
      .getRepository(WechatSession)
      .findOneByOrFail({ tokenHash: hash(next.body.token) });
    expect(session.userId).toBe(userA.user.id);
    expect(JSON.stringify(session)).not.toContain(next.body.token);
  });

  it('requires a user session and a valid authorization code to retrieve a phone number', async () => {
    const gateway = app.get(WechatGateway);
    await request(app.getHttpServer()).post('/api/wechat/phone-number')
      .send({ code: 'authorized-phone-code' }).expect(401);
    await request(app.getHttpServer()).post('/api/wechat/phone-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'authorized-phone-code' }).expect(401);
    await request(app.getHttpServer()).post('/api/wechat/phone-number')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ code: '' }).expect(400);
    expect(gateway.exchangePhoneCode).not.toHaveBeenCalled();
    await request(app.getHttpServer()).post('/api/wechat/phone-number')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ code: 'authorized-phone-code', phoneNumber: 'fake-client-number' })
      .expect(201).expect('Cache-Control', 'no-store')
      .expect(({ body }) => expect(body).toEqual({ phoneNumber: '13800000000' }));
    expect(gateway.exchangePhoneCode).toHaveBeenCalledWith('authorized-phone-code');
  });

  it('saves nickname and a private avatar and preserves them on the next login', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP9sAAAAASUVORK5CYII=',
      'base64',
    );
    await request(app.getHttpServer())
      .post('/api/wechat/profile')
      .set('Authorization', `Bearer ${userA.token}`)
      .field('nickname', '小森林书友')
      .attach('avatar', png, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.nickname).toBe('小森林书友');
        expect(body.hasAvatar).toBe(true);
      });
    await request(app.getHttpServer()).get('/api/wechat/avatar').expect(401);
    await request(app.getHttpServer())
      .get('/api/wechat/avatar')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200)
      .expect('Content-Type', /image\/png/)
      .expect(({ body }) => expect(body).toEqual(png));
    await request(app.getHttpServer())
      .get('/api/wechat/avatar')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/wechat/profile')
      .set('Authorization', `Bearer ${userA.token}`)
      .field('nickname', '书友')
      .attach('avatar', Buffer.from('<svg>bad</svg>'), {
        filename: 'bad.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/wechat/profile')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ nickname: '   ' })
      .expect(400);
    const login = await request(app.getHttpServer())
      .post('/api/wechat/login')
      .send({ code: 'user-a' })
      .expect(201);
    expect(login.body.user).toMatchObject({
      nickname: '小森林书友',
      hasAvatar: true,
    });
  });

  it('binds bookings to the server-verified user and rejects cross-account cancellation', async () => {
    // Do not depend on the operator's first slot being active or a fixed day being open.
    const store = await app.get(StoreService).getPublic();
    const day = new Date();
    day.setDate(day.getDate() + 1);
    for (let i = 0; i < 7 && store.closedWeekdays.includes(day.getDay()); i++)
      day.setDate(day.getDate() + 1);
    visitDate = toDateKey(day.getTime());
    testSlot = await db.getRepository(TimeSlot).save({
      startTime: '14:00', endTime: '15:30', maxCapacity: 8,
      sortOrder: 9999, isActive: true,
    });
    const response = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        visitDate,
        slotId: testSlot.id,
        name: '测试书友',
        phone: '13800000000',
        people: 1,
        clientId: 'forged-client',
        userId: userB.user.id,
      })
      .expect(201);
    createdBookings.push(response.body.id);
    expect(
      (
        await db
          .getRepository(Booking)
          .findOneByOrFail({ id: response.body.id })
      ).userId,
    ).toBe(userA.user.id);
    const own = await request(app.getHttpServer())
      .get(`/api/bookings?clientId=forged-client&userId=${userB.user.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);
    expect(
      own.body.some((row: { id: string }) => row.id === response.body.id),
    ).toBe(true);
    const other = await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(200);
    expect(other.body).toEqual([]);
    await request(app.getHttpServer())
      .post(`/api/bookings/${response.body.id}/cancel`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ userId: userA.user.id })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/bookings/${response.body.id}/cancel`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('cancelled'));
  });

  it('persists avatar-only changes and returns the replacement on the next login', async () => {
    const image = readFileSync(resolve(__dirname, '../../weapp/miniprogram/assets/home-reading.jpg'));
    await request(app.getHttpServer()).post('/api/wechat/profile')
      .set('Authorization', `Bearer ${userA.token}`)
      .attach('avatar', image, { filename: 'new-avatar.jpg', contentType: 'image/jpeg' })
      .expect(201).expect(({ body }) => expect(body).toMatchObject({ nickname: '小森林书友', hasAvatar: true }));
    await request(app.getHttpServer()).get('/api/wechat/avatar')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200).expect('Cache-Control', 'no-store')
      .expect(({ body }) => expect(body).toEqual(image));
    const login = await request(app.getHttpServer()).post('/api/wechat/login').send({ code: 'user-a' }).expect(201);
    expect(login.body.user).toMatchObject({ nickname: '小森林书友', hasAvatar: true });
    await request(app.getHttpServer()).get('/api/wechat/avatar')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200).expect(({ body }) => expect(body).toEqual(image));
    await request(app.getHttpServer()).post('/api/wechat/profile')
      .set('Authorization', `Bearer ${userA.token}`).send({}).expect(400);
    await request(app.getHttpServer()).post('/api/wechat/profile')
      .set('Authorization', `Bearer ${userA.token}`).send({ nickname: null }).expect(400);
  });

  it('preserves anonymous history in admin without allowing client IDs to claim it', async () => {
    const legacy = await db.getRepository(Booking).save({
      clientId: `legacy-${suffix}`,
      userId: null,
      visitDate: '2030-01-08',
      slotId: 1,
      slotLabel: '14:00 – 15:30',
      startTime: '14:00',
      endTime: '15:30',
      name: '历史匿名书友',
      phone: '13800000000',
      people: 1,
      status: 'confirmed',
    });
    createdBookings.push(legacy.id);
    const mine = await request(app.getHttpServer())
      .get(`/api/bookings?clientId=${legacy.clientId}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);
    expect(mine.body.some((row: { id: string }) => row.id === legacy.id)).toBe(
      false,
    );
    await request(app.getHttpServer())
      .post(`/api/bookings/${legacy.id}/cancel`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(403);
    const admin = await request(app.getHttpServer())
      .get('/api/admin/bookings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(admin.body.some((row: { id: string }) => row.id === legacy.id)).toBe(
      true,
    );
  });

  it('enforces the configured booking horizon on both availability and booking submission', async () => {
    const store = await app.get(StoreService).getPublic();
    const day = new Date();
    day.setDate(day.getDate() + store.bookingAdvanceDays + 1);
    const date = toDateKey(day.getTime());
    await request(app.getHttpServer()).get(`/api/slots?date=${date}`).expect(400)
      .expect(({ body }) => expect(body.message).toContain('可预约范围'));
    await request(app.getHttpServer()).post('/api/bookings')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ visitDate: date, slotId: testSlot.id, name: '测试', phone: '13800000000', people: 1 })
      .expect(400).expect(({ body }) => expect(body.message).toContain('可预约范围'));
    await request(app.getHttpServer()).put('/api/admin/store')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uiText: { unknownKey: 'Do not accept unknown keys' } }).expect(400);
  });

  it('rejects expired and logged-out WeChat sessions', async () => {
    await request(app.getHttpServer())
      .post('/api/wechat/logout')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/wechat/me')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(401);
    await db
      .getRepository(WechatSession)
      .update({ tokenHash: hash(userA.token) }, { expiresAt: new Date(0) });
    await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(401);
  });
});
