import { BadRequestException, Controller, Get, Injectable, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import { AuthGuard } from './auth.guard';
import { DatabaseService } from './database.service';
import { OpenAIService } from './openai.service';
import { StorageService } from './storage.service';
type AuthedRequest = Request & { user: { sub: string } };
const accepted = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/plain'];
@Injectable()
export class DocumentsService {
  constructor(private db: DatabaseService, private storage: StorageService, private ai: OpenAIService) {}
  private async member(organizationId: string, userId: string) { const r = await this.db.query('SELECT role FROM memberships WHERE organization_id=$1 AND user_id=$2', [organizationId, userId]); if (!r.rows[0]) throw new BadRequestException('Organization access denied'); return r.rows[0]; }
  async list(organizationId: string, userId: string) { await this.member(organizationId, userId); return (await this.db.query('SELECT id,filename,mime_type,status,created_at FROM documents WHERE organization_id=$1 ORDER BY created_at DESC', [organizationId])).rows; }
  async upload(organizationId: string, userId: string, file: Express.Multer.File) {
    const membership = await this.member(organizationId, userId); if (!['owner', 'admin'].includes(membership.role)) throw new BadRequestException('Only admins can add documents');
    if (!accepted.includes(file.mimetype) && !/\.(md|markdown|txt)$/i.test(file.originalname)) throw new BadRequestException('Only PDF, DOCX, Markdown, and text files are supported');
    const key = `${organizationId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    const doc = await this.db.query('INSERT INTO documents(organization_id,filename,storage_key,mime_type) VALUES($1,$2,$3,$4) RETURNING id,filename,status', [organizationId, file.originalname, key, file.mimetype]);
    try { const text = await extract(file); const chunks = chunk(text); const embeddings = await this.ai.embed(chunks); const client = await this.db.connect(); try { await client.query('BEGIN'); for (let i = 0; i < chunks.length; i++) await client.query('INSERT INTO document_chunks(document_id,content,chunk_index,embedding) VALUES($1,$2,$3,$4::vector)', [doc.rows[0].id, chunks[i], i, `[${embeddings[i].join(',')}]`]); await client.query("UPDATE documents SET status='ready' WHERE id=$1", [doc.rows[0].id]); await client.query('COMMIT'); } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); } } catch (e) { await this.db.query("UPDATE documents SET status='failed' WHERE id=$1", [doc.rows[0].id]); throw e; }
    return doc.rows[0];
  }
}
@Controller('organizations/:organizationId/documents') @UseGuards(AuthGuard)
export class DocumentsController {
  constructor(private documents: DocumentsService) {}
  @Get() list(@Param('organizationId') organizationId: string, @Req() req: AuthedRequest) { return this.documents.list(organizationId, req.user.sub); }
  @Post() @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(@Param('organizationId') organizationId: string, @UploadedFile() file: Express.Multer.File, @Req() req: AuthedRequest) { if (!file) throw new BadRequestException('A file is required'); return this.documents.upload(organizationId, req.user.sub, file); }
}
async function extract(file: Express.Multer.File) { if (file.mimetype === 'application/pdf') return (await pdf(file.buffer)).text; if (file.mimetype.includes('wordprocessingml')) return (await mammoth.extractRawText({ buffer: file.buffer })).value; return file.buffer.toString('utf8'); }
function chunk(text: string) { const size = 1400, overlap = 200; const clean = text.replace(/\s+/g, ' ').trim(); const chunks: string[] = []; for (let start = 0; start < clean.length; start += size - overlap) chunks.push(clean.slice(start, start + size)); return chunks.filter(Boolean); }
