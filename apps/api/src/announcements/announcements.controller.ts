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
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { AnnouncementsService } from './announcements.service';

class CreateAnnouncementDto {
  @IsString()
  assetId!: string;

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
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  repeatEveryMin?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeGroupIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeIds?: string[];
}

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VIEWER')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.announcements.list(user.tenantId ?? '');
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateAnnouncementDto) {
    return this.announcements.create({ ...dto, tenantId: user.tenantId ?? '' });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  remove(@Param('id') id: string) {
    return this.announcements.remove(id);
  }

  /** Consumido pelo player da loja (sem JWT — identifica-se pelo código). */
  @Get('schedule/:storeCode')
  schedule(@Param('storeCode') storeCode: string) {
    return this.announcements.scheduleForStore(storeCode);
  }
}
