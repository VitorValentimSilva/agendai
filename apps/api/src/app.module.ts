import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessModule } from './business/business.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { PublicModule } from './public/public.module.js';
import { AdminModule } from './admin/admin.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { InternalController } from './internal/internal.controller.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BusinessModule,
    AvailabilityModule,
    AppointmentsModule,
    MessagingModule,
    PaymentsModule,
    PublicModule,
    AdminModule,
  ],
  controllers: [HealthController, InternalController],
})
export class AppModule {}
