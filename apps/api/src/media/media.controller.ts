import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { UPLOAD_DIR } from '../config/upload.config';
import { MediaService } from './media.service';

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME = /^(audio|image|video)\//;

@Controller('media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @Roles('VIEWER')
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('kind') kind?: 'AUDIO' | 'IMAGE' | 'VIDEO',
  ) {
    return this.media.list(user.tenantId ?? '', kind);
  }

  /** Upload de MP3/WAV/OGG, imagens e vídeos para avisos, vinhetas e signage. */
  @Post()
  @Roles('MANAGER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
        filename: (_req, file, cb) =>
          cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.test(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Tipo de arquivo não permitido'), false);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    if (!file) throw new BadRequestException('Arquivo ausente (campo "file")');
    const kind = MediaService.kindFromMime(file.mimetype);
    if (!kind) throw new BadRequestException('Tipo de mídia não suportado');
    return this.media.register({
      tenantId: user.tenantId ?? '',
      kind,
      name: file.originalname,
      url: `/uploads/${file.filename}`,
      mime: file.mimetype,
      sizeBytes: file.size,
    });
  }

  @Delete(':id')
  @Roles('MANAGER')
  remove(@Param('id') id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.media.remove(id, user.tenantId ?? '');
  }
}
