# Avatar RPG

RPG por turnos com tema dos quatro elementos, jogável pelo site e por um bot do Discord. O projeto é um monorepo com três serviços independentes que compartilham o mesmo backend.

```
avatar-rpg/
├── backend/    API REST (Express + Prisma + PostgreSQL)
├── bot/        Bot do Discord (discord.js v14, painel interativo)
└── frontend/   Aplicação web (React + Vite + Tailwind)
```

## Visão geral

O backend é a única fonte de verdade. O site e o bot consomem a mesma API, então o progresso é compartilhado: o jogador pode batalhar pelo Discord e ver o resultado no site, ou comprar na loja pelo site e equipar pelo bot.

O bot usa um painel central interativo (`/painel`): em vez de dezenas de comandos, há um menu suspenso para navegar entre seções e selects/modals para as ações, mantendo a mesma identidade visual do site.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior
- Uma aplicação registrada no Discord Developer Portal (client id, secret e bot token)
- Conta no Mercado Pago para pagamentos (opcional, só para premium)

## Configuração rápida

Cada serviço tem o seu próprio `.env`. Copie o exemplo e preencha:

```bash
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
cp frontend/.env.example frontend/.env
```

Pontos de atenção:

- `BOT_INTERNAL_SECRET` precisa ser idêntico no backend e no bot.
- `ADMIN_DISCORD_IDS` é a lista de administradores, igual nos dois serviços.
- `API_URL` no bot e `VITE_API_URL` no frontend apontam para o backend. Em hospedagem, nunca use `localhost`.

## Backend

```bash
cd backend
npm install
npm run db:push        # sincroniza o banco com o schema (recomendado)
npm run db:generate    # gera o client do Prisma
npm start              # ou: npm run dev (com reload)
```

A API sobe na porta definida em `PORT` (padrão 5000).

> O backend também sincroniza o schema automaticamente no boot via `db push`. Para desligar isso (e gerenciar o banco manualmente), defina `SKIP_DB_PUSH=true` e rode `npm run db:push` você mesmo após cada mudança no schema. As migrations em `prisma/migrations/` servem como histórico; o caminho suportado para criar o banco é o `db push`, que reflete o schema exatamente.

## Bot

```bash
cd bot
npm install
npm start              # ou: npm run dev
```

Na primeira execução o bot registra os comandos `/painel` e `/dashboard`. Com `DEV_GUILD_ID` preenchido, os comandos aparecem na hora no servidor de testes; sem ele, o registro é global e leva até uma hora para propagar.

## Frontend

```bash
cd frontend
npm install
npm run build          # gera dist/
npm start              # serve dist/ na porta PORT (padrão 8080)
```

Durante o desenvolvimento, `npm run dev` sobe o Vite com hot reload.

> O `dist/` não é versionado. Rode `npm run build` antes de subir o frontend para produção.

## Estrutura do bot

```
bot/src/
├── index.js              ponto de entrada e roteamento de interações
├── api.js                cliente HTTP do backend
├── cache.js              cache em memória e throttle
├── config.js             variáveis de ambiente e constantes
├── registerCommands.js   registro dos slash commands
├── panel/
│   ├── home.js           tela inicial com menu de navegação
│   ├── builders.js       embeds, selects, modals e formatadores
│   ├── index.js          despacha interações para cada seção
│   └── sections/         uma seção por arquivo (perfil, loja, clã, combate…)
└── utils/                custom ids e permissões
```

Cada seção expõe um `build…Payload()` (monta a embed e os componentes) e um `handle…()` (trata cliques, selects e modals). O padrão de UI é consistente: menu suspenso para navegar, selects para escolher itens e modals para entrada de texto.

## Licença

Projeto privado. Todos os direitos reservados ao autor.
