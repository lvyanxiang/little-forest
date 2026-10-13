import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('store_settings')
export class StoreSetting {
  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column('float')
  latitude: number;

  @Column('float')
  longitude: number;

  @Column()
  phone: string;

  @Column()
  hours: string;

  @Column('simple-json')
  closedWeekdays: number[];

  @Column()
  noticeHeading: string;

  @Column('simple-json')
  noticeItems: string[];

  @Column()
  noticeFoot: string;

  @Column('text')
  homeNoticeText: string;

  @Column('text')
  homeHeroText: string;

  @Column('text', { nullable: true, select: false })
  homeHeroImage: string | null;

  @Column('simple-json')
  successNoticeLines: string[];

  @Column('integer', { default: 0 })
  quickDateDays: number;

  @Column('integer', { default: 0 })
  bookingAdvanceDays: number;

  @Column('jsonb', { default: {} })
  uiText: Record<string, string>;

  @Column('text', { nullable: true, select: false })
  brandLogoImage: string | null;
}
