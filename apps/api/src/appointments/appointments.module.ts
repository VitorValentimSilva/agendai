import { Global, Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service.js';
import { AppointmentEvents } from './appointment-events.js';

@Global()
@Module({ providers: [AppointmentsService, AppointmentEvents], exports: [AppointmentsService, AppointmentEvents] })
export class AppointmentsModule {}
