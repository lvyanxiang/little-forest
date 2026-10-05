import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: DataSource,
          useValue: { isInitialized: true },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns health status', () => {
    expect(appController.getHealth()).toEqual({
      ok: true,
      name: 'little-forest-service',
      db: 'up',
    });
  });
});
