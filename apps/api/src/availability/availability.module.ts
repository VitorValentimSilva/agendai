import { Global, Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service.js';

@Global()
@Module({ providers: [AvailabilityService], exports: [AvailabilityService] })
export class AvailabilityModule {}
