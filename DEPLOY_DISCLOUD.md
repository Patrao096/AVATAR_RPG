# Correções de deploy — Discloud

A tela "Site em manutenção" da Discloud aparece quando uma aplicação está offline. O código em si funciona (build e boot testados), mas duas configurações de deploy derrubavam os apps. Ambas corrigidas.

## Bug 1 — Bot caía no build (causa direta de ficar offline)

O `bot/discloud.config` usava `BUILD=npm ci --production`. O comando `npm ci` **exige um `package-lock.json`**, que não existe no pacote (lockfiles são ignorados pelo `.gitignore`). Sem o lockfile, o `npm ci` falha na hora, o build não termina e o bot nunca sobe.

Reproduzi o erro:
```
npm error code EUSAGE
npm error The `npm ci` command can only install with an existing package-lock.json
```

Corrigido para `BUILD=npm install --omit=dev`, que instala sem depender de lockfile.

## Bug 2 — Backend podia exceder o timeout de boot

O backend rodava `prisma db push` a cada inicialização (dentro do `server.js`). Isso é lento (depende de rede até o banco) e, num cold start na Discloud, pode passar do tempo limite de boot — fazendo a Discloud matar o processo antes de ele abrir a porta.

Mudanças:
- O `db push` agora roda no **BUILD** do deploy (`backend/discloud.config`), uma vez, quando há tempo — não a cada boot.
- No `server.js`, a sincronização no boot passou a ser opt-in pela variável `DB_PUSH_ON_BOOT` (padrão desligado). O boot agora é rápido: conecta no banco e abre a porta.

Boot testado: sobe em segundos e responde HTTP 200.

## Configs finais

```
backend: BUILD=npm install && npx prisma generate && npx prisma db push --skip-generate --accept-data-loss
bot:     BUILD=npm install --omit=dev
frontend: BUILD=npm install && npm run build
```

## O que conferir no painel da Discloud

As variáveis de ambiente precisam estar configuradas em cada app (o `.env` vai junto no upload, mas confirme):

- **backend** (`avatar-rpg-server`): `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `BOT_INTERNAL_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `ADMIN_DISCORD_IDS`, `FRONTEND_URL`. Opcional: `DB_PUSH_ON_BOOT` (deixe `false` ou não defina).
- **bot** (`avatar-rpg-bot`): `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `API_URL` (URL do backend, nunca localhost), `BOT_INTERNAL_SECRET` (igual ao do backend), `ADMIN_DISCORD_IDS`.
- **frontend** (`avatar-rpg`): `VITE_API_URL` (URL do backend).

## Ordem de deploy recomendada

1. Backend primeiro (precisa do banco acessível). Confira nos logs: "Banco conectado" e "Backend rodando".
2. Bot e frontend depois.

Se algum continuar offline após isso, os **logs da Discloud** mostram a causa exata (erro de build ou de boot). O código e os configs deste pacote já foram testados rodando de verdade.
