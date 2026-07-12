import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [FleetController],
  providers: [FleetService],
})
export class FleetModule {}
