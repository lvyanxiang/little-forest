import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getHealth() {
    const dbUp = this.dataSource.isInitialized;
    return {
      ok: dbUp,
      name: 'little-forest-service',
      db: dbUp ? 'up' : 'down',
    };
  }
}
