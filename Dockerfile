FROM oven/bun:1.4-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# The server bundles src/ at startup (bunfig.toml loads the xp.css fix plugin) and serves public/ drop-ins.
COPY bunfig.toml xp-css-fix.ts tsconfig.json ./
COPY src ./src
COPY public ./public

USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["bun", "src/index.ts"]
