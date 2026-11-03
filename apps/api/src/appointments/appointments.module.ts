import { Global, Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service.js';

@Global()
@Module({ providers: [AppointmentsService], exports: [AppointmentsService] })
export class AppointmentsModule {}
