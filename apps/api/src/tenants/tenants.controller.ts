import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsHexColor, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantsService } from './tenants.service';

class CreateTenantDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  list() {
    return this.tenants.list();
  }

  @Get(':id')
  @Roles('TENANT_ADMIN')
  get(@Param('id') id: string) {
    return this.tenants.get(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Patch(':id')
  @Roles('TENANT_ADMIN')
  update(@Param('id') id: string, @Body() dto: Partial<CreateTenantDto>) {
    return this.tenants.update(id, dto);
  }
}
