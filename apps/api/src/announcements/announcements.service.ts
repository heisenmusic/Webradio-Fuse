import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.announcement.findMany({
      where: { tenantId },
      include: { asset: true },
      orderBy: { time: 'asc' },
    });
  }

  create(data: {
    tenantId: string;
    assetId: string;
    label: string;
    time: string;
    daysOfWeek: number[];
    priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    category?: string;
    repeatEveryMin?: number;
    storeGroupIds?: string[];
    storeIds?: string[];
  }) {
    return this.prisma.announcement.create({
      data: {
        ...data,
        storeGroupIds: data.storeGroupIds ?? [],
        storeIds: data.storeIds ?? [],
      },
    });
  }

  remove(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }

  /**
   * Programação consumida pelo player de uma loja.
   * O player executa cada item usando o RELÓGIO DO DISPOSITIVO — o servidor
   * apenas distribui a definição ("toca às 08:00"), nunca calcula o horário.
   */
  async scheduleForStore(storeCode: string) {
    const store = await this.prisma.store.findFirst({ where: { code: storeCode } });
    if (!store) return { announcements: [], events: [] };

    const [announcements, events] = await Promise.all([
      this.prisma.announcement.findMany({
        where: {
          tenantId: store.tenantId,
          OR: [
            { storeIds: { isEmpty: true }, storeGroupIds: { isEmpty: true } },
            { storeIds: { has: store.id } },
            ...(store.groupId ? [{ storeGroupIds: { has: store.groupId } }] : []),
          ],
        },
        include: { asset: { select: { url: true, durationSec: true } } },
      }),
      this.prisma.operationalEvent.findMany({
        where: {
          tenantId: store.tenantId,
          OR: [
            { storeIds: { isEmpty: true }, storeGroupIds: { isEmpty: true } },
            { storeIds: { has: store.id } },
            ...(store.groupId ? [{ storeGroupIds: { has: store.groupId } }] : []),
          ],
        },
        include: { scene: true },
      }),
    ]);

    return { announcements, events };
  }
}
