# 🤖 Avatar RPG Bot — v7.0

Painel central interativo no Discord. Substitui os 22 slash commands antigos por um único `/painel` com botões, selects e modals.

---

## 🚀 Como rodar

```bash
cd bot
npm install
cp .env.example .env  # configurar (ver abaixo)
npm run dev           # ou npm start
```

### Variáveis de ambiente (.env)

```env
# ─── Discord ───
DISCORD_BOT_TOKEN=seu_token_aqui
DISCORD_CLIENT_ID=seu_client_id

# (Opcional) Em dev, registra comandos só nesse servidor → propaga em segundos
# Em prod, deixe vazio — registra global, leva ~1h pra propagar
DEV_GUILD_ID=

# ─── Backend ───
API_URL=http://localhost:5000
BOT_INTERNAL_SECRET=mesmo_secret_do_backend
FRONTEND_URL=https://avatar-rpg.com  # opcional, gera links pro site

# ─── Admins (para a seção Admin do painel) ───
ADMIN_DISCORD_IDS=123456789,987654321
```

---

## 🏗️ Arquitetura

```
bot/src/
├── index.js                   bootstrap (~100 linhas)
├── config.js                  variáveis de ambiente + constantes
├── api.js                     cliente HTTP do backend (cache de JWT)
├── cache.js                   cache 90s + throttle 3clk/s
├── registerCommands.js        registra /painel + /dashboard
│
├── panel/
│   ├── index.js               roteador central (panel:section:action:userId:ts)
│   ├── builders.js            templates reutilizáveis (embed, botões, etc)
│   ├── home.js                tela inicial do painel
│   └── sections/
│       ├── profile.js         👤 Perfil
│       ├── inventory.js       📦 Inventário (3 abas)
│       ├── skills.js          🎯 Skills (equipar/desequipar)
│       ├── combat.js          ⚔️ Combate (batalha em turno completa!)
│       ├── quests.js          📜 Missões (ver/resgatar)
│       ├── shop.js            💰 Loja Yuan (6 produtos do dia)
│       ├── blackmarket.js     🛒 Mercado Negro (comprar/vender)
│       ├── clan.js            🏛️ Clã (info/criar/sair/depositar/chat/evento)
│       ├── ranking.js         🏆 Ranking (jogadores/clãs)
│       ├── premium.js         💎 Planos
│       ├── story.js           📖 História (info + link pro site)
│       └── admin.js           ⚙️ Admin (dar Yuan, criar evento, etc)
│
└── utils/
    ├── customId.js            build/parse panel:section:action:userId:ts
    └── permissions.js         isAdminDiscord, hasActivePremium
```

---

## 🛡️ Anti-rate-limit (como funciona)

O Discord tem 4 limites importantes:

| Limite | Como mitigamos |
|---|---|
| **3 segundos pra responder a interaction** | `deferUpdate()`/`deferReply()` em ações lentas (>500ms) |
| **15 minutos de validade do token** | Custom IDs com `ts` — botões >14min mostram "Reabrir painel" |
| **5 mensagens / 5s por canal (compartilhado)** | Tudo é ephemeral → **não conta** pro limite do canal |
| **50 requests/s global por bot** | Throttle 3clk/s/usuário + cache 90s |

### Custom ID format

```
panel:{section}:{action}:{userId}:{ts}[:extra]
```

- `userId` validado em toda interação — outros usuários recebem "Esse painel não é seu"
- `ts` em base36 — quando expirado, oferece "Reabrir painel"
- `extra` opcional — pra carregar parâmetros (ex: skill ID, item ID)

### Cache em memória

- **Snapshot do user** (perfil/saldo/cla/missões): 90s TTL
- **Saldo**: SEM cache (sempre tempo real)
- **Listagens públicas** (clãs, ranking, market): 60s TTL
- **Invalidação automática** após ações de mutação (compra, depósito, etc.)

---

## 🎮 Como adicionar uma nova seção

1. Crie `bot/src/panel/sections/minhaSecao.js`:

```js
import { ActionRowBuilder, MessageFlags } from 'discord.js';
import { baseEmbed, navRow } from '../builders.js';
import { build as buildId } from '../../utils/customId.js';

export async function buildMinhaSecaoPayload(discordUser) {
  const userId = discordUser.id;
  const embed = baseEmbed({
    title: '📌 Minha Seção',
    description: 'Conteúdo aqui',
  });
  return {
    embeds: [embed],
    components: [navRow('minhaSecao', userId)],
    flags: MessageFlags.Ephemeral,
  };
}

export async function handleMinhaSecao(interaction, parsed) {
  const { action } = parsed;
  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildMinhaSecaoPayload(interaction.user);
    await interaction.editReply(payload);
  }
}
```

2. Em `panel/index.js`, importe e registre:

```js
import { handleMinhaSecao } from './sections/minhaSecao.js';

const SECTION_HANDLERS = {
  // ... outras
  minhaSecao: handleMinhaSecao,
};
```

3. Em `panel/home.js`, adicione um botão:

```js
new ButtonBuilder()
  .setCustomId(buildId('minhaSecao', 'open', userId))
  .setLabel('Minha Seção')
  .setEmoji('📌')
  .setStyle(ButtonStyle.Secondary),
```

Pronto — não precisa mexer em mais nada.

---

## ⚔️ Batalha em turno (mais complexo)

A seção Combate roda batalhas **dentro do painel ephemeral** — sem mensagens novas no canal.

Fluxo:
1. User aperta `🤖 Treinar` → vê lista de bosses (deve estar em clã)
2. Escolhe boss → backend cria batalha → painel mostra HP/Chi + skills equipadas + Soco
3. Cada ação (skill/defender/poção) chama backend → atualiza estado → `editReply()` na **mesma mensagem**
4. Vitória/derrota mostra tela de resultado + botão pra outra batalha

### Pontos importantes

- **Soco** sempre disponível (sem chi/CD)
- Skills em CD ou sem chi aparecem desabilitadas (UX clara)
- Poções abrem submenu antes de aplicar
- "Desistir" tem confirmação dupla
- Se token expira (>14min sem agir): o user clica "Continuar batalha" e abre nova mensagem com o estado preservado no backend

### Limitações conhecidas

- Desafio PvP usa polling **manual** (botão "Verificar"). Polling automático com timer Node pode ser adicionado depois.
- Arena ranqueada (matchmaking) só pelo site — desafio direto via clan-spar é o caminho no Discord.

---

## 🧪 Testando

```bash
# Liga o backend
cd backend && npm run dev

# Em outro terminal, liga o bot (com DEV_GUILD_ID setado pra registro instant)
cd bot && npm run dev

# No Discord:
/painel
```

Use o botão de cada seção. Em mobile e desktop o painel se adapta.

---

## 🚧 Operações que ficaram só no site

Pra manter o painel simples e sem riscos:

- Reset geral do banco
- Banir usuário
- Modo História (narrativa rica)
- Arena PvP ranqueada (matchmaking)
- Moderação de clã (kick/ban/promote)
- Trocas P2P do mercado negro (fluxo visual complexo)

---

## 📊 Status atual

- ✅ 12/12 seções implementadas
- ✅ Tudo ephemeral (zero impacto no rate limit do canal)
- ✅ Custom IDs com TTL e validação de owner
- ✅ Cache 90s + throttle anti-spam
- ✅ Compatibilidade backward (`/dashboard` é alias)
- ✅ Apenas em servidor (DM bloqueada)
- ✅ pt-BR
