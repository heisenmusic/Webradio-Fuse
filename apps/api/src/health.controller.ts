import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', service: 'fuse-radio-api', ts: new Date().toISOString() };
  }
}
