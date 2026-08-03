# KnowledgeHub
# Atlas

Atlas is the first working milestone of an AI knowledge-base SaaS: accounts create an organization, admins upload PDF/DOCX/Markdown files, and members can ask questions with retrieved source citations.

## Run locally

1. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` and `JWT_SECRET`.
2. Start the local services: `docker compose up -d`.
3. Install dependencies: `npm install`.
4. Start web and API together: `npm run dev`.
5. Open `http://localhost:5173`, register, upload a document, then ask a question.

The API runs on port 3000, PostgreSQL with pgvector on 5432, Redis on 6379, and MinIO (S3-compatible storage) on 9000. The MinIO console is available on port 9001.

## What is implemented

- JWT registration/login and a default owner workspace
- Organization-scoped role checks (owner/admin/member)
- S3-compatible document storage with PDF, DOCX, Markdown, and text extraction
- OpenAI embeddings stored in PostgreSQL pgvector and semantic top-k retrieval
- OpenAI Responses API answers, stored conversation messages, and returned citations

Redis, Stripe, background queues, analytics, GitHub Actions, and Terraform deployment are the next layers; they are intentionally not wired into this first vertical slice.
