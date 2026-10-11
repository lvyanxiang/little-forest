import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminSession } from './admin-session.entity';
import { AuthService } from './auth.service';

export type AdminRequest = Request & { adminSession: AdminSession };

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    const request = context.switchToHttp().getRequest<AdminRequest>();
    request.adminSession = await this.auth.authenticate(
      request.headers.authorization,
    );
    return true;
  }
}
