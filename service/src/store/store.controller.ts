import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UpdateStoreDto } from './dto/update-store.dto';
import { HomeHeroUpload, StoreService } from './store.service';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  getStore() {
    return this.storeService.getPublic();
  }

  @Get('home-image')
  async getHomeImage(@Res() response: Response) {
    const image = await this.storeService.getHomeHeroImage();
    if (!image) throw new NotFoundException('尚未上传首页图片');
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('Cache-Control', 'no-store');
    response.send(image.data);
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
  @Post('home-image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadHomeImage(@UploadedFile() file?: HomeHeroUpload) {
    if (!file) throw new BadRequestException('请选择图片');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('仅支持 JPG、PNG 或 WebP 图片');
    }
    return this.storeService.updateHomeHeroImage(file);
  }
}
