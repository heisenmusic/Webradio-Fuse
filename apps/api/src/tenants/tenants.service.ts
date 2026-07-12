import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tenant.findMany({
      include: { _count: { select: { stores: true, brands: true, users: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { brands: true, groups: true, stations: { include: { endpoints: true } } },
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  create(data: { slug: string; name: string; domain?: string; primaryColor?: string; accentColor?: string }) {
    return this.prisma.tenant.create({ data });
  }

  update(id: string, data: Partial<{ name: string; domain: string; logoUrl: string; primaryColor: string; accentColor: string }>) {
    return this.prisma.tenant.update({ where: { id }, data });
  }
}
