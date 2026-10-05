import { BadRequestException, Body, Controller, Get, Put, Query } from '@nestjs/common';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoreService } from './store.service';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  getStore() {
    return this.storeService.getPublic();
  }
}

@Controller('admin/store')
export class AdminStoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  getStore() {
    return this.storeService.getPublic();
  }

  @Get('geocode')
  geocode(@Query('address') address: string) {
    if (!address?.trim()) {
      throw new BadRequestException('请输入地址');
    }
    return this.storeService.lookupAddress(address);
  }

  @Get('reverse-geocode')
  reverseGeocode(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
  ) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new BadRequestException('请传入有效的经纬度');
    }
    return this.storeService.lookupCoords(lat, lng);
  }

  @Put()
  updateStore(@Body() body: UpdateStoreDto) {
    return this.storeService.update(body);
  }
}
