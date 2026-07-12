import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { HeartbeatPayload } from '@fuse/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { FleetService } from './fleet.service';

@Controller('fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  /** Endpoint público de dispositivo (autenticado por chave, não por JWT). */
  @Post('heartbeats')
  @HttpCode(202)
  heartbeat(
    @Body() payload: HeartbeatPayload,
    @Headers('x-device-key') deviceKey: string,
    @Ip() ip: string,
  ) {
    return this.fleet.ingestHeartbeat(payload, deviceKey ?? '', ip);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VIEWER')
  status(@CurrentUser() user: AccessTokenPayload) {
    const tenantId = user.role === 'SUPER_ADMIN' ? undefined : user.tenantId ?? undefined;
    return this.fleet.status(tenantId);
  }

  @Post('sweep-offline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPPORT')
  sweep() {
    return this.fleet.sweepOffline();
  }
}
