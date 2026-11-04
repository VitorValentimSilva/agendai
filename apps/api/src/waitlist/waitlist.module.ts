import { Module } from '@nestjs/common';
import { WaitlistService } from './waitlist.service.js';
import { WaitlistAdminController, WaitlistPublicController } from './waitlist.controller.js';

@Module({
  providers: [WaitlistService],
  controllers: [WaitlistPublicController, WaitlistAdminController],
})
export class WaitlistModule {}
