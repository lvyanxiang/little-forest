import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSetting } from './store-setting.entity';
import type { UpdateStoreDto } from './dto/update-store.dto';

export type StorePayload = Pick<
  StoreSetting,
  | 'id'
  | 'address'
  | 'closedWeekdays'
  | 'noticeHeading'
  | 'noticeItems'
  | 'noticeFoot'
  | 'homeHeroText'
  | 'successNoticeLines'
> & {
  homeHeroImageUrl: string;
};

export type HomeHeroUpload = {
  mimetype: string;
  buffer: Buffer;
};

const DEFAULT_STORE: Omit<StoreSetting, 'id'> = {
  name: '小森林书店',
  address: '上海市长宁区延安西路1221号泛太大厦2号楼1层底商',
  latitude: 31.22048,
  longitude: 121.42516,
  phone: '18017251036',
  hours: '周二至周日 14:00 – 21:00（周一闭馆）',
  closedWeekdays: [1],
  noticeHeading: '小森林庇护所注意事项',
  noticeItems: [
    '我们是自助无人值守空间，不是绝对安静的自习室，不习惯有白噪音的客人请慎入。',
    '空间内难免有讨论、走动、音乐播放、键盘敲击等声音，无法做到图书馆一样的安静，请务必慎入。',
    '阅读完的书请放回书架。',
    '椅子多是欧洲中古家具或设计师家具，请务必爱护。',
    '离开时请关掉台灯，垃圾请丢到水台旁红色大垃圾桶。',
    '水杯可放在水池内，志愿者会定时清洗消毒。',
    '纯净水（冰、热）在水台旁，可自取。',
    'Wi-Fi 名称：377film　密码：xiaosenlinlin',
    '意见或建议请到小红书私信「小森林」，我们会及时回复。',
  ],
  noticeFoot: '请和我们一样，爱护爱惜这个空间。谢谢。',
  homeNoticeText:
    '自助无人值守，不是绝对安静的自习室，店内可能有交谈、音乐与走动，请先确认是否适合，书看完请放回书架，离开时关台灯、垃圾入桶',
  homeHeroText: '讀著書\n一輩子很快就過去了\n去讀書吧\n讀一句\n便經歷一句',
  homeHeroImage: null,
  successNoticeLines: [
    'Wi-Fi：377film　密码 xiaosenlinlin',
    '书看完请放回书架，离开时关掉台灯',
    '垃圾请丢到水台旁红色大垃圾桶',
  ],
};

@Injectable()
export class StoreService implements OnModuleInit {
  constructor(
    @InjectRepository(StoreSetting)
    private readonly repo: Repository<StoreSetting>,
  ) {}

  async onModuleInit() {
    await this.ensureDefault();
  }

  async ensureDefault() {
    const exists = await this.repo.findOne({ where: { id: 1 } });
    if (exists) return exists;
    return this.repo.save(this.repo.create({ id: 1, ...DEFAULT_STORE }));
  }

  async getPublic(): Promise<StorePayload> {
    const store = await this.ensureDefault();
    const imageState = await this.repo
      .createQueryBuilder('store')
      .select('store.homeHeroImage IS NOT NULL', 'hasImage')
      .where('store.id = :id', { id: 1 })
      .getRawOne<{ hasImage: boolean }>();
    return this.toPayload(store, {
      homeHeroImageUrl: imageState?.hasImage ? '/api/store/home-image' : '',
    });
  }

  private toPayload(
    store: StoreSetting,
    extra: Partial<StorePayload> = {},
  ): StorePayload {
    return {
      id: store.id,
      address: store.address,
      closedWeekdays: store.closedWeekdays,
      noticeHeading: store.noticeHeading,
      noticeItems: store.noticeItems,
      noticeFoot: store.noticeFoot,
      homeHeroText: store.homeHeroText,
      successNoticeLines: store.successNoticeLines,
      homeHeroImageUrl: store.homeHeroImage ? '/api/store/home-image' : '',
      ...extra,
    };
  }

  async getHomeHeroImage() {
    const store = await this.repo
      .createQueryBuilder('store')
      .addSelect('store.homeHeroImage')
      .where('store.id = :id', { id: 1 })
      .getOne();
    const value = store?.homeHeroImage || '';
    const matched = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(value);
    if (!matched) return null;
    return { mimeType: matched[1], data: Buffer.from(matched[2], 'base64') };
  }

  async updateHomeHeroImage(file: HomeHeroUpload): Promise<StorePayload> {
    const store = await this.repo
      .createQueryBuilder('store')
      .addSelect('store.homeHeroImage')
      .where('store.id = :id', { id: 1 })
      .getOne();
    const target = store || (await this.ensureDefault());
    target.homeHeroImage = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.toPayload(await this.repo.save(target));
  }

  async update(payload: UpdateStoreDto): Promise<StorePayload> {
    const store = await this.ensureDefault();
    if (payload.closedWeekdays) {
      payload.closedWeekdays = [...new Set(payload.closedWeekdays)]
        .map(Number)
        .filter((day) => day >= 0 && day <= 6)
        .sort((a, b) => a - b);
    }
    if (payload.noticeItems) {
      payload.noticeItems = payload.noticeItems
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (payload.successNoticeLines) {
      payload.successNoticeLines = payload.successNoticeLines
        .map((item) => item.trim())
        .filter(Boolean);
    }
    Object.assign(
      store,
      Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined),
      ),
    );
    const saved = await this.repo.save(store);
    return this.toPayload(saved);
  }
}
