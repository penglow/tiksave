FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=development

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["bun", "run", "dev"]
