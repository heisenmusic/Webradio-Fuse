import { Module } from '@nestjs/common';
import { StreamProxyController } from './stream-proxy.controller';

@Module({
  controllers: [StreamProxyController],
})
export class StreamModule {}
