// backend/src/routes/bot.js
// Rotas exclusivas para o bot Discord.
//
// Segurança:
//   - Rotas de LEITURA (character, inventory, quests, clan, story, subscription,
//     battle-history) são públicas por discordId — não expõem dados sensíveis.
//   - Rotas de ESCRITA (token, transfer) exigem autenticação:
//       • /token   → header X-Bot-Secret (segredo compartilhado bot↔backend)
//       • /transfer → JWT do usuário (o bot obtém via /token antes)
//
// O segredo BOT_INTERNAL_SECRET é separado do DISCORD_CLIENT_SECRET (OAuth)
// para que rotacionar um não derrube o outro.

import express from 'express';
import prisma from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Fallback pra compat com deploys antigos que só tinham DISCORD_CLIENT_SECRET:
const BOT_SECRET = process.env.BOT_INTERNAL_SECRET || process.env.DISCORD_CLIENT_SECRET;

// Middleware: valida que é o bot fazendo a chamada (via header X-Bot-Secret)
function botAuth(req, res, next) {
  const secret = req.headers['x-bot-secret'];
  if (!BOT_SECRET) {
    console.warn('[bot.js] BOT_INTERNAL_SECRET não configurado — rotas sensíveis desabilitadas.');
    return res.status(503).json({ error: 'BOT_INTERNAL_SECRET não configurado no backend.' });
  }
  if (!secret || secret !== BOT_SECRET) {
    return res.status(403).json({ error: 'Acesso negado (bot secret inválido).' });
  }
  next();
}

// ─── GET /api/bot/character/:discordId ───
router.get('/character/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { discordId: req.params.discordId },
      include: { character: true },
    });

    if (!user || !user.character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const char = user.character;
    res.json({
      ...char,
      discordUsername: user.username,
      discordAvatar: user.avatar,
      userRole: user.role,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── POST /api/bot/token ── Gera token JWT para o bot usar em nome do usuário ───
// ⚠️ GATED com X-Bot-Secret — só o bot legítimo pode pedir tokens de usuários.
router.post('/token', botAuth, async (req, res) => {
  const { discordId } = req.body;
  if (!discordId) return res.status(400).json({ error: 'discordId obrigatório' });

  try {
    const user = await prisma.user.findUnique({ where: { discordId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const token = jwt.sign(
      { userId: user.id, discordId: user.discordId, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /api/bot/inventory/:discordId ───
router.get('/inventory/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { discordId: req.params.discordId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const char = await prisma.character.findUnique({
      where: { userId: user.id },
      include: { inventory: true },
    });
    if (!char) return res.json([]);

    // Enriquece com tipo/raridade/etc (igual ao /api/inventory)
    const { findItemByName } = await import('../lib/items-lookup.js');
    const items = char.inventory.map(item => {
      const catalog = findItemByName(item.itemName);
      return {
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        // isEquipped/isConsumableEquipped. Mapeamos aqui pra padronizar.
        equipped: item.isEquipped || item.isConsumableEquipped,
        type: catalog?.type || 'misc',
        rarity: catalog?.rarity || 'common',
        element: catalog?.element || 'Neutro',
      };
    });
    res.json(items);
  } catch (error) {
    console.error('bot/inventory:', error);
    res.status(500).json({ error: 'Erro interno', detail: error.message });
  }
});

// ─── GET /api/bot/quest/:discordId ───
router.get('/quest/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { discordId: req.params.discordId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const char = await prisma.character.findUnique({
      where: { userId: user.id },
      include: { quests: { where: { isCompleted: false }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });

    const quest = char.quests[0];
    if (!quest) return res.status(404).json({ error: 'Nenhuma missão ativa' });

    res.json(quest);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /api/bot/quests/:discordId ─── (todas)
router.get('/quests/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { discordId: req.params.discordId } });
    if (!user) return res.status(404).json([]);

    const char = await prisma.character.findUnique({
      where: { userId: user.id },
      include: { quests: { where: { isCompleted: false } } },
    });

    res.json(char?.quests || []);
  } catch (error) {
    res.status(500).json([]);
  }
});

// ─── GET /api/bot/clan/:discordId ───
router.get('/clan/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { discordId: req.params.discordId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const member = await prisma.clanMember.findUnique({
      where: { userId: user.id },
      include: {
        clan: {
          include: {
            members: true,
            warsAsChallenger: { where: { status: 'active' } },
            warsAsDefender: { where: { status: 'active' } },
          },
        },
      },
    });

    if (!member) return res.status(404).json({ error: 'Não está em nenhum clã' });
    res.json({ ...member.clan, memberCount: member.clan.members.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /api/bot/story/:discordId ───
router.get('/story/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { discordId: req.params.discordId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const char = await prisma.character.findUnique({
      where: { userId: user.id },
      include: { storyProgress: true },
    });

    if (!char) return res.status(404).json({ error: 'Personagem não encontrado' });

    const CHAPTERS = [
      { id: 1, title: 'O Despertar do Elemento', description: 'Você desperta seus poderes.' },
      { id: 2, title: 'A Guerra das Nações',     description: 'Enfrente as forças inimigas.' },
      { id: 3, title: 'O Espírito do Avatar',    description: 'Entre no mundo espiritual.' },
      { id: 4, title: 'O Senhor do Fogo',        description: 'O confronto final com Ozai.' },
      { id: 5, title: 'O Fim do Ciclo',          description: 'O destino do mundo nas suas mãos.' },
    ];

    res.json({ ...(char.storyProgress || { chapter: 1, scene: 0 }), chapters: CHAPTERS });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /api/bot/subscription/:discordId ───
router.get('/subscription/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { discordId: req.params.discordId } });
    if (!user) return res.json({ plan: 'free', active: false });

    const sub = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    res.json(sub ? { plan: sub.planType, active: true, expiresAt: sub.expiresAt } : { plan: 'free', active: false });
  } catch (error) {
    res.json({ plan: 'free', active: false });
  }
});

// ─── GET /api/bot/battle-history/:discordId ───
router.get('/battle-history/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { discordId: req.params.discordId } });
    if (!user) return res.json([]);

    const char = await prisma.character.findUnique({ where: { userId: user.id } });
    if (!char) return res.json([]);

    const logs = await prisma.battleLog.findMany({
      where: { characterId: char.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    res.json(logs);
  } catch (error) {
    res.json([]);
  }
});

// ─── POST /api/bot/transfer ── Transferência de Yuan ───
router.post('/transfer', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { targetDiscordId, amount } = req.body;

    if (!targetDiscordId || !amount || amount < 1) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    const targetUser = await prisma.user.findUnique({ where: { discordId: targetDiscordId } });
    if (!targetUser) return res.status(404).json({ error: 'Destinatário não encontrado' });

    const [senderChar, receiverChar] = await Promise.all([
      prisma.character.findUnique({ where: { userId: decoded.userId } }),
      prisma.character.findUnique({ where: { userId: targetUser.id } }),
    ]);

    if (!senderChar) return res.status(404).json({ error: 'Seu personagem não encontrado' });
    if (!receiverChar) return res.status(404).json({ error: 'Destinatário não tem personagem' });
    if (senderChar.money < amount) return res.status(400).json({ error: 'Yuan insuficiente' });

    await prisma.$transaction([
      prisma.character.update({ where: { id: senderChar.id }, data: { money: { decrement: amount } } }),
      prisma.character.update({ where: { id: receiverChar.id }, data: { money: { increment: amount } } }),
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: 'Token inválido' });
  }
});

// ─── POST /api/bot/ensure-user ── Registra o usuário no banco a partir do Discord ID
// Útil quando o usuário roda um comando no bot ANTES de logar pelo dashboard:
// cria User + Character automaticamente com dados do Discord (username/avatar).
router.post('/ensure-user', botAuth, async (req, res) => {
  const { discordId, username, avatar } = req.body;
  if (!discordId || !username) {
    return res.status(400).json({ error: 'discordId e username obrigatórios' });
  }

  try {
    const avatarUrl = avatar || null;

    const user = await prisma.user.upsert({
      where: { discordId },
      update: { username, avatar: avatarUrl },
      create: { discordId, username, avatar: avatarUrl, email: null },
    });

    // Garante que o personagem exista
    const existing = await prisma.character.findUnique({ where: { userId: user.id } });
    let created = false;
    if (!existing) {
      await prisma.character.create({
        data: {
          userId: user.id,
          name: `${username}_Avatar`,
          element: null,
          attack: 25,
          defense: 20,
          money: 100,
          elo: 500, peakElo: 500, rankTier: 'bronze',
        },
      });
      created = true;
      console.log(`[ensure-user] Novo personagem criado via bot: ${username} (${discordId})`);
    }

    res.json({
      success: true,
      created,
      userId: user.id,
      isBanned: user.role === 'banned',
    });
  } catch (error) {
    console.error('bot/ensure-user:', error);
    res.status(500).json({ error: 'Erro ao garantir usuário' });
  }
});

// GET /api/bot/saldo/:discordId
// Sem cache — sempre tempo real. Resposta minúscula (3 campos) pra ser rápido.
router.get('/saldo/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { discordId: req.params.discordId },
      include: { character: { select: { money: true, hp: true, chi: true, maxHp: true, maxChi: true } } },
    });
    if (!user?.character) return res.status(404).json({ error: 'Personagem não encontrado' });
    res.json({
      yuan: user.character.money,
      hp: user.character.hp,
      maxHp: user.character.maxHp,
      chi: user.character.chi,
      maxChi: user.character.maxChi,
    });
  } catch (error) {
    console.error('bot/saldo:', error);
    res.status(500).json({ error: 'Erro ao buscar saldo' });
  }
});

// GET /api/bot/snapshot/:discordId?fields=perfil,saldo,missoes,cla,inventario,assinatura
router.get('/snapshot/:discordId', async (req, res) => {
  const fields = (req.query.fields || 'perfil,saldo')
    .split(',').map(f => f.trim()).filter(Boolean);

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { discordId: req.params.discordId },
      include: {
        character: true,
        clanMember: {
          include: {
            clan: {
              select: {
                id: true, name: true, element: true, level: true,
                treasury: true, championBadges: true,
                buffType: true, buffValue: true, buffExpiresAt: true,
              },
            },
          },
        },
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  } catch (error) {
    console.error('bot/snapshot user fetch:', error);
    return res.status(500).json({ error: 'Erro DB ao buscar user', detail: error.message });
  }

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const character = user.character;
  const out = {};
  const errors = {};

  // ─── PERFIL ───
  if (fields.includes('perfil')) {
    try {
      out.perfil = character ? {
        name: user.username,
        avatar: user.avatar,
        level: character.level,
        exp: character.exp,
        element: character.element,
        attack: character.attack,
        defense: character.defense,
        wins: character.wins,
        losses: character.losses,
        elo: character.elo,
        peakElo: character.peakElo,
        rankTier: character.rankTier,
      } : null;
    } catch (e) { errors.perfil = e.message; out.perfil = null; }
  }

  // ─── SALDO ───
  if (fields.includes('saldo')) {
    try {
      out.saldo = character ? {
        yuan: character.money,
        hp: character.hp, maxHp: character.maxHp,
        chi: character.chi, maxChi: character.maxChi,
      } : null;
    } catch (e) { errors.saldo = e.message; out.saldo = null; }
  }

  // ─── MISSÕES ───
  if (fields.includes('missoes')) {
    try {
      if (!character) {
        out.missoes = [];
      } else {
        const quests = await prisma.userQuest.findMany({
          where: { characterId: character.id, isCompleted: false, isFailed: false },
          orderBy: { acceptedAt: 'desc' },
          take: 10,
        });
        out.missoes = quests.map(q => ({
          id: q.id,
          title: q.title,
          description: q.description,
          type: q.type,
          progress: q.progress,
          maxProgress: q.maxProgress,
          rewardYuan: q.rewardYuan,
          rewardExp: q.rewardExp,
          rewardItem: q.rewardItem,
          expiresAt: q.expiresAt,
          completed: q.progress >= q.maxProgress,
        }));
      }
    } catch (e) { errors.missoes = e.message; out.missoes = []; }
  }

  // ─── CLÃ ───
  if (fields.includes('cla')) {
    try {
      const cm = user.clanMember;
      if (cm?.clan) {
        const clan = cm.clan;
        const buffActive = clan.buffType && clan.buffExpiresAt &&
          new Date(clan.buffExpiresAt) > new Date();
        out.cla = {
          id: clan.id,
          name: clan.name,
          element: clan.element,
          level: clan.level,
          treasury: clan.treasury,
          role: cm.role,
          championBadges: Array.isArray(clan.championBadges) ? clan.championBadges.length : 0,
          activeBuff: buffActive ? {
            type: clan.buffType, value: clan.buffValue, expiresAt: clan.buffExpiresAt,
          } : null,
        };
      } else {
        out.cla = null;
      }
    } catch (e) { errors.cla = e.message; out.cla = null; }
  }

  // ─── INVENTÁRIO ───
  if (fields.includes('inventario')) {
    try {
      if (!character) {
        out.inventario = [];
      } else {
        const items = await prisma.inventoryItem.findMany({
          where: { characterId: character.id },
          orderBy: [{ isEquipped: 'desc' }, { itemName: 'asc' }],
          take: 50,
        });
        out.inventario = items.map(i => ({
          id: i.id,
          itemName: i.itemName,
          quantity: i.quantity,
          equipped: i.isEquipped || i.isConsumableEquipped,
        }));
      }
    } catch (e) { errors.inventario = e.message; out.inventario = []; }
  }

  // ─── ASSINATURA ───
  if (fields.includes('assinatura')) {
    try {
      const sub = user.subscriptions?.[0];
      const stillValid = sub && (!sub.expiresAt || new Date(sub.expiresAt) > new Date());
      out.assinatura = sub && stillValid ? {
        plan: sub.planType,
        status: sub.status,
        expiresAt: sub.expiresAt,
      } : null;
    } catch (e) { errors.assinatura = e.message; out.assinatura = null; }
  }

  // Se houve QUALQUER erro, loga (mas NÃO falha — retorna o que conseguiu)
  if (Object.keys(errors).length > 0) {
    console.warn('bot/snapshot field errors:', errors);
    out._errors = errors; // bot pode logar/ignorar
  }

  res.json(out);
});

// Usado pelo bot que precisa resolver "qual batalha eu tenho ativa agora"
// sem precisar passar battleId.
router.get('/battle/active/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { discordId: req.params.discordId },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { getActiveBattleForUser, getSideForUser, serializeStateForSide } =
      await import('../lib/battle-state.js');

    const state = getActiveBattleForUser(user.id);
    if (!state) return res.json({ active: false });

    const mySide = getSideForUser(state.battleId, user.id);
    const serialized = serializeStateForSide(state.battleId, mySide);
    res.json({
      active: true,
      battleId: state.battleId,
      isPvP: state.isPvP,
      ...serialized,
    });
  } catch (error) {
    console.error('bot/battle/active:', error);
    res.status(500).json({ error: 'Erro', detail: error.message });
  }
});

// Quando o user tem uma batalha "fantasma" no in-memory (fechou aba sem
// terminar), permite sair sem precisar voltar à mesma batalha.
router.post('/battle/abandon/:discordId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { discordId: req.params.discordId },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { getActiveBattleForUser, endBattleState } =
      await import('../lib/battle-state.js');
    const { isInBattle, leaveBattle } = await import('../lib/matchmaking.js');

    const state = getActiveBattleForUser(user.id);
    if (state) {
      endBattleState(state.battleId);
    }
    if (isInBattle(user.id)) {
      leaveBattle(user.id);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('bot/battle/abandon:', error);
    res.status(500).json({ error: 'Erro', detail: error.message });
  }
});

export default router;
