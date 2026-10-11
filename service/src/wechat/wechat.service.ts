import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { WechatGateway } from './wechat.gateway';
import { WechatSession } from './wechat-session.entity';
import { WechatUser } from './wechat-user.entity';

export type AvatarUpload = { buffer: Buffer; mimetype: string };

@Injectable()
export class WechatService {
  constructor(
    private readonly gateway: WechatGateway,
    @InjectRepository(WechatUser)
    private readonly users: Repository<WechatUser>,
    @InjectRepository(WechatSession)
    private readonly sessions: Repository<WechatSession>,
  ) {}

  async login(code: string) {
    const openid = await this.gateway.exchangeCode(code);
    await this.users.upsert(
      { openid },
      { conflictPaths: ['openid'], skipUpdateIfNoValuesChanged: true },
    );
    const user = await this.users.findOneByOrFail({ openid });
    await this.sessions.delete({ expiresAt: LessThanOrEqual(new Date()) });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.sessions.save({
      tokenHash: this.hashToken(token),
      userId: user.id,
      expiresAt,
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: await this.profile(user.id),
    };
  }

  async authenticate(authorization?: string) {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization || '')?.[1];
    if (!token) throw new UnauthorizedException('请先微信登录');
    const session = await this.sessions.findOneBy({
      tokenHash: this.hashToken(token),
      expiresAt: MoreThan(new Date()),
    });
    if (!session) throw new UnauthorizedException('微信登录已过期，请重新登录');
    return session;
  }

  async profile(userId: string) {
    const user = await this.users.findOneByOrFail({ id: userId });
    const image = await this.users
      .createQueryBuilder('u')
      .select('u.avatar IS NOT NULL', 'hasAvatar')
      .where('u.id = :id', { id: userId })
      .getRawOne<{ hasAvatar: boolean }>();
    return {
      id: user.id,
      nickname: user.nickname,
      hasAvatar: Boolean(image?.hasAvatar),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateProfile(userId: string, nickname: string, file?: AvatarUpload) {
    const patch: Partial<WechatUser> = { nickname };
    if (file) {
      const mime = this.imageType(file.buffer);
      if (!mime)
        throw new BadRequestException('头像仅支持 JPG、PNG 或 WebP 图片');
      patch.avatar = `data:${mime};base64,${file.buffer.toString('base64')}`;
    }
    await this.users.update({ id: userId }, patch);
    return this.profile(userId);
  }

  async avatar(userId: string) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.avatar')
      .where('u.id = :id', { id: userId })
      .getOne();
    const matched = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(
      user?.avatar || '',
    );
    if (!matched) throw new NotFoundException('尚未设置头像');
    return { mimeType: matched[1], data: Buffer.from(matched[2], 'base64') };
  }

  async logout(session: WechatSession) {
    await this.sessions.delete({ tokenHash: session.tokenHash });
    return { ok: true };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private imageType(data: Buffer) {
    if (
      data.length >= 3 &&
      data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    )
      return 'image/jpeg';
    if (
      data.length >= 8 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
      return 'image/png';
    if (
      data.length >= 12 &&
      data.toString('ascii', 0, 4) === 'RIFF' &&
      data.toString('ascii', 8, 12) === 'WEBP'
    )
      return 'image/webp';
    return null;
  }
}
