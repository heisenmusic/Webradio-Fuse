import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [StoresController],
  providers: [StoresService],
})
export class StoresModule {}
