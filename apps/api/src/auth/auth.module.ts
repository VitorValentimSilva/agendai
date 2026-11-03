import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env, SESSION_TTL_SECONDS } from '../common/env.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: env.jwtSecret, signOptions: { expiresIn: SESSION_TTL_SECONDS } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
