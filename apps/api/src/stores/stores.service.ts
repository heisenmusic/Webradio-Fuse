import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface StoreFilters {
  tenantId?: string;
  state?: string;
  city?: string;
  groupId?: string;
  brandId?: string;
  health?: string;
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list(filters: StoreFilters) {
    return this.prisma.store.findMany({
      where: {
        tenantId: filters.tenantId,
        state: filters.state ?? undefined,
        city: filters.city ?? undefined,
        groupId: filters.groupId ?? undefined,
        brandId: filters.brandId ?? undefined,
        health: (filters.health as never) ?? undefined,
      },
      include: {
        brand: { select: { name: true } },
        group: { select: { name: true } },
        station: { include: { endpoints: { orderBy: { priority: 'asc' } } } },
      },
      orderBy: [{ state: 'asc' }, { city: 'asc' }, { name: 'asc' }],
    });
  }

  async get(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        brand: true,
        group: true,
        device: true,
        station: { include: { endpoints: { orderBy: { priority: 'asc' } } } },
        heartbeats: { orderBy: { receivedAt: 'desc' }, take: 20 },
        incidents: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!store) throw new NotFoundException('Loja não encontrada');
    return store;
  }

  create(data: {
    tenantId: string;
    code: string;
    name: string;
    city: string;
    state?: string;
    timezone?: string;
    brandId?: string;
    groupId?: string;
    stationId?: string;
    lat?: number;
    lng?: number;
  }) {
    return this.prisma.store.create({ data });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.store.update({ where: { id }, data });
  }
}
