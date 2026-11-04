import { Module } from '@nestjs/common';
import { GoogleClient } from './google.client.js';
import { CalendarService } from './calendar.service.js';
import { CalendarAdminController, CalendarPublicController } from './calendar.controller.js';

@Module({
  providers: [GoogleClient, CalendarService],
  controllers: [CalendarPublicController, CalendarAdminController],
  exports: [GoogleClient],
})
export class CalendarModule {}
