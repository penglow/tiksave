FROM oven/bun:1

WORKDIR /app

ENV EXPO_NO_TELEMETRY=1

COPY package.json bun.lock ./
RUN bun install

COPY . .

EXPOSE 8081

CMD ["bunx", "expo", "start", "--web", "--host", "lan", "--port", "8081"]
