import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import * as request from 'supertest';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AdminSession } from '../src/auth/admin-session.entity';
import { AuthService } from '../src/auth/auth.service';

// Run against a migrated, isolated test database using DB_* environment variables.
describe('Admin authentication (e2e)', () => {
  let app: INestApplication;
  let sessions: Repository<AdminSession>;
  let email: string;
  let password: string;
  const issuedTokens = new Set<string>();
  const tokenHash = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    sessions = app.get(DataSource).getRepository(AdminSession);
    const config = app.get(ConfigService);
    email = config.get<string>('ADMIN_EMAIL', 'lvyanxiang088@gmail.com');
    password = config.get<string>('ADMIN_PASSWORD', '19970804');
  });

  afterAll(async () => {
    if (sessions && issuedTokens.size) {
      await sessions.delete({
        tokenHash: In([...issuedTokens].map(tokenHash)),
      });
    }
    await app?.close();
  });

  async function login() {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    issuedTokens.add(response.body.token);
    return response.body as { token: string; email: string; expiresAt: string };
  }

  it('keeps public health, store and availability endpoints accessible', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/store').expect(200);
    await request(app.getHttpServer())
      .get('/api/slots?date=2030-01-08')
      .expect(200);
  });

  it('rejects unauthenticated management reads, writes and uploads', async () => {
    const routes = [
      ['get', '/api/admin/store'],
      ['put', '/api/admin/store'],
      ['post', '/api/admin/store/home-image'],
      ['get', '/api/admin/slots'],
      ['post', '/api/admin/slots'],
      ['patch', '/api/admin/slots/reorder'],
      ['patch', '/api/admin/slots/1'],
      ['delete', '/api/admin/slots/1'],
      ['get', '/api/admin/bookings'],
      ['get', '/api/auth/me'],
      ['post', '/api/auth/logout'],
    ] as const;
    for (const [method, route] of routes) {
      await request(app.getHttpServer())[method](route).expect(401);
    }
  });

  it('rejects incorrect credentials and invalid input', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: `${password}-incorrect` })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'wrong@example.test', password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: { invalid: true } })
      .expect(400);
  });

  it('issues a hashed 12-hour session and authorizes management APIs', async () => {
    const session = await login();
    expect(session.email).toBe(email.trim().toLowerCase());
    expect(session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await sessions.findOneByOrFail({
      tokenHash: tokenHash(session.token),
    });
    expect(JSON.stringify(row)).not.toContain(session.token);
    const duration = new Date(session.expiresAt).getTime() - Date.now();
    expect(duration).toBeGreaterThan(11.9 * 60 * 60 * 1000);
    expect(duration).toBeLessThanOrEqual(12 * 60 * 60 * 1000);
    for (const route of [
      '/api/admin/store',
      '/api/admin/slots',
      '/api/admin/bookings',
    ]) {
      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200)
        .expect('Cache-Control', 'no-store');
    }
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${session.token}`)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toEqual({
            email: session.email,
            expiresAt: session.expiresAt,
          }),
        );
    }
    await request(app.getHttpServer())
      .post('/api/admin/store/home-image')
      .set('Authorization', `Bearer ${session.token}`)
      .expect(400);
  });

  it('rejects forged, expired and revoked sessions', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/store')
      .set('Authorization', `Bearer ${'a'.repeat(43)}`)
      .expect(401);
    const expired = await login();
    await sessions.update(
      { tokenHash: tokenHash(expired.token) },
      { expiresAt: new Date(0) },
    );
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expired.token}`)
      .expect(401);
    const active = await login();
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${active.token}`)
      .expect(201);
    expect(
      await sessions.findOneBy({ tokenHash: tokenHash(active.token) }),
    ).toBeNull();
    await request(app.getHttpServer())
      .get('/api/admin/bookings')
      .set('Authorization', `Bearer ${active.token}`)
      .expect(401);
  });

  it('preserves sessions on restart and invalidates them when credentials change', async () => {
    const session = await login();
    const sameCredentials = new AuthService(
      new ConfigService({ ADMIN_EMAIL: email, ADMIN_PASSWORD: password }),
      sessions,
    );
    expect(
      (await sameCredentials.authenticate(`Bearer ${session.token}`)).email,
    ).toBe(session.email);
    const changedCredentials = new AuthService(
      new ConfigService({
        ADMIN_EMAIL: email,
        ADMIN_PASSWORD: `${password}-changed`,
      }),
      sessions,
    );
    await expect(
      changedCredentials.authenticate(`Bearer ${session.token}`),
    ).rejects.toThrow('登录已过期');
  });

  it('limits repeated failed login attempts', async () => {
    await login();
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: `${password}-incorrect` })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: `${password}-incorrect` })
      .expect(429);
  });
});
