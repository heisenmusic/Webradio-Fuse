import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MediaKind = 'AUDIO' | 'IMAGE' | 'VIDEO';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string, kind?: MediaKind) {
    return this.prisma.mediaAsset.findMany({
      where: { tenantId, kind: kind ?? undefined },
      orderBy: { createdAt: 'desc' },
    });
  }

  register(data: {
    tenantId: string;
    kind: MediaKind;
    name: string;
    url: string;
    mime?: string;
    sizeBytes?: number;
  }) {
    return this.prisma.mediaAsset.create({ data });
  }

  remove(id: string, tenantId: string) {
    return this.prisma.mediaAsset.deleteMany({ where: { id, tenantId } });
  }

  static kindFromMime(mime: string): MediaKind | null {
    if (mime.startsWith('audio/')) return 'AUDIO';
    if (mime.startsWith('image/')) return 'IMAGE';
    if (mime.startsWith('video/')) return 'VIDEO';
    return null;
  }
}
