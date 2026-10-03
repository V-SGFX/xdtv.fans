import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return { name: 'XDTV API', version: '1.0.0', status: 'ok' };
  }

  @Get('health')
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
