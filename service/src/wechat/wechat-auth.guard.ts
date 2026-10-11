import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WechatSession } from './wechat-session.entity';
import { WechatService } from './wechat.service';

export type WechatRequest = Request & { wechatSession: WechatSession };

@Injectable()
export class WechatAuthGuard implements CanActivate {
  constructor(private readonly wechat: WechatService) {}

  async canActivate(context: ExecutionContext) {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    const request = context.switchToHttp().getRequest<WechatRequest>();
    request.wechatSession = await this.wechat.authenticate(
      request.headers.authorization,
    );
    return true;
  }
}
