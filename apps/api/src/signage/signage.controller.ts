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
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { SignageService } from './signage.service';

const KINDS = [
  'IMAGE',
  'VIDEO',
  'BANNER',
  'QR_CODE',
  'CAMPAIGN',
  'NOTICE',
  'GOAL',
  'RANKING',
] as const;

class CreateSignageDto {
  @IsIn(KINDS as unknown as string[])
  kind!: (typeof KINDS)[number];

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  assetUrl?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsInt()
  @Min(3)
  durationSec?: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeGroupIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  storeIds?: string[];
}

@Controller('signage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SignageController {
  constructor(private readonly signage: SignageService) {}

  @Get()
  @Roles('VIEWER')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.signage.list(user.tenantId ?? '');
  }

  @Post()
  @Roles('MANAGER')
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateSignageDto) {
    return this.signage.create({ ...dto, tenantId: user.tenantId ?? '' });
  }

  @Delete(':id')
  @Roles('MANAGER')
  remove(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.signage.remove(id, user.tenantId ?? '');
  }
}
