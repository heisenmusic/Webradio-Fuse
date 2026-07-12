import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { RemoteCommandType } from '@fuse/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { StoresService } from './stores.service';

class CreateStoreDto {
  @IsString()
  tenantId!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  city!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

const COMMAND_TYPES: RemoteCommandType[] = [
  'restart-player',
  'switch-stream',
  'update-version',
  'clear-cache',
  'update-theme',
  'announce-now',
  'audio-test',
  'open-diagnostics',
  'set-volume',
  'run-scene',
];

class RemoteCommandDto {
  @IsIn(COMMAND_TYPES)
  type!: RemoteCommandType;

  @IsOptional()
  payload?: Record<string, unknown>;
}

@Controller('stores')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
  constructor(
    private readonly stores: StoresService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles('VIEWER')
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('groupId') groupId?: string,
    @Query('brandId') brandId?: string,
    @Query('health') health?: string,
  ) {
    // Isolamento multi-tenant: usuários não-super veem apenas o próprio tenant.
    const tenantId = user.role === 'SUPER_ADMIN' ? undefined : user.tenantId ?? undefined;
    return this.stores.list({ tenantId, state, city, groupId, brandId, health });
  }

  @Get(':id')
  @Roles('VIEWER')
  get(@Param('id') id: string) {
    return this.stores.get(id);
  }

  @Post()
  @Roles('TENANT_ADMIN')
  create(@Body() dto: CreateStoreDto) {
    return this.stores.create(dto);
  }

  @Patch(':id')
  @Roles('MANAGER')
  update(@Param('id') id: string, @Body() dto: Partial<CreateStoreDto>) {
    return this.stores.update(id, dto as Record<string, unknown>);
  }

  /** Controle remoto: envia comando ao player da loja via Socket.IO. */
  @Post(':id/commands')
  @Roles('SUPPORT')
  async command(
    @Param('id') id: string,
    @Body() dto: RemoteCommandDto,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    const store = await this.stores.get(id);
    this.audit.log({
      tenantId: user.tenantId,
      userId: user.sub,
      action: 'store.command',
      entity: 'Store',
      entityId: id,
      meta: { type: dto.type, payload: dto.payload },
    });
    return this.realtime.sendCommand(store.code, dto.type, dto.payload, user.email);
  }
}
