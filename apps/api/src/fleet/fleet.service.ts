import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HEARTBEAT_INTERVAL_MS, HeartbeatPayload } from '@fuse/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/** Loja é considerada offline após perder 3 heartbeats consecutivos. */
const OFFLINE_AFTER_MS = HEARTBEAT_INTERVAL_MS * 3;

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Ingestão de heartbeat enviado pelo player a cada 30s. */
  async ingestHeartbeat(payload: HeartbeatPayload, deviceKey: string, ip?: string) {
    const expected = process.env.DEVICE_API_KEY ?? 'change-me-device-key';
    if (deviceKey !== expected) {
      throw new UnauthorizedException('Chave de dispositivo inválida');
    }

    const store = await this.prisma.store.findFirst({
      where: { code: payload.storeCode },
    });
    if (!store) throw new UnauthorizedException('Loja desconhecida');

    const health = this.healthFrom(payload);

    await this.prisma.$transaction([
      this.prisma.heartbeat.create({
        data: {
          storeId: store.id,
          deviceTime: new Date(payload.deviceTime),
          appVersion: payload.appVersion,
          uptimeSec: Math.round(payload.uptimeSec),
          playerState: payload.playerState,
          streamUrl: payload.streamUrl,
          volume: payload.volume,
          quality: payload.quality,
          cpuPct: payload.cpuPct,
          ramMb: payload.ramMb,
          latencyMs: payload.latencyMs,
          ip: ip ?? payload.ip,
          platform: payload.platform,
        },
      }),
      this.prisma.store.update({
        where: { id: store.id },
        data: { health, lastSeenAt: new Date() },
      }),
    ]);

    // Notifica dashboards conectados em tempo real.
    this.realtime.broadcastFleetUpdate({ storeCode: store.code, health, heartbeat: payload });
    return { ok: true, health };
  }

  private healthFrom(hb: HeartbeatPayload): 'ONLINE' | 'DEGRADED' | 'NO_AUDIO' | 'HIGH_LATENCY' {
    if (hb.playerState === 'emergency' || hb.playerState === 'failover') return 'DEGRADED';
    if (hb.playerState !== 'playing' || hb.volume === 0) return 'NO_AUDIO';
    if ((hb.latencyMs ?? 0) > 2000 || hb.quality === 'poor') return 'HIGH_LATENCY';
    return 'ONLINE';
  }

  /** Visão consolidada da frota para o dashboard. */
  async status(tenantId?: string) {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS);
    const stores = await this.prisma.store.findMany({
      where: { tenantId },
      include: {
        brand: { select: { name: true } },
        group: { select: { name: true } },
        tenant: { select: { name: true, slug: true } },
        heartbeats: { orderBy: { receivedAt: 'desc' }, take: 1 },
      },
    });

    const items = stores.map((s) => {
      const offline = !s.lastSeenAt || s.lastSeenAt < cutoff;
      return {
        storeId: s.id,
        storeCode: s.code,
        name: s.name,
        city: s.city,
        state: s.state ?? undefined,
        brand: s.brand?.name,
        group: s.group?.name,
        tenant: s.tenant.name,
        lat: s.lat ?? undefined,
        lng: s.lng ?? undefined,
        health: offline ? 'offline' : s.health.toLowerCase().replace(/_/g, '-'),
        lastSeenAt: s.lastSeenAt?.toISOString(),
        lastHeartbeat: s.heartbeats[0] ?? null,
      };
    });

    const count = (h: string) => items.filter((i) => i.health === h).length;
    return {
      totals: {
        stores: items.length,
        online: count('online'),
        offline: count('offline'),
        degraded: count('degraded'),
        noAudio: count('no-audio'),
        highLatency: count('high-latency'),
        outOfSync: count('out-of-sync'),
      },
      stores: items,
    };
  }

  /** Marca lojas sem heartbeat recente e registra incidente de queda. */
  async sweepOffline() {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MS);
    const stale = await this.prisma.store.findMany({
      where: { health: { not: 'OFFLINE' }, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] },
    });
    for (const store of stale) {
      await this.prisma.$transaction([
        this.prisma.store.update({ where: { id: store.id }, data: { health: 'OFFLINE' } }),
        this.prisma.incident.create({
          data: {
            storeId: store.id,
            type: 'DEVICE_OFFLINE',
            message: `Loja ${store.code} sem heartbeat desde ${store.lastSeenAt?.toISOString() ?? 'nunca'}`,
          },
        }),
      ]);
    }
    return { swept: stale.length };
  }
}
