FROM node:20-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.html vite.config.js server.js package.json ./
RUN npx vite build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json
RUN npm install --omit=dev
ENV PORT=7860
EXPOSE 7860
CMD ["node", "server.js"]
