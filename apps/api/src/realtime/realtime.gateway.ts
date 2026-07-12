import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import type { RemoteCommand, RemoteCommandAck, RemoteCommandType } from '@fuse/shared';

/**
 * Canal realtime da plataforma.
 *
 * Players entram na sala `store:<code>` e recebem comandos remotos.
 * Dashboards entram na sala `fleet` e recebem atualizações de status.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Desconectado: ${client.id}`);
  }

  /** Player se registra informando o código da loja. */
  @SubscribeMessage('player:join')
  onPlayerJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { storeCode: string }) {
    if (!data?.storeCode) return { ok: false };
    void client.join(`store:${data.storeCode}`);
    this.logger.log(`Player da loja ${data.storeCode} online (${client.id})`);
    return { ok: true };
  }

  /** Dashboard se inscreve nas atualizações da frota. */
  @SubscribeMessage('fleet:join')
  onFleetJoin(@ConnectedSocket() client: Socket) {
    void client.join('fleet');
    return { ok: true };
  }

  /** Player confirma execução de um comando remoto. */
  @SubscribeMessage('command:ack')
  onCommandAck(@MessageBody() ack: RemoteCommandAck) {
    this.server.to('fleet').emit('command:ack', ack);
  }

  /** Envia comando remoto para o player de uma loja. */
  sendCommand(
    storeCode: string,
    type: RemoteCommandType,
    payload: Record<string, unknown> | undefined,
    issuedBy: string,
  ): RemoteCommand {
    const command: RemoteCommand = {
      id: randomUUID(),
      type,
      payload,
      issuedBy,
      issuedAt: new Date().toISOString(),
      targetStoreCodes: [storeCode],
    };
    this.server.to(`store:${storeCode}`).emit('remote-command', command);
    this.logger.log(`Comando ${type} → loja ${storeCode} (por ${issuedBy})`);
    return command;
  }

  /** Propaga atualização de heartbeat/health para os dashboards. */
  broadcastFleetUpdate(update: Record<string, unknown>) {
    this.server?.to('fleet').emit('fleet:update', update);
  }
}
