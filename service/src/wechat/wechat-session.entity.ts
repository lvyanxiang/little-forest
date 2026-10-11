import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { WechatUser } from './wechat-user.entity';

@Entity('wechat_sessions')
export class WechatSession {
  @PrimaryColumn({ length: 64 })
  tokenHash: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => WechatUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: WechatUser;

  @Index('IDX_wechat_sessions_expires_at')
  @Column('timestamptz')
  expiresAt: Date;
}
