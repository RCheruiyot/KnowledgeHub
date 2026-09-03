import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import { DatabaseService } from './database.service';
import { OpenAIService } from './openai.service';
import { StorageService } from './storage.service';

@Injectable()
export class DocumentProcessorService {
  constructor(
    private db: DatabaseService,
    private storage: StorageService,
    private ai: OpenAIService,
  ) {}

  async process(documentId: string) {
    const result = await this.db.query(
      `
        SELECT id, storage_key, mime_type
        FROM documents
        WHERE id = $1
      `,
      [documentId],
    );
    const document = result.rows[0];

    // The document may have been deleted while its job was waiting.
    if (!document) {
      return;
    }

    try {
      const buffer = await this.storage.get(document.storage_key);
      const text = await extractText(buffer, document.mime_type);
      const chunks = splitIntoChunks(text);

      if (chunks.length === 0) {
        throw new Error('No extractable text was found in this document');
      }

      const embeddings = await this.ai.embed(chunks);
      const client = await this.db.connect();

      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM document_chunks WHERE document_id=$1', [documentId]);

        for (let index = 0; index < chunks.length; index += 1) {
          await client.query(
            `
              INSERT INTO document_chunks(document_id, content, chunk_index, embedding)
              VALUES($1, $2, $3, $4::vector)
            `,
            [documentId, chunks[index], index, `[${embeddings[index].join(',')}]`],
          );
        }

        await client.query("UPDATE documents SET status='ready' WHERE id=$1", [documentId]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      await this.db.query("UPDATE documents SET status='failed' WHERE id=$1", [documentId]);
      throw error;
    }
  }
}

@Injectable()
export class DocumentJobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentJobsService.name);
  private readonly queue: string[] = [];
  private readonly queuedDocumentIds = new Set<string>();
  private isWorking = false;

  constructor(
    private db: DatabaseService,
    private processor: DocumentProcessorService,
  ) {}

  async onApplicationBootstrap() {
    const documents = await this.db.query(
      "SELECT id FROM documents WHERE status='processing' ORDER BY created_at ASC",
    );

    for (const document of documents.rows) {
      this.enqueue(document.id);
    }
  }

  enqueue(documentId: string) {
    if (this.queuedDocumentIds.has(documentId)) {
      return;
    }

    this.queuedDocumentIds.add(documentId);
    this.queue.push(documentId);
    setImmediate(() => void this.work());
  }

  private async work() {
    if (this.isWorking) {
      return;
    }

    this.isWorking = true;

    try {
      while (this.queue.length > 0) {
        const documentId = this.queue.shift();

        if (!documentId) {
          continue;
        }

        try {
          await this.processor.process(documentId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Document ${documentId} failed: ${message}`);
        } finally {
          this.queuedDocumentIds.delete(documentId);
        }
      }
    } finally {
      this.isWorking = false;
    }
  }
}

async function extractText(buffer: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') {
    return (await pdf(buffer)).text;
  }

  if (mimeType.includes('wordprocessingml')) {
    return (await mammoth.extractRawText({ buffer })).value;
  }

  return buffer.toString('utf8');
}

function splitIntoChunks(text: string) {
  const size = 1400;
  const overlap = 200;
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const chunks: string[] = [];

  for (let start = 0; start < cleanText.length; start += size - overlap) {
    chunks.push(cleanText.slice(start, start + size));
  }

  return chunks.filter(Boolean);
}
