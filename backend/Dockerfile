FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY --chown=10001:10001 package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force && mkdir /data && chown 10001:10001 /data
COPY --chown=10001:10001 *.mjs ./
USER 10001:10001
ENV NODE_ENV=production PORT=8080 FINANCE_STORE=sqlite SQLITE_PATH=/data/finance.sqlite
EXPOSE 8080
CMD ["node", "server.mjs"]
