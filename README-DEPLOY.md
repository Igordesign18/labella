# Deploy — Labella Woman (site + painel, sem Supabase)

O Supabase foi completamente removido. Agora o site e o painel usam um
backend próprio (Node/Express + SQLite), rodando dentro do mesmo container
que você já usa nos outros projetos.

## Estrutura
```
labella/
├── index.html          → site (raiz do domínio)
├── style.css
├── script.js            → consome /api/... em vez do Supabase
├── images/              → ⚠️ FALTAM AS IMAGENS (veja abaixo)
├── painel.html           → painel admin, acessível em /painel
├── server.js             → backend Express (API + serve os arquivos estáticos)
├── db.js                 → schema do SQLite e inicialização do banco
├── package.json
├── .env.example           → copie para .env e ajuste
├── Dockerfile
└── .gitignore
```

## ⚠️ Antes de subir: imagens do site (hero/modelo)
O site referencia `/images/LabellaWoman.jpg` e `/images/Model.jpg`, mas esses
arquivos não vieram no material original. Coloque as duas imagens dentro da
pasta `images/` antes de dar push, senão o hero e a imagem em tela cheia do
site quebram.

## ⚠️ Imagens de produtos/hero cadastradas no Supabase Storage
Como o Supabase saiu completamente, **as imagens de produtos e a imagem do
hero que estavam no Supabase Storage não migram sozinhas** — o link antigo
(`https://boqhqpawylckzjoskgcp.supabase.co/...`) deixa de existir para você.
Depois do deploy, entre no painel (`/painel`) e reenvie a foto de cada
produto e a imagem do hero pela própria tela — agora elas ficam salvas no
seu próprio servidor, dentro do volume persistente (veja abaixo).

## O que mudou tecnicamente
- **Banco de dados**: SQLite próprio (`data/labella.db`), com as mesmas
  tabelas que existiam no Supabase (`categories`, `products`,
  `product_colors`, `site_config`).
- **Upload de imagens**: agora sobe para `/app/data/uploads/products` e
  `/app/data/uploads/hero` no seu próprio servidor, servidas em
  `/uploads/...`.
- **Login do painel**: a chave de acesso fica no próprio `painel.html`
  (constante `ADMIN_ACCESS_KEY`, a mesma de sempre:
  `eb1358de-884a-4bc2-aba5-d4dedf0c662d`). O servidor também confere essa
  chave nas rotas `/api/admin/...` (padrão via `ADMIN_KEY`, configurável no
  `.env`) — **se você trocar a chave, troque nos dois lugares**: dentro de
  `painel.html` e na variável `ADMIN_KEY` do `.env`.
- **E-mail do rodapé**: não usa mais a ofuscação da Cloudflare (só funciona
  atrás do proxy deles). Agora é um `mailto:` normal.

## Passo a passo GitHub + EasyPanel

1. **Criar repositório no GitHub**
   - Suba todos os arquivos desta pasta, mantendo a estrutura (inclusive
     `painel/`). Não precisa subir `node_modules/` (o `.gitignore` já
     exclui).

2. **Configurar variáveis de ambiente no EasyPanel**
   - Copie o conteúdo de `.env.example` para as variáveis de ambiente do
     app no EasyPanel (ou crie um `.env` — o `.gitignore` já o ignora).
   - No mínimo, confira/troque `ADMIN_KEY`.

3. **Criar Volume persistente** (importante!)
   - Sem isso, toda vez que você der um novo deploy, o banco de dados e as
     imagens enviadas pelo painel são apagados.
   - No EasyPanel, crie um Volume apontando para `/app/data` dentro do
     container.

4. **Criar o app no EasyPanel**
   - Fonte: **GitHub** → conecte o repositório.
   - Build: **Dockerfile** (detectado automaticamente).
   - Porta interna: `3000` (a que o `server.js` expõe).

5. **Domínio**
   - Site principal: `https://seudominio.com/`
   - Painel: `https://seudominio.com/painel`

6. **Deploy**
   - Salve e clique em Deploy. Ative redeploy automático via webhook do
     GitHub, se quiser.

7. **Depois do primeiro deploy**
   - Acesse `/painel`, faça login com a chave de acesso, e cadastre suas
     categorias, produtos (com as imagens reenviadas) e as configurações
     do site (hero, contato, redes sociais, cores).

## Observação sobre segurança do painel
O acesso ao `/painel` continua sendo por uma chave única, embutida no
próprio `painel.html` — quem abrir o código-fonte da página (Ctrl+U no
navegador) consegue ver essa chave, então o link do painel não deve
circular publicamente. Se quiser, posso evoluir para um login com usuário
e senha de verdade antes de você publicar.
