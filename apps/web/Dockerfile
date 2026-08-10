FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY . /app
RUN npm install
CMD ["sh", "-c", "npm run dev -w @knowledgehub/web -- --host 0.0.0.0"]
