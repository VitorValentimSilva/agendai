import { Module } from '@nestjs/common';
import { GoogleClient } from './google.client.js';
import { CalendarService } from './calendar.service.js';
import { GoogleBusyService } from './google-busy.service.js';
import { CalendarAdminController, CalendarPublicController } from './calendar.controller.js';

@Module({
  providers: [GoogleClient, CalendarService, GoogleBusyService],
  controllers: [CalendarPublicController, CalendarAdminController],
  exports: [GoogleClient, GoogleBusyService],
})
export class CalendarModule {}
