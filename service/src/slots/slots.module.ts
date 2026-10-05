import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/booking.entity';
import { StoreModule } from '../store/store.module';
import { AdminSlotsController, SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';
import { TimeSlot } from './time-slot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TimeSlot, Booking]), StoreModule],
  controllers: [SlotsController, AdminSlotsController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class SlotsModule {}
