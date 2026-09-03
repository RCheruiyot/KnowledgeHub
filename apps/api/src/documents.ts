import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { DatabaseService } from './database.service';
import { DocumentJobsService } from './document-jobs';
import { StorageService } from './storage.service';

type AuthedRequest = Request & { user: { sub: string } };
type MemberRole = 'owner' | 'admin' | 'member';

const acceptedMimeTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
  'text/plain',
];

@Injectable()
export class DocumentsService {
  constructor(
    private db: DatabaseService,
    private storage: StorageService,
    private jobs: DocumentJobsService,
  ) {}

  async list(organizationId: string, userId: string) {
    await this.member(organizationId, userId);

    return (
      await this.db.query(
        `
          SELECT
            d.id,
            d.filename,
            d.mime_type,
            d.status,
            d.created_at,
            COUNT(c.id)::int chunk_count
          FROM documents d
          LEFT JOIN document_chunks c ON c.document_id = d.id
          WHERE d.organization_id = $1
          GROUP BY d.id
          ORDER BY d.created_at DESC
        `,
        [organizationId],
      )
    ).rows;
  }

  async detail(organizationId: string, userId: string, documentId: string) {
    await this.member(organizationId, userId);
    const document = await this.requireDocument(organizationId, documentId);
    const chunks = await this.db.query(
      `
        SELECT id, chunk_index, content
        FROM document_chunks
        WHERE document_id = $1
        ORDER BY chunk_index ASC
        LIMIT 10
      `,
      [documentId],
    );

    return {
      ...document,
      chunks: chunks.rows.map((chunk) => ({
        ...chunk,
        preview: chunk.content.slice(0, 500),
      })),
    };
  }

  async upload(organizationId: string, userId: string, file: Express.Multer.File) {
    await this.requireDocumentManager(organizationId, userId);
    this.requireSupportedFile(file);

    const key = `${organizationId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    const document = await this.db.query(
      `
        INSERT INTO documents(organization_id, filename, storage_key, mime_type)
        VALUES($1, $2, $3, $4)
        RETURNING id, filename, mime_type, status, created_at
      `,
      [organizationId, file.originalname, key, file.mimetype],
    );

    this.jobs.enqueue(document.rows[0].id);

    return this.detail(organizationId, userId, document.rows[0].id);
  }

  async reprocess(organizationId: string, userId: string, documentId: string) {
    await this.requireDocumentManager(organizationId, userId);
    await this.requireDocument(organizationId, documentId);

    await this.db.query("UPDATE documents SET status='processing' WHERE id=$1", [documentId]);
    this.jobs.enqueue(documentId);

    return this.detail(organizationId, userId, documentId);
  }

  async remove(organizationId: string, userId: string, documentId: string) {
    await this.requireDocumentManager(organizationId, userId);
    const document = await this.requireDocument(organizationId, documentId);

    await this.db.query('DELETE FROM documents WHERE id=$1 AND organization_id=$2', [
      documentId,
      organizationId,
    ]);

    await this.storage.remove(document.storage_key);

    return { ok: true };
  }

  private async member(organizationId: string, userId: string) {
    const result = await this.db.query(
      'SELECT role FROM memberships WHERE organization_id=$1 AND user_id=$2',
      [organizationId, userId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Organization access denied');
    }

    return result.rows[0] as { role: MemberRole };
  }

  private async requireDocumentManager(organizationId: string, userId: string) {
    const membership = await this.member(organizationId, userId);

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new BadRequestException('Only admins can manage documents');
    }
  }

  private async requireDocument(organizationId: string, documentId: string) {
    const result = await this.db.query(
      `
        SELECT
          d.id,
          d.filename,
          d.storage_key,
          d.mime_type,
          d.status,
          d.created_at,
          COUNT(c.id)::int chunk_count
        FROM documents d
        LEFT JOIN document_chunks c ON c.document_id = d.id
        WHERE d.organization_id = $1
          AND d.id = $2
        GROUP BY d.id
      `,
      [organizationId, documentId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException('Document not found');
    }

    return result.rows[0];
  }

  private requireSupportedFile(file: Express.Multer.File) {
    const hasSupportedMimeType = acceptedMimeTypes.includes(file.mimetype);
    const hasSupportedExtension = /\.(md|markdown|txt)$/i.test(file.originalname);

    if (!hasSupportedMimeType && !hasSupportedExtension) {
      throw new BadRequestException(
        'Only PDF, DOCX, Markdown, and text files are supported',
      );
    }
  }
}

@Controller('organizations/:organizationId/documents')
@UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get()
  list(@Param('organizationId') organizationId: string, @Req() req: AuthedRequest) {
    return this.documents.list(organizationId, req.user.sub);
  }

  @Get(':documentId')
  detail(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.documents.detail(organizationId, req.user.sub, documentId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(
    @Param('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }

    return this.documents.upload(organizationId, req.user.sub, file);
  }

  @Post(':documentId/reprocess')
  reprocess(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.documents.reprocess(organizationId, req.user.sub, documentId);
  }

  @Delete(':documentId')
  remove(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.documents.remove(organizationId, req.user.sub, documentId);
  }
}
