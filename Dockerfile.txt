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

# Porta fixada em 80 para bater exatamente com o que está configurado na aba
# "Domínios" do EasyPanel — antes o app rodava na 80 (por causa de uma
# variável de ambiente) mas o Dockerfile declarava 3000, essa inconsistência
# provavelmente fazia o EasyPanel checar a porta errada e reiniciar o
# container sozinho de tempos em tempos.
ENV PORT=80
EXPOSE 80

CMD ["node", "server.js"]
