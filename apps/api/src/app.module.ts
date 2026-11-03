import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma.module.js';
import { env } from './common/env.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessModule } from './business/business.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { PublicModule } from './public/public.module.js';
import { AdminModule } from './admin/admin.module.js';
import { InternalController } from './internal/internal.controller.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: env.throttleLimit }]),
    PrismaModule,
    AuthModule,
    BusinessModule,
    AvailabilityModule,
    AppointmentsModule,
    PublicModule,
    AdminModule,
  ],
  controllers: [HealthController, InternalController],
})
export class AppModule {}
