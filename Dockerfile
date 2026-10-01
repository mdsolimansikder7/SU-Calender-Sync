FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY app ./app
COPY lib ./lib
COPY public ./public
COPY next.config.mjs jsconfig.json ./
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server.js"]
