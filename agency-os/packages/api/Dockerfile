FROM node:20-alpine AS builder
WORKDIR /packages/api
COPY . .
RUN npm install && npm run build

FROM node:20-alpine
WORKDIR /packages/api
COPY --from=builder /packages/api/dist ./dist
COPY --from=builder /packages/api/node_modules ./node_modules
COPY --from=builder /packages/api/package.json ./
EXPOSE 4000
CMD ["node", "dist/index.js"]