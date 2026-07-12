import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SignageController } from './signage.controller';
import { SignageService } from './signage.service';

@Module({
  imports: [AuthModule],
  controllers: [SignageController],
  providers: [SignageService],
})
export class SignageModule {}
