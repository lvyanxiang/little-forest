import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreSetting } from './store-setting.entity';
import { AdminStoreController, StoreController } from './store.controller';
import { GeocodeService } from './geocode.service';
import { StoreService } from './store.service';

@Module({
  imports: [TypeOrmModule.forFeature([StoreSetting])],
  controllers: [StoreController, AdminStoreController],
  providers: [StoreService, GeocodeService],
  exports: [StoreService],
})
export class StoreModule {}
