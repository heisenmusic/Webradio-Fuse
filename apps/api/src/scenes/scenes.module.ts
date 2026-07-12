import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';

@Module({
  imports: [AuthModule],
  controllers: [ScenesController],
  providers: [ScenesService],
})
export class ScenesModule {}
