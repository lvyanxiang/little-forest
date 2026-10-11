import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request } from 'express';
import { AdminAuthGuard, AdminRequest } from './admin-auth.guard';
import { AuthService } from './auth.service';

class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Header('Cache-Control', 'no-store')
  login(@Body() body: LoginDto, @Req() request: Request) {
    return this.auth.login(body.email, body.password, request.ip || 'unknown');
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AdminRequest) {
    return {
      email: request.adminSession.email,
      expiresAt: request.adminSession.expiresAt.toISOString(),
    };
  }

  @Post('logout')
  @UseGuards(AdminAuthGuard)
  @Header('Cache-Control', 'no-store')
  logout(@Req() request: AdminRequest) {
    return this.auth.logout(request.adminSession);
  }
}
