FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY . /app
RUN npm install
CMD ["npm", "run", "dev", "-w", "@knowledgehub/api"]
