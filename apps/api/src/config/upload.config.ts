import { join } from 'path';

/**
 * Diretório de mídia enviada pela central (avisos, vinhetas, signage).
 * Em produção com múltiplas réplicas, use volume compartilhado ou S3/R2
 * (ver docs/DEPLOY.md).
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
