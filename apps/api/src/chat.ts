import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Request } from 'express';
import { AuthGuard } from './auth.guard';
import { DatabaseService } from './database.service';
import { OpenAIService } from './openai.service';

class AskDto {
  @IsString()
  @MaxLength(4000)
  question!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

type AuthedRequest = Request & { user: { sub: string } };

@Injectable()
export class ChatService {
  constructor(
    private db: DatabaseService,
    private ai: OpenAIService,
  ) {}

  async ask(organizationId: string, userId: string, dto: AskDto) {
    await this.requireMember(organizationId, userId);

    if (dto.conversationId) {
      await this.requireConversation(organizationId, dto.conversationId);
    }

    const queryEmbedding = (await this.ai.embed(dto.question))[0];
    const matches = await this.db.query(
      `
        SELECT
          c.content,
          d.id document_id,
          d.filename,
          1 - (c.embedding <=> $2::vector) similarity
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.organization_id = $1
          AND d.status = 'ready'
        ORDER BY c.embedding <=> $2::vector
        LIMIT 6
      `,
      [organizationId, `[${queryEmbedding.join(',')}]`],
    );

    const context = matches.rows
      .map((match: any, index: number) => `[${index + 1}] ${match.content}`)
      .join('\n\n');

    const text = await this.ai.answer(
      dto.question,
      context || 'No documents have been uploaded.',
    );

    const conversationId =
      dto.conversationId ||
      (
        await this.db.query(
          'INSERT INTO conversations(organization_id,title) VALUES($1,$2) RETURNING id',
          [organizationId, dto.question.slice(0, 70)],
        )
      ).rows[0].id;

    const citations = matches.rows.map((match: any, index: number) => ({
      number: index + 1,
      documentId: match.document_id,
      filename: match.filename,
      excerpt: match.content.slice(0, 200),
      similarity: Number(match.similarity),
    }));

    await this.db.query(
      `
        INSERT INTO messages(conversation_id, role, content, citations)
        VALUES
          ($1, 'user', $2, '[]'::jsonb),
          ($1, 'assistant', $3, $4::jsonb)
      `,
      [conversationId, dto.question, text, JSON.stringify(citations)],
    );

    return { conversationId, answer: text, citations };
  }

  async list(organizationId: string, userId: string) {
    await this.requireMember(organizationId, userId);

    return (
      await this.db.query(
        `
          SELECT
            c.id,
            c.title,
            c.created_at,
            COUNT(m.id)::int message_count,
            MAX(m.created_at) last_message_at
          FROM conversations c
          LEFT JOIN messages m ON m.conversation_id = c.id
          WHERE c.organization_id = $1
          GROUP BY c.id
          ORDER BY COALESCE(MAX(m.created_at), c.created_at) DESC
          LIMIT 50
        `,
        [organizationId],
      )
    ).rows;
  }

  async messages(organizationId: string, userId: string, conversationId: string) {
    await this.requireMember(organizationId, userId);
    await this.requireConversation(organizationId, conversationId);

    return (
      await this.db.query(
        `
          SELECT id, role, content, citations, created_at
          FROM messages
          WHERE conversation_id = $1
          ORDER BY created_at ASC
        `,
        [conversationId],
      )
    ).rows;
  }

  private async requireMember(organizationId: string, userId: string) {
    const member = await this.db.query(
      'SELECT 1 FROM memberships WHERE organization_id=$1 AND user_id=$2',
      [organizationId, userId],
    );

    if (!member.rows[0]) {
      throw new BadRequestException('Organization access denied');
    }
  }

  private async requireConversation(organizationId: string, conversationId: string) {
    const conversation = await this.db.query(
      'SELECT 1 FROM conversations WHERE organization_id=$1 AND id=$2',
      [organizationId, conversationId],
    );

    if (!conversation.rows[0]) {
      throw new BadRequestException('Conversation not found');
    }
  }
}

@Controller('organizations/:organizationId/chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private chat: ChatService) {}

  @Get('conversations')
  list(@Param('organizationId') id: string, @Req() req: AuthedRequest) {
    return this.chat.list(id, req.user.sub);
  }

  @Get('conversations/:conversationId/messages')
  messages(
    @Param('organizationId') id: string,
    @Param('conversationId') conversationId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.chat.messages(id, req.user.sub, conversationId);
  }

  @Post()
  ask(
    @Param('organizationId') id: string,
    @Body() dto: AskDto,
    @Req() req: AuthedRequest,
  ) {
    return this.chat.ask(id, req.user.sub, dto);
  }
}
