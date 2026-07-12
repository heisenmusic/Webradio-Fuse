/**
 * Seed inicial do Fuse Radio Enterprise.
 *
 * Cria o tenant de demonstração, a estação com os 3 streams (failover),
 * uma loja e o usuário administrador padrão:
 *
 *   e-mail: admin@fuse.local
 *   senha:  FuseAdmin@2026
 *
 * ⚠ Troque a senha no primeiro acesso em produção.
 *
 * Uso: pnpm --filter @fuse/api db:seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@fuse.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'FuseAdmin@2026';

const STREAM_ENDPOINTS = [
  'https://centova2.svdns.com.br:20028/stream',
  'https://centova2.svdns.com.br:20028/live',
  'https://centova2.svdns.com.br:20028/',
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'fuse-varejo' },
    update: {},
    create: {
      slug: 'fuse-varejo',
      name: 'Fuse Varejo S.A.',
      primaryColor: '#6d5efc',
      accentColor: '#22d3ee',
    },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Administrador Fuse',
      role: 'SUPER_ADMIN',
      tenantId: tenant.id,
    },
  });

  let station = await prisma.station.findFirst({
    where: { tenantId: tenant.id, name: 'Fuse Radio' },
  });
  if (!station) {
    station = await prisma.station.create({
      data: {
        tenantId: tenant.id,
        name: 'Fuse Radio',
        endpoints: {
          create: STREAM_ENDPOINTS.map((url, priority) => ({ url, priority })),
        },
      },
    });
  }

  await prisma.store.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'LOJA-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      stationId: station.id,
      code: 'LOJA-001',
      name: 'Loja Matriz',
      city: 'São Paulo',
      state: 'SP',
      timezone: 'America/Sao_Paulo',
      lat: -23.5505,
      lng: -46.6333,
    },
  });

  console.log('✔ Seed concluído.');
  console.log(`  Usuário administrador: ${ADMIN_EMAIL}`);
  console.log(`  Senha: ${ADMIN_PASSWORD === 'FuseAdmin@2026' ? 'FuseAdmin@2026 (padrão — troque em produção)' : '(definida via SEED_ADMIN_PASSWORD)'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
