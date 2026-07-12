import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Trilha de auditoria — grava ações administrativas sem nunca
 * derrubar a requisição principal em caso de falha.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(entry: {
    tenantId?: string | null;
    userId?: string | null;
    action: string;
    entity?: string;
    entityId?: string;
    ip?: string;
    meta?: Record<string, unknown>;
  }): void {
    void this.prisma.auditLog
      .create({
        data: {
          tenantId: entry.tenantId ?? undefined,
          userId: entry.userId ?? undefined,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          ip: entry.ip,
          meta: entry.meta as object | undefined,
        },
      })
      .catch((err) => this.logger.warn(`Falha ao gravar auditoria: ${err}`));
  }
}
