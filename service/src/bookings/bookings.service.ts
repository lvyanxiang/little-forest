import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatSlotLabel, isSlotPast, todayKey, weekdayOf } from '../common/time';
import { SlotsService } from '../slots/slots.service';
import { TimeSlot } from '../slots/time-slot.entity';
import { StoreService } from '../store/store.service';
import { Booking } from './booking.entity';
import { CreateBookingDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    @InjectRepository(TimeSlot)
    private readonly slots: Repository<TimeSlot>,
    private readonly storeService: StoreService,
    private readonly slotsService: SlotsService,
  ) {}

  async create(dto: CreateBookingDto) {
    if (dto.visitDate < todayKey()) {
      throw new BadRequestException('不能预约过去的日期');
    }
    const store = await this.storeService.getPublic();
    if (store.closedWeekdays.includes(weekdayOf(dto.visitDate))) {
      throw new BadRequestException('该日闭馆，无法预约');
    }
    const slot = await this.slots.findOne({ where: { id: dto.slotId } });
    if (!slot || !slot.isActive) {
      throw new BadRequestException('该时段已下线，请重新选择');
    }
    if (isSlotPast(dto.visitDate, slot.startTime)) {
      throw new BadRequestException('该时段已过，无法预约');
    }
    const booked = await this.slotsService.bookedPeople(dto.visitDate, slot.id);
    if (booked + dto.people > slot.maxCapacity) {
      throw new BadRequestException('该时段名额不足');
    }
    const entity = this.bookings.create({
      clientId: dto.clientId,
      visitDate: dto.visitDate,
      slotId: slot.id,
      slotLabel: formatSlotLabel(slot.startTime, slot.endTime),
      startTime: slot.startTime,
      endTime: slot.endTime,
      name: dto.name.trim(),
      phone: dto.phone,
      people: dto.people,
      status: 'confirmed',
    });
    return this.toPublic(await this.bookings.save(entity));
  }

  async mine(clientId: string) {
    const rows = await this.bookings.find({
      where: { clientId },
      order: { visitDate: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async adminList(date?: string) {
    const where = date ? { visitDate: date } : {};
    const rows = await this.bookings.find({
      where,
      order: { visitDate: 'DESC', createdAt: 'DESC' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async cancel(id: string, clientId: string) {
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('预约不存在');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('无权取消该预约');
    }
    if (booking.status === 'cancelled') {
      return this.toPublic(booking);
    }
    booking.status = 'cancelled';
    return this.toPublic(await this.bookings.save(booking));
  }

  private toPublic(row: Booking) {
    return {
      id: row.id,
      date: row.visitDate,
      slotId: row.slotId,
      slotLabel: row.slotLabel,
      startTime: row.startTime,
      endTime: row.endTime,
      name: row.name,
      phone: row.phone,
      people: row.people,
      status: row.status,
      createdAt: row.createdAt,
    };
  }
}
