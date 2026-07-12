import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SignageKind =
  | 'IMAGE'
  | 'VIDEO'
  | 'BANNER'
  | 'QR_CODE'
  | 'CAMPAIGN'
  | 'NOTICE'
  | 'GOAL'
  | 'RANKING';

@Injectable()
export class SignageService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.signageItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: {
    tenantId: string;
    kind: SignageKind;
    title: string;
    assetUrl?: string;
    body?: string;
    durationSec?: number;
    startsAt?: string;
    endsAt?: string;
    storeGroupIds?: string[];
    storeIds?: string[];
  }) {
    return this.prisma.signageItem.create({
      data: {
        tenantId: data.tenantId,
        kind: data.kind,
        title: data.title,
        assetUrl: data.assetUrl,
        body: data.body,
        durationSec: data.durationSec ?? 15,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        storeGroupIds: data.storeGroupIds ?? [],
        storeIds: data.storeIds ?? [],
      },
    });
  }

  remove(id: string, tenantId: string) {
    return this.prisma.signageItem.deleteMany({ where: { id, tenantId } });
  }
}
