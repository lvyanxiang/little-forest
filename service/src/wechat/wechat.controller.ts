import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { WechatAuthGuard, WechatRequest } from './wechat-auth.guard';
import { AvatarUpload, WechatService } from './wechat.service';

class WechatLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  code: string;
}

class ProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nickname?: string;
}

@Controller('wechat')
export class WechatController {
  constructor(private readonly wechat: WechatService) {}

  @Post('login')
  @Header('Cache-Control', 'no-store')
  login(@Body() body: WechatLoginDto) {
    return this.wechat.login(body.code);
  }

  @Get('me')
  @UseGuards(WechatAuthGuard)
  me(@Req() request: WechatRequest) {
    return this.wechat.profile(request.wechatSession.userId);
  }

  @Post('phone-number')
  @UseGuards(WechatAuthGuard)
  @Header('Cache-Control', 'no-store')
  phoneNumber(@Body() body: WechatLoginDto) {
    return this.wechat.phoneNumber(body.code);
  }

  @Post('profile')
  @UseGuards(WechatAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: 2 * 1024 * 1024 } }),
  )
  profile(
    @Req() request: WechatRequest,
    @Body() body: ProfileDto,
    @UploadedFile() file?: AvatarUpload,
  ) {
    return this.wechat.updateProfile(
      request.wechatSession.userId,
      body.nickname,
      file,
    );
  }

  @Get('avatar')
  @UseGuards(WechatAuthGuard)
  async avatar(@Req() request: WechatRequest, @Res() response: Response) {
    const image = await this.wechat.avatar(request.wechatSession.userId);
    response.setHeader('Content-Type', image.mimeType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(image.data);
  }

  @Post('logout')
  @UseGuards(WechatAuthGuard)
  logout(@Req() request: WechatRequest) {
    return this.wechat.logout(request.wechatSession);
  }
}
