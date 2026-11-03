import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller.js';
import { CatalogController } from './catalog.controller.js';
import { CustomersController } from './customers.controller.js';
import { DashboardService } from './dashboard.service.js';
import { SettingsController } from './settings.controller.js';

@Module({
  controllers: [AgendaController, CatalogController, CustomersController, SettingsController],
  providers: [DashboardService],
})
export class AdminModule {}
