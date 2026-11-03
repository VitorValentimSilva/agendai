import { Global, Module } from '@nestjs/common';
import { BusinessService } from './business.service.js';

@Global()
@Module({ providers: [BusinessService], exports: [BusinessService] })
export class BusinessModule {}
