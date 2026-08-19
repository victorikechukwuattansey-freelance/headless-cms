FROM node:22-alpine AS builder

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci --workspace @sales_assistant/api

COPY . .

RUN npm --workspace @sales_assistant/api run build

CMD ["node", "packages/api/dist/index.js"]