import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('admin_sessions')
export class AdminSession {
  @PrimaryColumn({ length: 64 })
  tokenHash: string;

  @Column()
  email: string;

  @Column({ length: 64 })
  credentialVersion: string;

  @Index('IDX_admin_sessions_expires_at')
  @Column('timestamptz')
  expiresAt: Date;
}
