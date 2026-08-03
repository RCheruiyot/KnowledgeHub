import { Body, Controller, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { DatabaseService } from './database.service';
import { OpenAIService } from './openai.service';
class AskDto { @IsString() @MaxLength(4000) question!: string; @IsOptional() @IsUUID() conversationId?: string; }
type AuthedRequest = Request & { user: { sub: string } };
@Injectable()
export class ChatService {
  constructor(private db: DatabaseService, private ai: OpenAIService) {}
  async ask(organizationId: string, userId: string, dto: AskDto) {
    const member = await this.db.query('SELECT 1 FROM memberships WHERE organization_id=$1 AND user_id=$2', [organizationId, userId]); if (!member.rows[0]) throw new Error('Organization access denied');
    const queryEmbedding = (await this.ai.embed(dto.question))[0];
    const matches = await this.db.query(`SELECT c.content,d.id document_id,d.filename,1-(c.embedding <=> $2::vector) similarity FROM document_chunks c JOIN documents d ON d.id=c.document_id WHERE d.organization_id=$1 AND d.status='ready' ORDER BY c.embedding <=> $2::vector LIMIT 6`, [organizationId, `[${queryEmbedding.join(',')}]`]);
    const context = matches.rows.map((m: any, i: number) => `[${i + 1}] ${m.content}`).join('\n\n');
    const text = await this.ai.answer(dto.question, context || 'No documents have been uploaded.');
    const conversationId = dto.conversationId || (await this.db.query('INSERT INTO conversations(organization_id,title) VALUES($1,$2) RETURNING id', [organizationId, dto.question.slice(0, 70)])).rows[0].id;
    const citations = matches.rows.map((m: any, i: number) => ({ number: i + 1, documentId: m.document_id, filename: m.filename, excerpt: m.content.slice(0, 200), similarity: Number(m.similarity) }));
    await this.db.query("INSERT INTO messages(conversation_id,role,content) VALUES($1,'user',$2),($1,'assistant',$3,$4)", [conversationId, dto.question, text, JSON.stringify(citations)]);
    return { conversationId, answer: text, citations };
  }
}
@Controller('organizations/:organizationId/chat') @UseGuards(AuthGuard)
export class ChatController { constructor(private chat: ChatService) {} @Post() ask(@Param('organizationId') id: string, @Body() dto: AskDto, @Req() req: AuthedRequest) { return this.chat.ask(id, req.user.sub, dto); } }
