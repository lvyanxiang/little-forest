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

  @Column('text', { default: '讀著書\n一輩子很快就過去了\n去讀書吧\n讀一句\n便經歷一句' })
  homeHeroText: string;

  @Column('text', { nullable: true, select: false })
  homeHeroImage: string | null;

  @Column('simple-json')
  successNoticeLines: string[];
}
