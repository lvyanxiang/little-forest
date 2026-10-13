import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MINI_PROGRAM_TEXT_LABELS } from './mini-program-text';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreSetting } from './store-setting.entity';
import type { UpdateStoreDto } from './dto/update-store.dto';
import { todayKey, toDateKey } from '../common/time';

export type StorePayload = Pick<
  StoreSetting,
  | 'id'
  | 'name'
  | 'quickDateDays'
  | 'bookingAdvanceDays'
  | 'uiText'
  | 'address'
  | 'closedWeekdays'
  | 'noticeHeading'
  | 'noticeItems'
  | 'noticeFoot'
  | 'homeHeroText'
  | 'successNoticeLines'
> & {
  homeHeroImageUrl: string;
  brandLogoUrl: string;
  uiTextLabels: Record<string, string>;
};

export type HomeHeroUpload = {
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(StoreSetting)
    private readonly repo: Repository<StoreSetting>,
  ) {}

  async ensureConfigured() {
    const store = await this.repo.findOne({ where: { id: 1 } });
    if (
      !store ||
      store.quickDateDays < 1 ||
      store.bookingAdvanceDays < 1 ||
      Object.keys(MINI_PROGRAM_TEXT_LABELS).some(
        (key) =>
          typeof store.uiText?.[key] !== 'string' || !store.uiText[key].trim(),
      )
    ) {
      throw new ServiceUnavailableException('门店配置尚未就绪，请稍后重试');
    }
    return store;
  }

  async getPublic(): Promise<StorePayload> {
    const store = await this.ensureConfigured();
    const imageState = await this.repo
      .createQueryBuilder('store')
      .select('store.homeHeroImage IS NOT NULL', 'hasImage')
      .addSelect('store.brandLogoImage IS NOT NULL', 'hasLogo')
      .where('store.id = :id', { id: 1 })
      .getRawOne<{ hasImage: boolean; hasLogo: boolean }>();
    return this.toPayload(store, {
      homeHeroImageUrl: imageState?.hasImage ? '/api/store/home-image' : '',
      brandLogoUrl: imageState?.hasLogo ? '/api/store/brand-image' : '',
    });
  }

  assertBookingDate(date: string, advanceDays: number) {
    const [year, month, day] = date.split('-').map(Number);
    const value = new Date(year, month - 1, day);
    const max = new Date();
    max.setDate(max.getDate() + advanceDays);
    if (
      toDateKey(value.getTime()) !== date ||
      date < todayKey() ||
      date > toDateKey(max.getTime())
    )
      throw new BadRequestException('日期不在可预约范围内，请重新选择');
  }

  private toPayload(
    store: StoreSetting,
    extra: Partial<StorePayload> = {},
  ): StorePayload {
    return {
      id: store.id,
      name: store.name,
      quickDateDays: store.quickDateDays,
      bookingAdvanceDays: store.bookingAdvanceDays,
      uiText: store.uiText,
      uiTextLabels: MINI_PROGRAM_TEXT_LABELS,
      brandLogoUrl: store.brandLogoImage ? '/api/store/brand-image' : '',
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

  async getHomeHeroImage(
    field: 'homeHeroImage' | 'brandLogoImage' = 'homeHeroImage',
  ) {
    const store = await this.repo
      .createQueryBuilder('store')
      .addSelect(`store.${field}`)
      .where('store.id = :id', { id: 1 })
      .getOne();
    const value = store?.[field] || '';
    const matched = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(value);
    if (!matched) return null;
    return { mimeType: matched[1], data: Buffer.from(matched[2], 'base64') };
  }

  async updateHomeHeroImage(
    file: HomeHeroUpload,
    field: 'homeHeroImage' | 'brandLogoImage' = 'homeHeroImage',
  ): Promise<StorePayload> {
    const store = await this.repo
      .createQueryBuilder('store')
      .addSelect(`store.${field}`)
      .where('store.id = :id', { id: 1 })
      .getOne();
    const target = store || (await this.ensureConfigured());
    target[field] =
      `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    await this.repo.save(target);
    return this.getPublic();
  }

  async update(payload: UpdateStoreDto): Promise<StorePayload> {
    const store = await this.ensureConfigured();
    const quick = payload.quickDateDays ?? store.quickDateDays;
    const advance = payload.bookingAdvanceDays ?? store.bookingAdvanceDays;
    if (quick > advance + 1)
      throw new BadRequestException('快捷日期数量不能超过可预约日期范围');
    if (payload.uiText) {
      for (const [key, value] of Object.entries(payload.uiText)) {
        if (
          !Object.prototype.hasOwnProperty.call(
            MINI_PROGRAM_TEXT_LABELS,
            key,
          ) ||
          typeof value !== 'string' ||
          !value.trim() ||
          value.length > 2000
        )
          throw new BadRequestException(
            '小程序文案包含未知项目、空值或超长内容',
          );
      }
      payload.uiText = { ...store.uiText, ...payload.uiText };
    }
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
    await this.repo.save(store);
    return this.getPublic();
  }
}
