import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Put,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UpdateStoreDto } from './dto/update-store.dto';
import { HomeHeroUpload, StoreService } from './store.service';
import { AdminAuthGuard } from '../auth/admin-auth.guard';

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
@UseGuards(AdminAuthGuard)
export class AdminStoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  getStore() {
    return this.storeService.getPublic();
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
