import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type { SceneAction } from '@fuse/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ScenesService } from './scenes.service';

class CreateSceneDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  actions!: SceneAction[];
}

const EVENT_KINDS = [
  'OPENING',
  'LUNCH',
  'PROMOTION',
  'SHIFT_CHANGE',
  'CLOSING',
  'CLEANING',
  'INVENTORY',
  'CAMPAIGN',
  'CUSTOM',
] as const;

class CreateEventDto {
  @IsString()
  sceneId!: string;

  @IsIn(EVENT_KINDS as unknown as string[])
  kind!: (typeof EVENT_KINDS)[number];

  @IsString()
  label!: string;

  /** Horário LOCAL do dispositivo, formato HH:mm. */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string;

  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeGroupIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeIds?: string[];
}

@Controller('scenes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScenesController {
  constructor(private readonly scenes: ScenesService) {}

  @Get()
  @Roles('VIEWER')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.scenes.list(user.tenantId ?? '');
  }

  @Post()
  @Roles('MANAGER')
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateSceneDto) {
    return this.scenes.create({ ...dto, tenantId: user.tenantId ?? '' });
  }

  @Post('events')
  @Roles('MANAGER')
  createEvent(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateEventDto) {
    return this.scenes.createEvent({ ...dto, tenantId: user.tenantId ?? '' });
  }

  @Delete(':id')
  @Roles('MANAGER')
  remove(@Param('id') id: string) {
    return this.scenes.remove(id);
  }
}
