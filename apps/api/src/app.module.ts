import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController, AuthService } from './auth';
import { ChatController, ChatService } from './chat';
import { DatabaseService } from './database.service';
import { DocumentsController, DocumentsService } from './documents';
import { OpenAIService } from './openai.service';
import { StorageService } from './storage.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] })], controllers: [AuthController, DocumentsController, ChatController], providers: [DatabaseService, StorageService, OpenAIService, AuthService, DocumentsService, ChatService] })
export class AppModule {}
