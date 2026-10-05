import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { formatSlotLabel, isSlotPast, timeToMinutes, weekdayOf } from '../common/time';
import { StoreService } from '../store/store.service';
import { CreateSlotDto, UpdateSlotDto } from './dto/slot.dto';
import { TimeSlot } from './time-slot.entity';

const DEFAULT_SLOTS = [
  { startTime: '14:00', endTime: '15:30', maxCapacity: 8, sortOrder: 1 },
  { startTime: '15:30', endTime: '17:00', maxCapacity: 8, sortOrder: 2 },
  { startTime: '17:00', endTime: '18:30', maxCapacity: 10, sortOrder: 3 },
  { startTime: '18:30', endTime: '20:00', maxCapacity: 8, sortOrder: 4 },
  { startTime: '20:00', endTime: '21:00', maxCapacity: 6, sortOrder: 5 },
];

@Injectable()
export class SlotsService implements OnModuleInit {
  constructor(
    @InjectRepository(TimeSlot)
    private readonly slots: Repository<TimeSlot>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    private readonly storeService: StoreService,
  ) {}

  async onModuleInit() {
    await this.ensureDefault();
  }

  async bookedPeople(date: string, slotId: number) {
    const raw = await this.bookings
      .createQueryBuilder('b')
      .select('COALESCE(SUM(b.people), 0)', 'total')
      .where('b.visitDate = :date', { date })
      .andWhere('b.slotId = :slotId', { slotId })
      .andWhere("b.status = 'confirmed'")
      .getRawOne<{ total: string | number }>();
    return Number(raw?.total ?? 0);
  }

  async ensureDefault() {
    const count = await this.slots.count();
    if (count > 0) return;
    await this.slots.save(DEFAULT_SLOTS.map((item) => this.slots.create(item)));
  }

  listAdmin() {
    return this.slots.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async availability(date: string) {
    const store = await this.storeService.getPublic();
    const closed = store.closedWeekdays.includes(weekdayOf(date));
    const active = await this.slots.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    if (closed) {
      return {
        date,
        closed: true,
        slots: active.map((slot) => this.toPublic(slot, 0, true, date)),
      };
    }
    const rows = await Promise.all(
      active.map(async (slot) => {
        const booked = await this.bookedPeople(date, slot.id);
        return this.toPublic(slot, booked, false, date);
      }),
    );
    return { date, closed: false, slots: rows };
  }

  async create(dto: CreateSlotDto) {
    this.assertRange(dto.startTime, dto.endTime);
    const last = await this.slots.find({
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    const slot = this.slots.create({
      ...dto,
      sortOrder: dto.sortOrder ?? (last[0]?.sortOrder ?? 0) + 1,
      isActive: true,
    });
    return this.slots.save(slot);
  }

  async reorder(ids: number[]) {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException('排序数据重复');
    }
    const rows = await this.slots.find();
    if (rows.length !== ids.length || ids.some((id) => !rows.some((row) => row.id === id))) {
      throw new BadRequestException('排序数据不完整，请刷新后重试');
    }
    await Promise.all(
      ids.map((id, index) => {
        const slot = rows.find((row) => row.id === id);
        if (!slot) return Promise.resolve();
        slot.sortOrder = index + 1;
        return this.slots.save(slot);
      }),
    );
    return this.listAdmin();
  }

  async update(id: number, dto: UpdateSlotDto) {
    const slot = await this.slots.findOne({ where: { id } });
    if (!slot) throw new BadRequestException('时段不存在');
    const start = dto.startTime ?? slot.startTime;
    const end = dto.endTime ?? slot.endTime;
    this.assertRange(start, end);
    Object.assign(slot, dto);
    return this.slots.save(slot);
  }

  async remove(id: number) {
    const slot = await this.slots.findOne({ where: { id } });
    if (!slot) throw new BadRequestException('时段不存在');
    slot.isActive = false;
    return this.slots.save(slot);
  }

  private assertRange(start: string, end: string) {
    if (timeToMinutes(end) <= timeToMinutes(start)) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
  }

  private toPublic(slot: TimeSlot, booked: number, closed: boolean, date: string) {
    const past = !closed && isSlotPast(date, slot.startTime);
    const avail = closed || past ? 0 : Math.max(0, slot.maxCapacity - booked);
    return {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: formatSlotLabel(slot.startTime, slot.endTime),
      max: slot.maxCapacity,
      booked: closed ? 0 : booked,
      avail,
      isFull: !past && avail <= 0,
      isPast: past,
    };
  }
}
