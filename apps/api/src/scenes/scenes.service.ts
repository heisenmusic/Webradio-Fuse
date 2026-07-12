import { Injectable } from '@nestjs/common';
import type { SceneAction } from '@fuse/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScenesService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.scene.findMany({
      where: { tenantId },
      include: { events: true },
      orderBy: { name: 'asc' },
    });
  }

  create(data: { tenantId: string; name: string; description?: string; actions: SceneAction[] }) {
    return this.prisma.scene.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        actions: data.actions as object[],
      },
    });
  }

  createEvent(data: {
    tenantId: string;
    sceneId: string;
    kind:
      | 'OPENING'
      | 'LUNCH'
      | 'PROMOTION'
      | 'SHIFT_CHANGE'
      | 'CLOSING'
      | 'CLEANING'
      | 'INVENTORY'
      | 'CAMPAIGN'
      | 'CUSTOM';
    label: string;
    time: string;
    daysOfWeek: number[];
    storeGroupIds?: string[];
    storeIds?: string[];
  }) {
    return this.prisma.operationalEvent.create({
      data: {
        ...data,
        storeGroupIds: data.storeGroupIds ?? [],
        storeIds: data.storeIds ?? [],
      },
    });
  }

  remove(id: string) {
    return this.prisma.scene.delete({ where: { id } });
  }
}
