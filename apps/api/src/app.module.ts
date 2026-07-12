import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { StoresModule } from './stores/stores.module';
import { FleetModule } from './fleet/fleet.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { ScenesModule } from './scenes/scenes.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limit global: 100 req / 60s por IP
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    TenantsModule,
    StoresModule,
    FleetModule,
    AnnouncementsModule,
    ScenesModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
