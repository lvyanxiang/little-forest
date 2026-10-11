import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { WechatAuthGuard, WechatRequest } from '../wechat/wechat-auth.guard';
import { CreateBookingDto, ListBookingsQueryDto } from './dto/booking.dto';

@Controller('bookings')
@UseGuards(WechatAuthGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  mine(@Req() request: WechatRequest) {
    return this.bookingsService.mine(request.wechatSession.userId);
  }

  @Post()
  create(@Body() body: CreateBookingDto, @Req() request: WechatRequest) {
    return this.bookingsService.create(body, request.wechatSession.userId);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: WechatRequest,
  ) {
    return this.bookingsService.cancel(id, request.wechatSession.userId);
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
