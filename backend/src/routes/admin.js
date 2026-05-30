// backend/src/routes/admin.js
// Rotas administrativas — restritas a IDs em ADMIN_DISCORD_IDS no .env
// Gerencia: stats, usuários, missões do mural, loja Yuan.

import express from 'express';
import prisma from '../lib/prisma.js';
import { adminMiddleware } from '../middleware/auth.js';
import { getAllItems } from '../lib/items-lookup.js';
import { SKILLS } from '../lib/skills.js';

const router = express.Router();

// POST /api/admin/cleanup-character-skills
// Body: { discordId } OU { username } OU { characterId }
// Limpa unlockedSkills/equippedSkills de skills incompatíveis com elemento atual.
// Mantém: skills do MESMO elemento + skills neutras + skills tier 4 (história).
router.post('/cleanup-character-skills', adminMiddleware, async (req, res) => {
  try {
    const { discordId, username, characterId } = req.body;

    let character;
    if (characterId) {
      character = await prisma.character.findUnique({ where: { id: characterId } });
    } else if (discordId) {
      const user = await prisma.user.findUnique({
        where: { discordId },
        include: { character: true },
      });
      character = user?.character;
    } else if (username) {
      const user = await prisma.user.findFirst({
        where: { username },
        include: { character: true },
      });
      character = user?.character;
    }

    if (!character) {
      return res.status(404).json({ error: 'Personagem não encontrado' });
    }

    const before = {
      element: character.element,
      unlockedSkills: Array.isArray(character.unlockedSkills) ? [...character.unlockedSkills] : [],
      equippedSkills: Array.isArray(character.equippedSkills) ? [...character.equippedSkills] : [],
    };

    // ── Filtra skills incompatíveis ──
    const isCompatible = (skillId) => {
      const skill = SKILLS[skillId];
      if (!skill) return false; // skill desconhecida = remove
      if (skill.element === 'Neutro') return true;
      if (skill.tier === 4) return true; // tier 4 (história) sempre OK
      // skill base do MESMO elemento
      if (skill.element === character.element) return true;
      return false;
    };

    const cleanedUnlocked = before.unlockedSkills.filter(isCompatible);
    const cleanedEquipped = before.equippedSkills.filter(id =>
      cleanedUnlocked.includes(id) || (SKILLS[id]?.element === character.element && SKILLS[id]?.minLevel <= character.level),
    );

    const removed = {
      unlockedSkills: before.unlockedSkills.filter(s => !cleanedUnlocked.includes(s)),
      equippedSkills: before.equippedSkills.filter(s => !cleanedEquipped.includes(s)),
    };

    await prisma.character.update({
      where: { id: character.id },
      data: {
        unlockedSkills: cleanedUnlocked,
        equippedSkills: cleanedEquipped,
      },
    });

    res.json({
      success: true,
      character: {
        id: character.id,
        element: character.element,
        before,
        after: {
          unlockedSkills: cleanedUnlocked,
          equippedSkills: cleanedEquipped,
        },
        removed,
      },
    });
  } catch (error) {
    console.error('admin/cleanup-character-skills:', error);
    res.status(500).json({ error: 'Erro', detail: error.message });
  }
});

// POST /api/admin/force-daily-refresh
// Apaga a daily store de hoje e cria uma nova (re-rola os 6 produtos).
// Útil pra forçar mudança quando o jogador acha que "não resetou".
router.post('/force-daily-refresh', adminMiddleware, async (req, res) => {
  try {
    const todayDateString = () => new Date().toISOString().split('T')[0];
    const today = todayDateString();

    // Apaga a entrada de hoje (se existir)
    await prisma.dailyStore.deleteMany({ where: { date: today } });

    // Re-cria com sorteio novo
    const allItems = getAllItems();
    const consumables = allItems.filter(i => i.type === 'consumable');
    const equipables = allItems.filter(i => ['weapon', 'armor', 'amulet', 'accessory'].includes(i.type));
    const allSkills = Object.values(SKILLS).filter(s =>
      s.path !== null && s.tier <= 3 && s.tier >= 1,
    );

    const pickRandom = (arr, n) => [...arr].sort(() => 0.5 - Math.random()).slice(0, n);

    const pickedSkill = pickRandom(allSkills, 1)[0];
    const pickedItems = pickRandom(equipables, 3);
    const pickedPotions = pickRandom(consumables, 2);

    const newDaily = await prisma.dailyStore.create({
      data: {
        date: today,
        skillId: pickedSkill.id,
        itemIds: pickedItems.map(i => i.id),
        potionIds: pickedPotions.map(i => i.id),
      },
    });

    res.json({
      success: true,
      message: 'Loja Yuan re-rolada para hoje.',
      date: today,
      products: [
        { type: 'skill', name: pickedSkill.name, icon: pickedSkill.icon, element: pickedSkill.element },
        ...pickedItems.map(i => ({ type: 'item', name: i.name, icon: i.icon || '📦', element: i.element || 'Neutro' })),
        ...pickedPotions.map(i => ({ type: 'consumable', name: i.name, icon: i.effect?.icon || '🧪', element: i.element || 'Neutro' })),
      ],
    });
  } catch (error) {
    console.error('admin/force-daily-refresh:', error);
    res.status(500).json({ error: 'Erro', detail: error.message });
  }
});

// STATS / USUÁRIOS

router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [users, subs, battles, clans, quests, fixedStoreItems, dailyStore, activeWar] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.battleLog.count(),
      prisma.clan.count(),
      prisma.adminQuest.count({ where: { isActive: true } }),
      prisma.yuanStoreItem.count({ where: { isActive: true } }),
      prisma.dailyStore.findUnique({ where: { date: today } }),
      prisma.clanWarEvent.findFirst({ where: { status: 'active' }, orderBy: { startsAt: 'desc' } }),
    ]);

    // Loja Diária = 1 skill + N itens + N poções (se já existe registro do dia)
    const dailyStoreItems = dailyStore
      ? 1 + (dailyStore.itemIds?.length || 0) + (dailyStore.potionIds?.length || 0)
      : 0;
    const storeItems = fixedStoreItems + dailyStoreItems;

    res.json({
      users,
      activeSubs: subs,
      battles,
      clans,
      adminQuests: quests,
      // a Loja Diária do dia (1 skill + 3 itens + 2 poções = 6) também.
      storeItems,
      fixedStoreItems,
      dailyStoreItems,
      activeClanWarEvent: activeWar
        ? { id: activeWar.id, name: activeWar.name, endsAt: activeWar.endsAt }
        : null,
    });
  } catch (error) {
    console.error('admin/stats:', error);
    res.status(500).json({ error: 'Erro ao buscar stats' });
  }
});

// Rota usada pelo bot (sem auth — protegida por BOT_SECRET no bot.js)
router.get('/stats-bot', async (req, res) => {
  try {
    const [users, subs, battles, clans] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.battleLog.count(),
      prisma.clan.count(),
    ]);
    res.json({ users, activeSubs: subs, battles, clans });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar stats' });
  }
});

router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { character: true, subscriptions: { where: { status: 'active' } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

router.post('/give-yuan', adminMiddleware, async (req, res) => {
  const { userId, discordId, amount } = req.body;
  try {
    let targetUserId = userId;
    if (!targetUserId && discordId) {
      const user = await prisma.user.findUnique({ where: { discordId } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
      targetUserId = user.id;
    }
    await prisma.character.update({
      where: { userId: targetUserId },
      data: { money: { increment: parseInt(amount) } },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao dar Yuan' });
  }
});

router.post('/ban', adminMiddleware, async (req, res) => {
  const { userId, discordId, motivo } = req.body;
  try {
    let user;
    if (discordId) user = await prisma.user.findUnique({ where: { discordId } });
    else if (userId) user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (user.role === 'banned') {
      return res.status(400).json({ error: 'Usuário já está banido' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { role: 'banned' } });
    console.log(`🔨 Banido: ${user.username} — Motivo: ${motivo || 'não informado'}`);
    res.json({ success: true, message: `${user.username} foi banido.` });
  } catch (error) {
    console.error('admin/ban:', error);
    res.status(500).json({ error: 'Erro ao banir' });
  }
});

// RESET GERAL DO BANCO
// CUIDADO: apaga TUDO relacionado a progresso de usuários.
// Mantém apenas estruturas essenciais (admin-quests, loja yuan, etc).
// Requer body: { confirm: "RESETAR TUDO" } como confirmação explícita.

router.post('/reset', adminMiddleware, async (req, res) => {
  const { userId, discordId } = req.body;
  try {
    let targetUserId = userId;
    if (!targetUserId && discordId) {
      const user = await prisma.user.findUnique({ where: { discordId } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
      targetUserId = user.id;
    }
    const character = await prisma.character.findUnique({ where: { userId: targetUserId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    await prisma.$transaction([
      prisma.skillCooldown.deleteMany({ where: { characterId: character.id } }),
      prisma.battleLog.deleteMany({ where: { characterId: character.id } }),
      prisma.userQuest.deleteMany({ where: { characterId: character.id } }),
      prisma.inventoryItem.deleteMany({ where: { characterId: character.id } }),
      prisma.storyProgress.deleteMany({ where: { characterId: character.id } }),
      prisma.bossDefeat.deleteMany({ where: { characterId: character.id } }),
      prisma.character.update({
        where: { userId: targetUserId },
        data: {
          level: 1,
          exp: 0,
          money: 100,
          wins: 0,
          losses: 0,
          hp: 100,
          maxHp: 100,
          chi: 50,
          maxChi: 50,
          attack: 25,
          defense: 20,
          elo: 500,
          peakElo: 500,
          rankTier: 'bronze',
          unlockedSkills: [],
          equippedSkills: [],
          clanBuffActive: true,
          storyProfile: { wise: 0, aggressive: 0, fearful: 0 },
          elementProfile: { Fogo: 0, Água: 0, Terra: 0, Ar: 0 },
          element: 'Nenhum',
          battlesToday: 0,
          battlesResetAt: new Date(),
          questsCompletedToday: 0,
          questsResetAt: new Date(),
          // ─── Limpa o cooldown de 30min entre capítulos ───
          lastChapterCompletedAt: null,
          lastReset: new Date(),
        },
      }),
    ]);

    console.log(`♻️ Personagem resetado: ${character.name}`);
    res.json({ success: true, message: 'Personagem completamente resetado.' });
  } catch (error) {
    console.error('admin/reset:', error);
    res.status(500).json({ error: 'Erro ao resetar' });
  }
});

// RESET GERAL DO BANCO
router.post('/reset-all', adminMiddleware, async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'RESETAR TUDO') {
    return res.status(400).json({
      error: 'Confirmação necessária. Envie { confirm: "RESETAR TUDO" } no body.',
    });
  }
  try {
    await prisma.$transaction([
      prisma.skillCooldown.deleteMany({}),
      prisma.battleLog.deleteMany({}),
      prisma.userQuest.deleteMany({}),
      prisma.inventoryItem.deleteMany({}),
      prisma.storyProgress.deleteMany({}),
      prisma.tradeOffer.deleteMany({}),
      prisma.marketListing.deleteMany({}),
      prisma.realStorePurchase.deleteMany({}),
      prisma.realStoreItem_rotation.deleteMany({}),
      prisma.storeRotation.deleteMany({}),
      prisma.dailyStore.deleteMany({}),
      prisma.clanWar.deleteMany({}),
      prisma.clanMessage.deleteMany({}),
      prisma.clanInvite.deleteMany({}),
      prisma.clanJoinRequest.deleteMany({}),
      prisma.clanBan.deleteMany({}),
      prisma.clanTrade.deleteMany({}),
      prisma.bossDefeat.deleteMany({}),
      prisma.clanMember.deleteMany({}),
      prisma.clan.deleteMany({}),
      prisma.subscription.deleteMany({}),
      prisma.purchase.deleteMany({}),
      prisma.character.updateMany({
        data: {
          level: 1,
          exp: 0,
          money: 100,
          wins: 0,
          losses: 0,
          hp: 100,
          maxHp: 100,
          chi: 50,
          maxChi: 50,
          attack: 25,
          defense: 20,
          elo: 500,
          peakElo: 500,
          rankTier: 'bronze',
          unlockedSkills: [],
          equippedSkills: [],
          clanBuffActive: true,
          storyProfile: { wise: 0, aggressive: 0, fearful: 0 },
          elementProfile: { Fogo: 0, Água: 0, Terra: 0, Ar: 0 },
          element: 'Nenhum',
          battlesToday: 0,
          battlesResetAt: new Date(),
          questsCompletedToday: 0,
          questsResetAt: new Date(),
          // ─── Limpa o cooldown de 30min entre capítulos ───
          lastChapterCompletedAt: null,
          lastReset: new Date(),
        },
      }),
    ]);

    const totalChars = await prisma.character.count();

    let dailyStoreInfo = null;
    try {
      const ys = await import('./yuanstore.js');
      // O módulo só exporta o router. Vamos rolar diretamente:
      const { SKILLS } = await import('../lib/skills.js');
      const { getAllItems } = await import('../lib/items-lookup.js');

      // Helpers do yuanstore (reproduzimos aqui pq não estão exportados):
      const todayDateString = () => new Date().toISOString().split('T')[0];
      const pickRandom = (arr, n) => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
      };

      const allItems = getAllItems();
      const consumables = allItems.filter(i => i.type === 'consumable');
      const equipables  = allItems.filter(i => ['weapon', 'armor', 'amulet', 'accessory'].includes(i.type));
      const allSkills = Object.values(SKILLS).filter(s => s.path !== null && s.tier <= 3 && s.tier >= 1);

      const pickedSkill = pickRandom(allSkills, 1)[0];
      const pickedItems = pickRandom(equipables, 3);
      const pickedPotions = pickRandom(consumables, 2);

      const newDaily = await prisma.dailyStore.create({
        data: {
          date: todayDateString(),
          skillId: pickedSkill.id,
          itemIds: pickedItems.map(i => i.id),
          potionIds: pickedPotions.map(i => i.id),
        },
      });

      dailyStoreInfo = {
        date: newDaily.date,
        products: [
          { type: 'skill', name: pickedSkill.name, icon: pickedSkill.icon, element: pickedSkill.element, rarity: pickedSkill.tier >= 3 ? 'epic' : pickedSkill.tier === 2 ? 'uncommon' : 'common' },
          ...pickedItems.map(i => ({ type: 'item', name: i.name, icon: i.icon || '📦', element: i.element, rarity: i.rarity })),
          ...pickedPotions.map(i => ({ type: 'consumable', name: i.name, icon: i.effect?.icon || '🧪', element: i.element, rarity: i.rarity })),
        ],
      };
    } catch (err) {
      console.warn('reset-all: falha ao re-rolar daily store (não-fatal):', err.message);
    }

    console.log(`⚠️ RESET TOTAL executado por admin ${req.discordId}. Todos os clãs, mercados, missões, progressos, batalhas e compras foram apagados. ${totalChars} personagens resetados. Loja Yuan diária re-rolada.`);

    res.json({
      success: true,
      message: `Reset TOTAL concluído. Todos os dados dinâmicos (clãs, mercado, missões, progressos, batalhas, etc.) foram removidos. ${totalChars} personagens zerados. Loja Yuan diária renovada.`,
      charactersReset: totalChars,
      dailyStore: dailyStoreInfo,
    });
  } catch (error) {
    console.error('admin/reset-all:', error);
    res.status(500).json({
      error: 'Erro no reset total',
      detail: error.message
    });
  }
});

// LISTA DETALHADA DE JOGADORES (para painel admin)
// Inclui: id, discordId, username, avatar, character stats, status (banned/active)
router.get('/players', adminMiddleware, async (req, res) => {
  try {
    const search = (req.query.search || '').trim().toLowerCase();

    const users = await prisma.user.findMany({
      where: search ? {
        OR: [
          { username:  { contains: search, mode: 'insensitive' } },
          { discordId: { contains: search } },
        ],
      } : undefined,
      include: {
        character: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const players = users.map(u => ({
      id: u.id,
      discordId: u.discordId,
      username: u.username,
      avatar: u.avatar,
      email: u.email,
      role: u.role,
      isBanned: u.role === 'banned',
      createdAt: u.createdAt,
      character: u.character ? {
        id: u.character.id,
        name: u.character.name,
        element: u.character.element,
        level: u.character.level,
        exp: u.character.exp,
        money: u.character.money,
        elo: u.character.elo,
        rankTier: u.character.rankTier,
        wins: u.character.wins,
        losses: u.character.losses,
      } : null,
    }));

    res.json({ total: players.length, players });
  } catch (error) {
    console.error('admin/players:', error);
    res.status(500).json({ error: 'Erro ao listar jogadores' });
  }
});

// UNBAN — remove role 'banned' → volta pra 'user'
router.post('/unban', adminMiddleware, async (req, res) => {
  const { userId, discordId } = req.body;
  try {
    let user;
    if (discordId) user = await prisma.user.findUnique({ where: { discordId } });
    else if (userId) user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (user.role !== 'banned') {
      return res.status(400).json({ error: 'Usuário não está banido' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'user' },
    });

    console.log(`✅ Desbanido: ${user.username} (${user.discordId})`);
    res.json({ success: true, message: `${user.username} foi desbanido.` });
  } catch (error) {
    console.error('admin/unban:', error);
    res.status(500).json({ error: 'Erro ao desbanir' });
  }
});

// MURAL DE MISSÕES — CRUD
// Somente admin pode criar. Missões ficam disponíveis por
// nível mínimo e aparecem automaticamente pros usuários.

router.get('/quests', adminMiddleware, async (req, res) => {
  try {
    const quests = await prisma.adminQuest.findMany({
      orderBy: [{ isActive: 'desc' }, { minLevel: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(quests);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar missões' });
  }
});

router.post('/quests', adminMiddleware, async (req, res) => {
  const {
    title, description, type,
    minLevel = 1, maxLevel = 100, maxProgress,
    rewardExp, rewardYuan, rewardItem,
    durationHours = 24,
    element = 'any',
  } = req.body;

  if (!title || !description || !type || !maxProgress || rewardExp == null || rewardYuan == null) {
    return res.status(400).json({ error: 'Campos obrigatórios: title, description, type, maxProgress, rewardExp, rewardYuan' });
  }
  const validTypes = ['battle', 'collect', 'craft', 'explore', 'story'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Use: ${validTypes.join(', ')}` });
  }
  const validElements = ['any', 'Fogo', 'Água', 'Terra', 'Ar'];
  if (!validElements.includes(element)) {
    return res.status(400).json({ error: `Elemento inválido. Use: ${validElements.join(', ')}` });
  }

  // Se o admin escolheu um elemento específico E definiu rewardItem,
  // valida que o item é do mesmo elemento (ou Neutro/sem elemento).
  if (element !== 'any' && rewardItem) {
    const items = getAllItems();
    const item = items.find(i => i.name === rewardItem);
    if (item && item.element && item.element !== 'Neutro' && item.element !== element) {
      return res.status(400).json({
        error: `O item "${rewardItem}" é do elemento ${item.element}, mas a missão é do elemento ${element}. Escolha outro item.`,
      });
    }
  }

  try {
    const quest = await prisma.adminQuest.create({
      data: {
        title,
        description,
        type,
        element,
        minLevel: parseInt(minLevel) || 1,
        maxLevel: parseInt(maxLevel) || 100,
        maxProgress: parseInt(maxProgress),
        rewardExp: parseInt(rewardExp),
        rewardYuan: parseInt(rewardYuan),
        rewardItem: rewardItem || null,
        durationHours: Math.max(1, parseInt(durationHours) || 24),
        isActive: true,
        createdBy: req.discordId,
      },
    });
    res.json(quest);
  } catch (error) {
    console.error('admin/quests POST:', error);
    res.status(500).json({ error: 'Erro ao criar missão' });
  }
});

router.patch('/quests/:id', adminMiddleware, async (req, res) => {
  try {
    const data = { ...req.body };
    // sanitize
    delete data.id; delete data.createdBy; delete data.createdAt;
    if (data.minLevel != null)      data.minLevel      = parseInt(data.minLevel);
    if (data.maxLevel != null)      data.maxLevel      = parseInt(data.maxLevel);
    if (data.maxProgress != null)   data.maxProgress   = parseInt(data.maxProgress);
    if (data.rewardExp != null)     data.rewardExp     = parseInt(data.rewardExp);
    if (data.rewardYuan != null)    data.rewardYuan    = parseInt(data.rewardYuan);
    if (data.durationHours != null) data.durationHours = Math.max(1, parseInt(data.durationHours) || 24);

    if (data.element != null) {
      const validElements = ['any', 'Fogo', 'Água', 'Terra', 'Ar'];
      if (!validElements.includes(data.element)) {
        return res.status(400).json({ error: `Elemento inválido. Use: ${validElements.join(', ')}` });
      }
    }

    // Validação cruzada: se elemento != any, item deve combinar
    if (data.element && data.element !== 'any' && data.rewardItem) {
      const items = getAllItems();
      const item = items.find(i => i.name === data.rewardItem);
      if (item && item.element && item.element !== 'Neutro' && item.element !== data.element) {
        return res.status(400).json({
          error: `O item "${data.rewardItem}" é do elemento ${item.element}, mas a missão é do elemento ${data.element}.`,
        });
      }
    }

    const updated = await prisma.adminQuest.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar missão' });
  }
});

router.delete('/quests/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.adminQuest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar missão' });
  }
});

// PREMIUM — grant / revoke manual por admin
// Endpoints:
//   POST /api/admin/premium/grant          — concede premium a um usuário
//   POST /api/admin/premium/revoke         — cancela premium ativo

// Busca usuário pra preencher o painel de premium no frontend
router.get('/premium/search', adminMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username:  { contains: q, mode: 'insensitive' } },
          { discordId: { contains: q } },
        ],
      },
      include: {
        subscriptions: {
          where: { status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      take: 20,
    });

    res.json(users.map(u => ({
      id: u.id,
      discordId: u.discordId,
      username: u.username,
      avatar: u.avatar,
      currentPlan: u.subscriptions[0]?.planType || 'free',
      expiresAt:   u.subscriptions[0]?.expiresAt || null,
    })));
  } catch (error) {
    console.error('admin/premium/search:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Concede premium a um usuário (premium_user ou premium_server)
// body: { discordId, planType, days? }  (days default 30)
router.post('/premium/grant', adminMiddleware, async (req, res) => {
  const { discordId, userId, planType, days = 30 } = req.body;

  if (!['premium_user', 'premium_server'].includes(planType)) {
    return res.status(400).json({ error: 'planType deve ser "premium_user" ou "premium_server".' });
  }
  const durationDays = Math.max(1, Math.min(3650, parseInt(days) || 30));

  try {
    // Localiza o user
    let user;
    if (discordId) user = await prisma.user.findUnique({ where: { discordId } });
    else if (userId) user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado. Certifique-se que ele já fez login no dashboard.' });
    }

    // Cancela assinaturas ativas anteriores (single active sub)
    await prisma.subscription.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'canceled' },
    });

    // Cria nova assinatura
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        planType,
        status: 'active',
        expiresAt,
        paymentId: `admin-grant-${req.discordId}-${Date.now()}`,
      },
    });

    console.log(`⭐ Admin ${req.discordId} concedeu ${planType} a ${user.username} por ${durationDays} dias`);
    res.json({
      success: true,
      message: `${user.username} agora tem ${planType === 'premium_user' ? 'Premium Usuário' : 'Premium Servidor'} até ${expiresAt.toLocaleDateString('pt-BR')}.`,
      subscription: sub,
    });
  } catch (error) {
    console.error('admin/premium/grant:', error);
    res.status(500).json({ error: 'Erro ao conceder premium', detail: error.message });
  }
});

// Revoga premium ativo
router.post('/premium/revoke', adminMiddleware, async (req, res) => {
  const { discordId, userId } = req.body;
  try {
    let user;
    if (discordId) user = await prisma.user.findUnique({ where: { discordId } });
    else if (userId) user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const result = await prisma.subscription.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'canceled' },
    });

    console.log(`🗑️  Admin ${req.discordId} revogou premium de ${user.username} (${result.count} assinaturas canceladas)`);
    res.json({
      success: true,
      message: `Premium de ${user.username} cancelado (${result.count} assinatura${result.count !== 1 ? 's' : ''}).`,
      canceled: result.count,
    });
  } catch (error) {
    console.error('admin/premium/revoke:', error);
    res.status(500).json({ error: 'Erro ao revogar premium' });
  }
});

// Lista últimas 30 assinaturas ativas (painel de visão geral premium)
router.get('/premium/active', adminMiddleware, async (req, res) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: {
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { user: { select: { username: true, discordId: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json(subs.map(s => ({
      id: s.id,
      planType: s.planType,
      status: s.status,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
      user: s.user,
    })));
  } catch (error) {
    console.error('admin/premium/active:', error);
    res.status(500).json({ error: 'Erro ao listar assinaturas' });
  }
});

// LOJA YUAN — CRUD
// Itens comprados com moeda do jogo (Yuan), só admin edita.

router.get('/yuan-store', adminMiddleware, async (req, res) => {
  try {
    const items = await prisma.yuanStoreItem.findMany({
      orderBy: [{ isActive: 'desc' }, { minLevel: 'asc' }, { priceYuan: 'asc' }],
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar itens' });
  }
});

router.post('/yuan-store', adminMiddleware, async (req, res) => {
  const {
    name, description, type, icon = '📦',
    priceYuan, minLevel = 1, rarity = 'common',
    stock = -1,
  } = req.body;
  if (!name || !description || !type || priceYuan == null) {
    return res.status(400).json({ error: 'Campos obrigatórios: name, description, type, priceYuan' });
  }
  const validTypes = ['item', 'skill', 'consumable'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Tipo inválido. Use: ${validTypes.join(', ')}` });
  }
  try {
    const item = await prisma.yuanStoreItem.create({
      data: {
        name, description, type, icon,
        priceYuan: parseInt(priceYuan),
        minLevel: parseInt(minLevel) || 1,
        rarity,
        stock: parseInt(stock),
        isActive: true,
      },
    });
    res.json(item);
  } catch (error) {
    console.error('admin/yuan-store POST:', error);
    res.status(500).json({ error: 'Erro ao criar item' });
  }
});

router.patch('/yuan-store/:id', adminMiddleware, async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id; delete data.createdAt;
    if (data.priceYuan != null) data.priceYuan = parseInt(data.priceYuan);
    if (data.minLevel != null)  data.minLevel  = parseInt(data.minLevel);
    if (data.stock != null)     data.stock     = parseInt(data.stock);

    const updated = await prisma.yuanStoreItem.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

router.delete('/yuan-store/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.yuanStoreItem.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar item' });
  }
});

// CATÁLOGO DE ITENS — usado para dropdowns no painel admin
router.get('/items-catalog', adminMiddleware, async (req, res) => {
  try {
    const all = getAllItems();
    // escolhia o tipo "Consumível" no form da Loja Yuan, mas o backend só lia
    const { element, type } = req.query;
    let filtered = all;
    if (type) {
      filtered = filtered.filter(it => it.type === type);
    }
    if (element && element !== 'any') {
      filtered = filtered.filter(it => it.element === element || it.element === 'Neutro' || !it.element);
    }
    // Ordena por elemento, depois por raridade, depois nome
    const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    filtered.sort((a, b) => {
      if (a.element !== b.element) return (a.element || '').localeCompare(b.element || '');
      const ar = RARITY_RANK[a.rarity] || 0;
      const br = RARITY_RANK[b.rarity] || 0;
      if (ar !== br) return ar - br;
      return a.name.localeCompare(b.name);
    });
    res.json(filtered.map(it => ({
      id: it.id,
      name: it.name,
      type: it.type,
      element: it.element || 'Neutro',
      rarity: it.rarity || 'common',
      minLevel: it.minLevel || 1,
      stats: it.stats || {},
      price: it.price || 0,
    })));
  } catch (error) {
    console.error('admin/items-catalog:', error);
    res.status(500).json({ error: 'Erro ao buscar catálogo' });
  }
});

// CATÁLOGO DE SKILLS — para a Loja Yuan vender skills
router.get('/skills-catalog', adminMiddleware, async (req, res) => {
  try {
    const ELEMENT_FILTER = req.query.element;
    const all = Object.values(SKILLS);
    let filtered = ELEMENT_FILTER && ELEMENT_FILTER !== 'any'
      ? all.filter(s => s.element === ELEMENT_FILTER || s.element === 'Neutro')
      : all;

    // Ordena por elemento, depois nível
    filtered.sort((a, b) => {
      if (a.element !== b.element) return (a.element || '').localeCompare(b.element || '');
      return (a.minLevel || 1) - (b.minLevel || 1);
    });

    res.json(filtered.map(s => ({
      id: s.id,
      name: s.name,
      element: s.element || 'Neutro',
      icon: s.icon || '✨',
      minLevel: s.minLevel || 1,
      chiCost: s.chiCost || 0,
      baseDamageMin: s.baseDamageMin || 0,
      baseDamageMax: s.baseDamageMax || 0,
      cooldownTurns: s.cooldownTurns || 0,
      description: s.description || `${s.name} — Dobra de ${s.element || 'Neutro'}`,
      // Sugestão de raridade baseada em dano (pra Loja Yuan)
      rarity: s.baseDamageMax >= 100 ? 'rare' : s.baseDamageMax >= 40 ? 'uncommon' : 'common',
      // Sugestão de preço baseado em dano + chi
      suggestedPrice: Math.max(50, (s.baseDamageMax || 10) * 8 + (s.chiCost || 0) * 5),
    })));
  } catch (error) {
    console.error('admin/skills-catalog:', error);
    res.status(500).json({ error: 'Erro ao buscar catálogo de skills' });
  }
});

router.get('/clan-war', adminMiddleware, async (req, res) => {
  try {
    const events = await prisma.clanWarEvent.findMany({
      orderBy: { startsAt: 'desc' },
      take: 50,
    });
    res.json(events);
  } catch (error) {
    console.error('admin/clan-war GET:', error);
    res.status(500).json({ error: 'Erro ao listar eventos' });
  }
});

// POST /api/admin/clan-war — criar/lançar evento
router.post('/clan-war', adminMiddleware, async (req, res) => {
  const { name, description, startsAt, endsAt, launchNow = false } = req.body;
  if (!name || !endsAt) {
    return res.status(400).json({ error: 'Nome e data de término obrigatórios' });
  }
  try {
    const start = launchNow ? new Date() : new Date(startsAt);
    const end = new Date(endsAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Datas inválidas' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'Término deve ser depois do início' });
    }
    const event = await prisma.clanWarEvent.create({
      data: {
        name: name.substring(0, 80),
        description: description?.substring(0, 500) || null,
        startsAt: start,
        endsAt: end,
        status: launchNow ? 'active' : 'scheduled',
        createdBy: req.userId,
        scoreboard: {},
      },
    });
    if (launchNow) {
      const { invalidateActiveCache } = await import('../lib/clan-war.js');
      invalidateActiveCache();
    }
    res.json({ success: true, event, message: launchNow ? '🚀 Evento lançado!' : '📅 Evento agendado!' });
  } catch (error) {
    console.error('admin/clan-war POST:', error);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// PATCH /api/admin/clan-war/:id — atualizar status (active/finished) ou dados
router.patch('/clan-war/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, name, description, endsAt } = req.body;
  try {
    const data = {};
    if (status && ['scheduled', 'active', 'finished'].includes(status)) {
      data.status = status;
    }
    if (name) data.name = name.substring(0, 80);
    if (description !== undefined) data.description = description?.substring(0, 500) || null;
    if (endsAt) {
      const d = new Date(endsAt);
      if (!isNaN(d.getTime())) data.endsAt = d;
    }

    if (status === 'finished') {
      const { finalizeClanWarEvent } = await import('../lib/clan-war.js');
      const result = await finalizeClanWarEvent(id);
      if (result.ok) {
        return res.json({
          success: true,
          champion: result.champion,
          rewards: result.rewards,
          message: result.champion
            ? `🏆 ${result.champion.name} é o campeão! Recompensas distribuídas.`
            : (result.message || 'Evento encerrado sem campeão.'),
        });
      }
      // Se já tinha sido finalizado antes, ainda retorna o status atual
      if (result.error?.includes('já foram')) {
        return res.status(400).json({ error: result.error });
      }
      // Outros erros: cair no fluxo normal de update
    }

    const event = await prisma.clanWarEvent.update({ where: { id }, data });
    // Invalida cache se mudou status
    if (status) {
      const { invalidateActiveCache } = await import('../lib/clan-war.js');
      invalidateActiveCache();
    }
    res.json({ success: true, event });
  } catch (error) {
    console.error('admin/clan-war PATCH:', error);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// DELETE /api/admin/clan-war/:id
router.delete('/clan-war/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.clanWarEvent.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('admin/clan-war DELETE:', error);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  }
});

// GET /api/admin/notes
router.get('/notes', adminMiddleware, async (req, res) => {
  try {
    const notes = await prisma.adminNote.findMany({
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    res.json(notes);
  } catch (error) {
    console.error('admin/notes GET:', error);
    res.status(500).json({ error: 'Erro ao listar notas' });
  }
});

// POST /api/admin/notes
router.post('/notes', adminMiddleware, async (req, res) => {
  const { category = 'skill', title, element, description = '', metadata = {}, pinned = false } = req.body;
  if (!title || title.length < 1) return res.status(400).json({ error: 'Título obrigatório' });
  try {
    const note = await prisma.adminNote.create({
      data: {
        category: ['skill', 'item', 'feature', 'bug'].includes(category) ? category : 'skill',
        title: title.substring(0, 120),
        element: element || null,
        description: description.substring(0, 5000),
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
        pinned: !!pinned,
        createdBy: req.userId,
      },
    });
    res.json({ success: true, note });
  } catch (error) {
    console.error('admin/notes POST:', error);
    res.status(500).json({ error: 'Erro ao criar nota' });
  }
});

// PATCH /api/admin/notes/:id
router.patch('/notes/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { category, title, element, description, metadata, pinned } = req.body;
  try {
    const data = {};
    if (category && ['skill', 'item', 'feature', 'bug'].includes(category)) data.category = category;
    if (title) data.title = title.substring(0, 120);
    if (element !== undefined) data.element = element || null;
    if (description !== undefined) data.description = (description || '').substring(0, 5000);
    if (metadata && typeof metadata === 'object') data.metadata = metadata;
    if (pinned !== undefined) data.pinned = !!pinned;
    const note = await prisma.adminNote.update({ where: { id }, data });
    res.json({ success: true, note });
  } catch (error) {
    console.error('admin/notes PATCH:', error);
    res.status(500).json({ error: 'Erro ao atualizar nota' });
  }
});

// DELETE /api/admin/notes/:id
router.delete('/notes/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.adminNote.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('admin/notes DELETE:', error);
    res.status(500).json({ error: 'Erro ao deletar nota' });
  }
});

export default router;