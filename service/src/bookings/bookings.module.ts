import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotsModule } from '../slots/slots.module';
import { TimeSlot } from '../slots/time-slot.entity';
import { StoreModule } from '../store/store.module';
import { AdminBookingsController, BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking } from './booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, TimeSlot]),
    StoreModule,
    SlotsModule,
  ],
  controllers: [BookingsController, AdminBookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
