import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class HealthController {
  @Get('health')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  health(): string {
    return 'ok';
  }

  @Get()
  root() {
    return { name: 'Agendaí API', docs: '/docs', health: '/health' };
  }
}
