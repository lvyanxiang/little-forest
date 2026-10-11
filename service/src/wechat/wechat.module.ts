import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WechatAuthGuard } from './wechat-auth.guard';
import { WechatSession } from './wechat-session.entity';
import { WechatUser } from './wechat-user.entity';
import { WechatController } from './wechat.controller';
import { WechatGateway } from './wechat.gateway';
import { WechatService } from './wechat.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WechatUser, WechatSession])],
  controllers: [WechatController],
  providers: [WechatGateway, WechatService, WechatAuthGuard],
  exports: [WechatService, WechatAuthGuard],
})
export class WechatModule {}
