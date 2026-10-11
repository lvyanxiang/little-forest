import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  createHash,
  randomBytes,
  scrypt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { AdminSession } from './admin-session.entity';

const deriveKey = promisify(scrypt);
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly email: string;
  private readonly salt: string;
  private readonly passwordKey: Buffer;
  private readonly credentialVersion: string;
  private readonly attempts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    config: ConfigService,
    @InjectRepository(AdminSession)
    private readonly sessions: Repository<AdminSession>,
  ) {
    this.email = config
      .get<string>('ADMIN_EMAIL', 'lvyanxiang088@gmail.com')
      .trim()
      .toLowerCase();
    const password = config.get<string>('ADMIN_PASSWORD', '19970804');
    if (!this.email || !password)
      throw new Error('ADMIN_EMAIL 和 ADMIN_PASSWORD 不能为空');
    this.salt = `little-forest-admin:${this.email}`;
    this.passwordKey = scryptSync(password, this.salt, 64);
    // Changing the configured credentials invalidates previously issued sessions.
    this.credentialVersion = createHash('sha256')
      .update(this.passwordKey)
      .digest('hex');
  }

  async login(email: string, password: string, clientAddress: string) {
    this.recordAttempt(clientAddress);
    const key = (await deriveKey(password, this.salt, 64)) as Buffer;
    const passwordMatches = timingSafeEqual(key, this.passwordKey);
    if (email.trim().toLowerCase() !== this.email || !passwordMatches) {
      throw new UnauthorizedException('账号或密码错误');
    }
    this.attempts.delete(clientAddress);
    await this.sessions.delete({ expiresAt: LessThanOrEqual(new Date()) });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.sessions.save({
      tokenHash: this.hashToken(token),
      email: this.email,
      credentialVersion: this.credentialVersion,
      expiresAt,
    });
    return { token, email: this.email, expiresAt: expiresAt.toISOString() };
  }

  async authenticate(authorization?: string) {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization || '')?.[1];
    if (!token) throw new UnauthorizedException('请先登录管理后台');
    const session = await this.sessions.findOneBy({
      tokenHash: this.hashToken(token),
      email: this.email,
      credentialVersion: this.credentialVersion,
      expiresAt: MoreThan(new Date()),
    });
    if (!session) throw new UnauthorizedException('登录已过期，请重新登录');
    return session;
  }

  async logout(session: AdminSession) {
    await this.sessions.delete({ tokenHash: session.tokenHash });
    return { ok: true };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private recordAttempt(address: string) {
    const now = Date.now();
    for (const [key, attempt] of this.attempts) {
      if (attempt.resetAt <= now) this.attempts.delete(key);
    }
    let attempt = this.attempts.get(address);
    if (!attempt) {
      if (this.attempts.size >= 1000)
        this.attempts.delete(this.attempts.keys().next().value);
      attempt = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
      this.attempts.set(address, attempt);
    }
    if (attempt.count >= 5) {
      throw new HttpException(
        '登录尝试过多，请 15 分钟后重试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    attempt.count += 1;
  }
}
