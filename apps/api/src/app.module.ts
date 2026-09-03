import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController, AuthService } from './auth';
import { ChatController, ChatService } from './chat';
import { DatabaseService } from './database.service';
import { DocumentJobsService, DocumentProcessorService } from './document-jobs';
import { DocumentsController, DocumentsService } from './documents';
import { OpenAIService } from './openai.service';
import { OrganizationsController, OrganizationsService } from './organizations';
import { StorageService } from './storage.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
  ],
  controllers: [
    AuthController,
    DocumentsController,
    ChatController,
    OrganizationsController,
  ],
  providers: [
    DatabaseService,
    StorageService,
    OpenAIService,
    AuthService,
    DocumentProcessorService,
    DocumentJobsService,
    DocumentsService,
    ChatService,
    OrganizationsService,
  ],
})
export class AppModule {}
