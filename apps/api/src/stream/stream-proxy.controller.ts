import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { IncomingMessage, ServerResponse } from 'http';
import * as http from 'http';
import * as https from 'https';

const DEFAULT_TARGETS = [
  'https://centova2.svdns.com.br:20028/stream',
  'https://centova2.svdns.com.br:20028/live',
  'https://centova2.svdns.com.br:20028/',
];

/**
 * Proxy de stream com CORS.
 *
 * Servidores Icecast/Centova raramente enviam Access-Control-Allow-Origin,
 * o que impede o AnalyserNode (visualizador sincronizado à música). Este
 * endpoint repassa o stream adicionando os cabeçalhos CORS.
 *
 * Segurança: NÃO é um proxy aberto — só repassa os alvos fixados em
 * STREAM_PROXY_TARGETS (CSV) ou, na ausência, os endpoints padrão da estação.
 *
 * Escala: cada ouvinte conectado ao proxy consome banda do servidor da API.
 * Adequado até centenas de lojas por instância; para frotas maiores, prefira
 * habilitar CORS no próprio Icecast ou proxiar via nginx/CDN (docs/DEPLOY.md).
 */
@SkipThrottle()
@Controller('stream-proxy')
export class StreamProxyController {
  private readonly targets: string[] = StreamProxyController.parseTargets();

  private static parseTargets(): string[] {
    const fromEnv = (process.env.STREAM_PROXY_TARGETS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return fromEnv.length > 0 ? fromEnv : DEFAULT_TARGETS;
  }

  @Get(':idx')
  proxy(
    @Param('idx') idx: string,
    @Req() req: IncomingMessage,
    @Res() res: ServerResponse,
  ) {
    const index = Number(idx);
    const target = Number.isInteger(index) ? this.targets[index] : undefined;
    if (!target) throw new NotFoundException('Stream não configurado');

    const client = target.startsWith('https') ? https : http;
    const upstream = client.get(
      target,
      { headers: { 'user-agent': 'FuseRadioProxy/1.0', 'icy-metadata': '0' } },
      (up) => {
        res.statusCode = up.statusCode ?? 200;
        res.setHeader('content-type', String(up.headers['content-type'] ?? 'audio/mpeg'));
        res.setHeader('access-control-allow-origin', '*');
        res.setHeader('cache-control', 'no-store');
        res.setHeader('x-fuse-proxied', '1');
        up.pipe(res);
        up.on('error', () => res.end());
      },
    );

    upstream.setTimeout(15_000, () => upstream.destroy());
    upstream.on('error', () => {
      if (!res.headersSent) res.statusCode = 502;
      res.end();
    });
    // Ouvinte desconectou: encerra a conexão com a origem imediatamente.
    req.on('close', () => upstream.destroy());
  }
}
