FROM node:20-slim

# Dependências de build para o better-sqlite3 (módulo nativo)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Banco de dados e imagens enviadas ficam aqui — monte um Volume do EasyPanel
# neste caminho para não perder dados a cada deploy.
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
