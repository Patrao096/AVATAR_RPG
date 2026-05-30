// backend/src/routes/quest.js
//
//   - Mural: lista missões ATIVAS criadas pelo admin (não cria automaticamente).
//   - Aceitar: usuário deve clicar em "Aceitar" no mural.
//             Ao aceitar, a missão recebe expiresAt = now + durationHours.
//             Só pode ser concluída ANTES do expires.
//   - Limite diário: Free = 1 missão concluída/dia, Premium = ilimitado.
//   - Free: só pode ter UMA missão ativa por vez.
//             Premium: até 5 ativas.
//   - Sem mais auto-geração de missões repetidas.

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { hasPremium } from '../lib/subscription-helper.js';
import { applyExpGain } from '../lib/progression.js';

const router = express.Router();

const FREE_DAILY_QUEST_LIMIT = 1;
const FREE_MAX_ACTIVE_QUESTS    = 1;
const PREMIUM_MAX_ACTIVE_QUESTS = 5;

async function refreshDailyQuests(character) {
  const now = new Date();
  const lastReset = character.questsResetAt ? new Date(character.questsResetAt) : new Date(0);
  if (now.getTime() - lastReset.getTime() >= 24 * 60 * 60 * 1000) {
    return prisma.character.update({
      where: { id: character.id },
      data: { questsCompletedToday: 0, questsResetAt: now },
    });
  }
  return character;
}

/**
 * Marca como FAILED missões expiradas (não-completadas que passaram do prazo).
 */
async function failExpiredQuests(characterId) {
  const now = new Date();
  await prisma.userQuest.updateMany({
    where: {
      characterId,
      isCompleted: false,
      isFailed: false,
      expiresAt: { lt: now },
    },
    data: { isFailed: true },
  });
}

// GET /api/quest/all — missões ATIVAS do usuário (não falhadas, não completadas)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    let character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    character = await refreshDailyQuests(character);
    await failExpiredQuests(character.id);

    const isPremium = await hasPremium(req.userId);

    const active = await prisma.userQuest.findMany({
      where: {
        characterId: character.id,
        isCompleted: false,
        isFailed: false,
      },
      orderBy: { acceptedAt: 'desc' },
    });

    res.json({
      isPremium,
      questsCompletedToday: character.questsCompletedToday,
      dailyLimit: isPremium ? null : FREE_DAILY_QUEST_LIMIT,
      maxActive: isPremium ? PREMIUM_MAX_ACTIVE_QUESTS : FREE_MAX_ACTIVE_QUESTS,
      remainingDaily: isPremium ? null : Math.max(0, FREE_DAILY_QUEST_LIMIT - character.questsCompletedToday),
      quests: active.map(q => ({
        ...q,
        timeRemainingMs: q.expiresAt ? Math.max(0, new Date(q.expiresAt).getTime() - Date.now()) : null,
      })),
    });
  } catch (error) {
    console.error('quest/all:', error);
    res.status(500).json({ error: 'Erro ao buscar missões' });
  }
});

// GET /api/quest/board — mural público (admin quests p/ o nível)
router.get('/board', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    await failExpiredQuests(character.id);

    const isPremium = await hasPremium(req.userId);
    const maxActive = isPremium ? PREMIUM_MAX_ACTIVE_QUESTS : FREE_MAX_ACTIVE_QUESTS;

    const quests = await prisma.adminQuest.findMany({
      where: {
        isActive: true,
        minLevel: { lte: character.level },
        maxLevel: { gte: character.level },
        // Filtro de elemento: aceita "any" ou o elemento exato do personagem
        OR: [
          { element: 'any' },
          { element: character.element || 'Ar' },
        ],
      },
      orderBy: { minLevel: 'asc' },
    });

    // Marca quais o usuário já pegou (ativas)
    const active = await prisma.userQuest.findMany({
      where: { characterId: character.id, isCompleted: false, isFailed: false },
      select: { adminQuestId: true },
    });
    const activeIds = new Set(active.map(q => q.adminQuestId).filter(Boolean));
    const activeCount = active.length;

    // Marca quais já completou (não pode pegar de novo enquanto ela existir nos completados)
    const completed = await prisma.userQuest.findMany({
      where: { characterId: character.id, isCompleted: true },
      select: { adminQuestId: true, createdAt: true },
    });
    // Permite re-aceitar uma missão completada após 24h
    const recentlyCompletedIds = new Set(
      completed
        .filter(q => Date.now() - new Date(q.createdAt).getTime() < 24 * 60 * 60 * 1000)
        .map(q => q.adminQuestId)
        .filter(Boolean)
    );

    res.json({
      isPremium,
      maxActive,
      activeCount,
      slotsRemaining: Math.max(0, maxActive - activeCount),
      quests: quests.map(q => ({
        ...q,
        alreadyTaken: activeIds.has(q.id),
        recentlyCompleted: recentlyCompletedIds.has(q.id),
      })),
    });
  } catch (error) {
    console.error('quest/board:', error);
    res.status(500).json({ error: 'Erro ao buscar mural' });
  }
});

// POST /api/quest/accept/:adminQuestId
router.post('/accept/:adminQuestId', authMiddleware, async (req, res) => {
  try {
    let character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    await failExpiredQuests(character.id);

    const adminQuest = await prisma.adminQuest.findUnique({ where: { id: req.params.adminQuestId } });
    if (!adminQuest || !adminQuest.isActive) {
      return res.status(404).json({ error: 'Missão não disponível' });
    }
    if (character.level < adminQuest.minLevel || character.level > adminQuest.maxLevel) {
      return res.status(400).json({ error: `Missão requer nível ${adminQuest.minLevel}-${adminQuest.maxLevel}` });
    }
    // Valida elemento
    if (adminQuest.element && adminQuest.element !== 'any' && adminQuest.element !== character.element) {
      return res.status(400).json({
        error: `Esta missão é exclusiva para dobradores de ${adminQuest.element}.`,
      });
    }

    const isPremium = await hasPremium(req.userId);
    const maxActive = isPremium ? PREMIUM_MAX_ACTIVE_QUESTS : FREE_MAX_ACTIVE_QUESTS;

    // Conta quantas estão ativas
    const activeCount = await prisma.userQuest.count({
      where: { characterId: character.id, isCompleted: false, isFailed: false },
    });
    if (activeCount >= maxActive) {
      return res.status(400).json({
        error: isPremium
          ? `Você já tem ${maxActive} missões ativas. Conclua ou aguarde expirar.`
          : `No plano Free, você só pode ter ${maxActive} missão ativa por vez. Conclua a atual antes de aceitar outra.`,
        maxActive,
        requiresPremium: !isPremium,
      });
    }

    // Já pegou essa específica?
    const existing = await prisma.userQuest.findFirst({
      where: { characterId: character.id, adminQuestId: adminQuest.id, isCompleted: false, isFailed: false },
    });
    if (existing) return res.status(400).json({ error: 'Missão já está ativa' });

    // Limite diário (free): mostra quantas faltam
    if (!isPremium) {
      character = await refreshDailyQuests(character);
      if (character.questsCompletedToday >= FREE_DAILY_QUEST_LIMIT) {
        return res.status(403).json({
          error: `Limite diário (${FREE_DAILY_QUEST_LIMIT} missão/dia) atingido no plano Free. Volte amanhã ou vire Premium.`,
          requiresPremium: true,
        });
      }
    }

    const now = new Date();
    const durationHours = adminQuest.durationHours || 24;
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    const created = await prisma.userQuest.create({
      data: {
        characterId: character.id,
        adminQuestId: adminQuest.id,
        title: adminQuest.title,
        description: adminQuest.description,
        type: adminQuest.type,
        maxProgress: adminQuest.maxProgress,
        rewardExp: adminQuest.rewardExp,
        rewardYuan: adminQuest.rewardYuan,
        rewardItem: adminQuest.rewardItem,
        acceptedAt: now,
        expiresAt,
      },
    });

    res.json({
      ...created,
      timeRemainingMs: expiresAt.getTime() - now.getTime(),
      message: `Missão aceita! Tem ${durationHours}h para concluir.`,
    });
  } catch (error) {
    console.error('quest/accept:', error);
    res.status(500).json({ error: 'Erro ao aceitar missão' });
  }
});

// POST /api/quest/abandon/:id — desistir de uma missão ativa
router.post('/abandon/:id', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const quest = await prisma.userQuest.findUnique({ where: { id: req.params.id } });
    if (!quest || quest.characterId !== character.id) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }
    if (quest.isCompleted || quest.isFailed) {
      return res.status(400).json({ error: 'Missão não está ativa' });
    }

    await prisma.userQuest.update({
      where: { id: quest.id },
      data: { isFailed: true },
    });

    res.json({ success: true, message: 'Missão abandonada.' });
  } catch (error) {
    console.error('quest/abandon:', error);
    res.status(500).json({ error: 'Erro ao abandonar missão' });
  }
});

// POST /api/quest/:id/complete — reivindicar recompensa
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    let character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    character = await refreshDailyQuests(character);

    const quest = await prisma.userQuest.findUnique({ where: { id: req.params.id } });
    if (!quest || quest.characterId !== character.id) {
      return res.status(404).json({ error: 'Missão não encontrada' });
    }
    if (quest.isCompleted) {
      return res.status(400).json({ error: 'Recompensa já coletada' });
    }
    if (quest.isFailed) {
      return res.status(400).json({ error: 'Missão expirada — não pode mais ser concluída.' });
    }
    if (quest.expiresAt && new Date(quest.expiresAt) < new Date()) {
      // Auto-marca como falhada
      await prisma.userQuest.update({ where: { id: quest.id }, data: { isFailed: true } });
      return res.status(400).json({ error: 'Missão expirada — não pode mais ser concluída.' });
    }
    if (quest.progress < quest.maxProgress) {
      return res.status(400).json({ error: 'Missão não concluída ainda' });
    }

    // Limite diário (free)
    const isPremium = await hasPremium(req.userId);
    if (!isPremium && character.questsCompletedToday >= FREE_DAILY_QUEST_LIMIT) {
      return res.status(403).json({
        error: `Limite diário (${FREE_DAILY_QUEST_LIMIT} missão/dia) já foi atingido. Volte amanhã ou vire Premium.`,
        requiresPremium: true,
      });
    }

    // Aplica EXP corretamente (controla level-up)
    const progression = applyExpGain(character, quest.rewardExp);

    await prisma.$transaction(async (tx) => {
      // Trava de concorrência: marca como concluída só se ainda não estava.
      // Dois cliques simultâneos → só um vê count 1 e segue para a recompensa.
      const claimed = await tx.userQuest.updateMany({
        where: { id: quest.id, isCompleted: false, isFailed: false },
        data: { isCompleted: true },
      });
      if (claimed.count !== 1) {
        throw new Error('ALREADY_CLAIMED');
      }

      await tx.character.update({
        where: { id: character.id },
        data: {
          exp: progression.newExp,
          level: progression.newLevel,
          attributePoints: progression.newAttributePoints,
          money: { increment: quest.rewardYuan },
          questsCompletedToday: { increment: 1 },
        },
      });

      if (quest.rewardItem) {
        // Tenta empilhar
        const existing = await tx.inventoryItem.findFirst({
          where: { characterId: character.id, itemName: quest.rewardItem },
        });
        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: 1 } },
          });
        } else {
          await tx.inventoryItem.create({
            data: { characterId: character.id, itemName: quest.rewardItem, quantity: 1 },
          });
        }
      }
    });
    res.json({
      success: true,
      rewardExp: quest.rewardExp,
      rewardYuan: quest.rewardYuan,
      rewardItem: quest.rewardItem,
      leveled: progression.leveled,
      levelsGained: progression.levelsGained,
      newLevel: progression.newLevel,
      questsRemainingToday: isPremium ? null : Math.max(0, FREE_DAILY_QUEST_LIMIT - (character.questsCompletedToday + 1)),
    });
  } catch (error) {
    if (error.message === 'ALREADY_CLAIMED') {
      return res.status(400).json({ error: 'Recompensa já coletada' });
    }
    console.error('quest/complete:', error);
    res.status(500).json({ error: 'Erro ao completar missão' });
  }
});

export default router;
