import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private client?: OpenAI;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  private get api() {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is required for document processing and chat',
      );
    }

    return this.client;
  }

  async embed(input: string | string[]) {
    const response = await this.api.embeddings.create({
      model: 'text-embedding-3-small',
      input,
    });

    return response.data.map((item) => item.embedding);
  }

  async answer(question: string, context: string) {
    const response = await this.api.responses.create({
      model: 'gpt-5.6-terra',
      input: [
        'Answer only from the provided knowledge.',
        'If it is insufficient, say so.',
        '',
        `KNOWLEDGE:\n${context}`,
        '',
        `QUESTION: ${question}`,
      ].join('\n'),
    });

    return response.output_text;
  }
}
