import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import prisma from './lib/prisma.js';

import battleRoutes from './routes/battle.js';
import skillsUpgradeRouter from './routes/skills-upgrade.js';
import inventoryRoutes from './routes/inventory.js';
import marketRoutes from './routes/market.js';
import craftRoutes from './routes/craft.js';
import questRoutes from './routes/quest.js';
import characterRoutes from './routes/character.js';
import clanRoutes from './routes/clan.js';
import clanTradeRoutes from './routes/clan-trade.js';
import clanSparRoutes from './routes/clan-spar.js';
import trainingRoutes from './routes/training.js';
import storyRoutes from './routes/story.js';
import subscriptionRoutes from './routes/subscription.js';
import adminRoutes from './routes/admin.js';
import realStoreRoutes from './routes/realstore.js';
import botRoutes from './routes/bot.js';
import paymentRoutes from './routes/payment.js';
import tradeRoutes from './routes/trade.js';
import yuanStoreRoutes from './routes/yuanstore.js';
import loadoutRoutes from './routes/loadout.js';

import {
  helmetConfig,
  globalLimiter,
  authLimiter,
  apiLimiter,
} from './middleware/security.js';

import { getRankFromElo } from './lib/ranks.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

const ALLOWED_HOST_PATTERNS = [
  /\.discloud\.app$/,
  /^avatarbot\.(site|com)$/,
  /\.avatarbot\.(site|com)$/,
];

app.use(helmetConfig);
app.use(globalLimiter);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    try {
      const host = new URL(origin).hostname;
      const ok = allowedOrigins.includes(origin) ||
                 ALLOWED_HOST_PATTERNS.some(rx => rx.test(host));
      if (ok) return cb(null, true);
    } catch {}
    return cb(new Error(`Origin ${origin} não permitido pelo CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI || 'http://localhost:5000/auth/callback';
const FRONTEND_URL          = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET            = process.env.JWT_SECRET || 'avatar-rpg-secret-change-in-production';

function isAdminDiscord(discordId) {
  const ids = (process.env.ADMIN_DISCORD_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return ids.includes(discordId);
}

// ─── Discord OAuth ───
app.get('/auth/discord', authLimiter, (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email`;
  res.redirect(url);
});

app.get('/auth/callback', authLimiter, async (req, res) => {
  const { code } = req.query;
  if (!code) {
    console.error('[auth/callback] sem code na query');
    return res.redirect(`${FRONTEND_URL}/?error=no_code`);
  }
  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('[auth/callback] Discord não retornou access_token:', tokenData);
      return res.redirect(`${FRONTEND_URL}/?error=token_failed`);
    }
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userResponse.json();
    const user = await prisma.user.upsert({
      where: { discordId: discordUser.id },
      update: {
        username: discordUser.username,
        avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
      },
      create: {
        discordId: discordUser.id,
        username:  discordUser.username,
        avatar:    discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
        email:     discordUser.email || null,
      },
    });
    const existing = await prisma.character.findUnique({ where: { userId: user.id } });
    if (!existing) {
      await prisma.character.create({
        data: {
          userId: user.id, name: `${discordUser.username}_Avatar`,
          element: null, attack: 25, defense: 20, money: 100,
          elo: 500, peakElo: 500, rankTier: 'bronze',
        },
      });
      console.log(`[auth] Novo personagem criado: ${discordUser.username}`);
    }
    const token = jwt.sign(
      { userId: user.id, discordId: user.discordId, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('[auth/callback] ERRO:', error.message);
    res.redirect(`${FRONTEND_URL}/?error=auth_failed&detail=${encodeURIComponent(error.message)}`);
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Rotas da API ───
app.use('/api/character', apiLimiter, characterRoutes);
app.use('/api/battle',    apiLimiter, battleRoutes);
app.use('/api/inventory', apiLimiter, inventoryRoutes);
app.use('/api/market',    apiLimiter, marketRoutes);
app.use('/api/craft',     apiLimiter, craftRoutes);
app.use('/api/quest',     apiLimiter, questRoutes);
app.use('/api/clan',      apiLimiter, clanRoutes);
app.use('/api/clan-trade', apiLimiter, clanTradeRoutes);
app.use('/api/clan-spar',  apiLimiter, clanSparRoutes);
app.use('/api/training',   apiLimiter, trainingRoutes);
app.use('/api/story',     apiLimiter, storyRoutes);
app.use('/api/subscription', apiLimiter, subscriptionRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/realstore', apiLimiter, realStoreRoutes);
app.use('/api/skills', apiLimiter, skillsUpgradeRouter);
app.use('/api/bot',       botRoutes);
app.use('/api/payment',   paymentRoutes);
app.use('/api/trade',     apiLimiter, tradeRoutes);
app.use('/api/yuanstore', apiLimiter, yuanStoreRoutes);
app.use('/api/loadout',   apiLimiter, loadoutRoutes);

// Devolve URL do servidor de suporte e link "adicionar bot" para
// botões na home/profile. Ambos são opt-in via env vars.
app.get('/api/config', (req, res) => {
  const inviteScopes = encodeURIComponent('bot applications.commands');
  // Permissões básicas pra responder/comandos: 274877957632
  const permissions = process.env.DISCORD_BOT_PERMISSIONS || '274877957632';
  const botInvite = DISCORD_CLIENT_ID
    ? `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&scope=${inviteScopes}&permissions=${permissions}`
    : null;
  res.json({
    supportInvite: process.env.DISCORD_SUPPORT_INVITE || null,
    botInvite,
  });
});

app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Rota não encontrada', path: req.originalUrl });
});
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 8080;

async function syncSchema() {
  if (process.env.DB_PUSH_ON_BOOT !== 'true' && process.env.DB_PUSH_ON_BOOT !== '1') {
    return;
  }
  console.log('Sincronizando schema no boot...');
  const { spawnSync } = await import('child_process');
  const result = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    stdio: 'inherit', shell: true, env: process.env, cwd: process.cwd(),
  });
  if (result.status !== 0) throw new Error(`prisma db push falhou (status ${result.status})`);
  console.log('Schema sincronizado.');
}

async function startServer() {
  try { await syncSchema(); }
  catch (err) {
    console.error('⚠️  Aviso: falha ao sincronizar schema:', err.message);
  }

  try { await prisma.$connect(); console.log('✅ Banco conectado.'); }
  catch (err) { console.error('⚠️  Aviso: falha ao conectar:', err.message); }

  try { await prisma.user.findFirst(); console.log('✅ Tabela User OK.'); }
  catch (err) { console.error('⚠️  Aviso: tabela User inacessível:', err.message); }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend v4.5 rodando em http://0.0.0.0:${PORT}`);
    const admins = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);
    console.log(`🔑 Admins: ${admins.length > 0 ? admins.join(', ') : 'NENHUM'}`);
  });
}

startServer().catch(err => { console.error('❌ Falha fatal:', err); process.exit(1); });
