import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateSlotDto, ReorderSlotsDto, UpdateSlotDto } from './dto/slot.dto';
import { SlotsService } from './slots.service';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  list(@Query('date') date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      throw new BadRequestException('请传入日期，格式 YYYY-MM-DD');
    }
    return this.slotsService.availability(date);
  }
}

@Controller('admin/slots')
export class AdminSlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get()
  list() {
    return this.slotsService.listAdmin();
  }

  @Post()
  create(@Body() body: CreateSlotDto) {
    return this.slotsService.create(body);
  }

  @Patch('reorder')
  reorder(@Body() body: ReorderSlotsDto) {
    return this.slotsService.reorder(body.ids);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateSlotDto) {
    return this.slotsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.slotsService.remove(id);
  }
}
