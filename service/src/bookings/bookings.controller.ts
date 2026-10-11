import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import {
  CancelBookingDto,
  CreateBookingDto,
  ListBookingsQueryDto,
} from './dto/booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  mine(@Query() query: ListBookingsQueryDto) {
    if (!query.clientId) {
      return [];
    }
    return this.bookingsService.mine(query.clientId);
  }

  @Post()
  create(@Body() body: CreateBookingDto) {
    return this.bookingsService.create(body);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: CancelBookingDto) {
    return this.bookingsService.cancel(id, body.clientId);
  }
}

@Controller('admin/bookings')
@UseGuards(AdminAuthGuard)
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  list(@Query() query: ListBookingsQueryDto) {
    return this.bookingsService.adminList(query.date);
  }
}
