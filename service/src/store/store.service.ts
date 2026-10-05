import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatPhoneDisplay } from '../common/time';
import { GeocodeService } from './geocode.service';
import { StoreSetting } from './store-setting.entity';

export type StorePayload = StoreSetting & {
  phoneDisplay: string;
  geocodeStatus?: 'updated' | 'unchanged' | 'skipped' | 'failed';
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
    private readonly geocode: GeocodeService,
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
    return { ...store, phoneDisplay: formatPhoneDisplay(store.phone) };
  }

  async lookupAddress(address: string) {
    const geo = await this.geocode.fromAddress(address);
    if (geo.ok === false) {
      if (geo.reason === 'no_key') {
        throw new BadRequestException('未配置 TENCENT_MAP_KEY，无法根据地址定位');
      }
      if (geo.reason === 'quota') {
        throw new BadRequestException('腾讯地图今日调用次数已用完，请明天再试或去控制台提高配额');
      }
      throw new BadRequestException('没有解析到这个地址，可在地图上点选位置');
    }
    return { latitude: geo.latitude, longitude: geo.longitude };
  }

  async lookupCoords(latitude: number, longitude: number) {
    const geo = await this.geocode.fromCoords(latitude, longitude);
    if (geo.ok === false) {
      if (geo.reason === 'no_key') {
        throw new BadRequestException('未配置 TENCENT_MAP_KEY，无法根据地图反查地址');
      }
      if (geo.reason === 'quota') {
        throw new BadRequestException('腾讯地图今日调用次数已用完，请明天再试或去控制台提高配额');
      }
      throw new BadRequestException('没有解析到这个位置的地址');
    }
    return { address: geo.address };
  }

  async update(payload: Partial<Omit<StoreSetting, 'id'>>): Promise<StorePayload> {
    const store = await this.ensureDefault();
    if (payload.closedWeekdays) {
      payload.closedWeekdays = [...new Set(payload.closedWeekdays)]
        .map(Number)
        .filter((day) => day >= 0 && day <= 6)
        .sort((a, b) => a - b);
    }
    if (payload.noticeItems) {
      payload.noticeItems = payload.noticeItems.map((item) => item.trim()).filter(Boolean);
    }
    if (payload.successNoticeLines) {
      payload.successNoticeLines = payload.successNoticeLines
        .map((item) => item.trim())
        .filter(Boolean);
    }
    const nextAddress = payload.address?.trim();
    const hasCoords =
      typeof payload.latitude === 'number' && typeof payload.longitude === 'number';
    const addressChanged = Boolean(nextAddress && nextAddress !== store.address);
    let geocodeStatus: StorePayload['geocodeStatus'] = 'unchanged';

    if (!hasCoords && addressChanged && nextAddress) {
      const geo = await this.geocode.fromAddress(nextAddress);
      if (geo.ok === false) {
        geocodeStatus = geo.reason === 'no_key' ? 'skipped' : 'failed';
      } else {
        payload.latitude = geo.latitude;
        payload.longitude = geo.longitude;
        geocodeStatus = 'updated';
      }
    }

    Object.assign(
      store,
      Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)),
    );
    const saved = await this.repo.save(store);
    return {
      ...saved,
      phoneDisplay: formatPhoneDisplay(saved.phone),
      geocodeStatus,
    };
  }
}
