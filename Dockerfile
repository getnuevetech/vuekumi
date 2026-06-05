FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4180
ENV DATA_DIR=/data

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /data

EXPOSE 4180

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4180) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
