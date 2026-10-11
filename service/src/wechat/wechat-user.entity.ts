import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wechat_users')
export class WechatUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_wechat_users_openid', { unique: true })
  @Column({ length: 128, select: false })
  openid: string;

  @Column({ length: 40, default: '书友' })
  nickname: string;

  @Column('text', { nullable: true, select: false })
  avatar: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
