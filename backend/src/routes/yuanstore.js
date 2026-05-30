// backend/src/routes/yuanstore.js
//
//   - GET /api/yuanstore/today → produtos do dia
//   - POST /api/yuanstore/daily-refresh → força rotação (admin ou cron)
//   - POST /api/yuanstore/buy → com quantidade + suporte a itens diários

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/auth.js';
import { findItemByName, findItemById, getAllItems } from '../lib/items-lookup.js';
import { SKILLS, getAvailableSkillsForShop } from '../lib/skills.js';

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────

function todayDateString() {
  return new Date().toISOString().split('T')[0]; // "2026-04-30"
}

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * Gera ou retorna a DailyStore do dia.
 * Cria automaticamente se não existir.
 */
async function getOrCreateDailyStore() {
  const today = todayDateString();

  const existing = await prisma.dailyStore.findUnique({ where: { date: today } });
  if (existing) return existing;

  // ── Sorteia os produtos do dia ──
  const allItems = getAllItems();
  const consumables = allItems.filter(i => i.type === 'consumable');
  const equipables  = allItems.filter(i => ['weapon', 'armor', 'amulet', 'accessory'].includes(i.type));

  // 1 skill aleatória (qualquer elemento, qualquer caminho, tier 1-3)
  const allSkills = Object.values(SKILLS).filter(s =>
    s.path !== null && s.tier <= 3 && s.tier >= 1
  );
  const pickedSkill = pickRandom(allSkills, 1)[0];

  // 3 itens equipáveis aleatórios (variedade de elementos e tipos)
  const pickedItems = pickRandom(equipables, 3);

  // 2 poções aleatórias
  const pickedPotions = pickRandom(consumables, 2);

  const dailyStore = await prisma.dailyStore.create({
    data: {
      date: today,
      skillId: pickedSkill.id,
      itemIds: pickedItems.map(i => i.id),
      potionIds: pickedPotions.map(i => i.id),
    },
  });

  return dailyStore;
}

/**
 * Enriquece um produto diário com info completa para o frontend.
 */
function enrichDailyProduct(idOrName, type, character) {
  if (type === 'skill') {
    const skill = SKILLS[idOrName];
    if (!skill) return null;
    const upgradeCost = Math.max(50, (skill.baseDamageMax || 10) * 8 + (skill.chiCost || 0) * 5);
    return {
      dailyId: idOrName,
      type: 'skill',
      name: skill.name,
      element: skill.element,
      icon: skill.icon,
      minLevel: skill.minLevel || 1,
      rarity: skill.tier >= 4 ? 'legendary' : skill.tier === 3 ? 'epic' : skill.tier === 2 ? 'uncommon' : 'common',
      priceYuan: upgradeCost,
      stock: 1,                    // skills: 1 por usuário
      description: skill.description,
      skillInfo: {
        damage: [skill.baseDamageMin, skill.baseDamageMax],
        chiCost: skill.chiCost,
        cooldown: skill.baseCooldownTurns,
        path: skill.path,
        passiveEffect: skill.passiveEffect,
      },
      alreadyOwned: Array.isArray(character?.unlockedSkills)
        ? character.unlockedSkills.includes(idOrName)
        : false,
      canAfford: (character?.money || 0) >= upgradeCost,
      meetsLevel: (character?.level || 1) >= (skill.minLevel || 1),
    };
  }

  // Item ou Poção
  const catalog = getAllItems().find(i => i.id === idOrName);
  if (!catalog) return null;
  return {
    dailyId: idOrName,
    type: catalog.type,
    name: catalog.name,
    element: catalog.element || 'Neutro',
    icon: catalog.icon || (catalog.type === 'consumable' ? '🧪' : '📦'),
    minLevel: catalog.minLevel || 1,
    rarity: catalog.rarity || 'common',
    priceYuan: catalog.price || 100,
    stock: -1,                   // itens: estoque ilimitado no diário (admin pode sobrescrever)
    description: catalog.description || '',
    stats: catalog.stats || {},
    passiveEffect: catalog.passiveEffect || null,
    passiveDescription: catalog.passiveDescription || null,
    effect: catalog.effect || null,
    isStackable: catalog.type === 'consumable' || catalog.type === 'material',
    maxBuyQuantity: 10,          // máximo por transação no diário
    canAfford: (character?.money || 0) >= (catalog.price || 100),
    meetsLevel: (character?.level || 1) >= (catalog.minLevel || 1),
  };
}

// GET /api/yuanstore/today — Produtos do dia
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const daily = await getOrCreateDailyStore();

    const products = [
      enrichDailyProduct(daily.skillId, 'skill', character),
      ...daily.itemIds.map(id => enrichDailyProduct(id, 'item', character)),
      ...daily.potionIds.map(id => enrichDailyProduct(id, 'consumable', character)),
    ].filter(Boolean);

    // Próximo refresh: meia-noite UTC
    const nextRefresh = new Date();
    nextRefresh.setUTCHours(24, 0, 0, 0);

    res.json({
      date: daily.date,
      characterLevel: character.level,
      characterMoney: character.money,
      products,
      nextRefreshAt: nextRefresh.toISOString(),
      nextRefreshMs: nextRefresh.getTime() - Date.now(),
    });
  } catch (error) {
    console.error('yuanstore/today GET:', error);
    res.status(500).json({ error: 'Erro ao buscar loja diária' });
  }
});

// POST /api/yuanstore/buy-daily — Comprar produto do dia
router.post('/buy-daily', authMiddleware, async (req, res) => {
  const { dailyId, type, quantity = 1 } = req.body;

  if (!dailyId || !type) {
    return res.status(400).json({ error: 'dailyId e type são obrigatórios' });
  }

  const buyQty = parseInt(quantity, 10);
  if (isNaN(buyQty) || buyQty < 1 || buyQty > 10) {
    return res.status(400).json({ error: 'Quantidade deve ser entre 1 e 10' });
  }

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const daily = await getOrCreateDailyStore();
    const validIds = [daily.skillId, ...daily.itemIds, ...daily.potionIds];

    if (!validIds.includes(dailyId)) {
      return res.status(400).json({ error: 'Produto não está disponível hoje' });
    }

    const product = enrichDailyProduct(dailyId, type, character);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    if (!product.meetsLevel) {
      return res.status(400).json({ error: `Requer nível ${product.minLevel}` });
    }

    const totalPrice = product.priceYuan * buyQty;
    if (character.money < totalPrice) {
      return res.status(400).json({ error: `Yuan insuficiente. Necessário: ${totalPrice}` });
    }

    const ops = [
      prisma.character.update({
        where: { id: character.id },
        data: { money: { decrement: totalPrice } },
      }),
    ];

    let infoMsg = '';

    // ─── SKILL ───
    if (type === 'skill') {
      if (buyQty > 1) return res.status(400).json({ error: 'Skills: máximo 1 por compra' });
      const skillData = SKILLS[dailyId];
      if (!skillData) return res.status(500).json({ error: 'Skill não encontrada no catálogo' });

      const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
      if (unlocked.includes(dailyId)) {
        return res.status(400).json({ error: 'Você já possui esta skill' });
      }
      unlocked.push(dailyId);
      ops.push(prisma.character.update({
        where: { id: character.id },
        data: { unlockedSkills: unlocked },
      }));
      infoMsg = `🎯 Skill "${skillData.name}" desbloqueada! Equipe-a no Loadout.`;

    // ─── ITEM / POÇÃO ───
    } else {
      const catalog = getAllItems().find(i => i.id === dailyId);
      if (!catalog) return res.status(404).json({ error: 'Item não encontrado' });

      const isStackable = catalog.type === 'consumable' || catalog.type === 'material';

      if (isStackable) {
        const existing = await prisma.inventoryItem.findFirst({
          where: { characterId: character.id, itemName: catalog.name },
        });
        if (existing) {
          ops.push(prisma.inventoryItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: buyQty } },
          }));
        } else {
          ops.push(prisma.inventoryItem.create({
            data: { characterId: character.id, itemName: catalog.name, quantity: buyQty },
          }));
        }
        infoMsg = `🧪 ${buyQty}x ${catalog.name} adicionado ao inventário!`;
      } else {
        for (let i = 0; i < buyQty; i++) {
          ops.push(prisma.inventoryItem.create({
            data: { characterId: character.id, itemName: catalog.name, quantity: 1 },
          }));
        }
        infoMsg = `⚔️ ${buyQty}x ${catalog.name} adquirido! Equipe no Inventário.`;
      }
    }

    await prisma.$transaction(ops);

    res.json({
      success: true,
      message: infoMsg,
      boughtQuantity: buyQty,
      totalSpent: totalPrice,
      remainingYuan: character.money - totalPrice,
    });

  } catch (error) {
    console.error('yuanstore/buy-daily:', error);
    res.status(500).json({ error: 'Erro ao comprar produto diário' });
  }
});

// POST /api/yuanstore/daily-refresh — Força rotação (admin/cron)
router.post('/daily-refresh', adminMiddleware, async (req, res) => {
  try {
    const today = todayDateString();

    // Deleta o registro do dia e recria com novos sorteios
    await prisma.dailyStore.deleteMany({ where: { date: today } });
    const newDaily = await getOrCreateDailyStore();

    const products = [
      enrichDailyProduct(newDaily.skillId, 'skill', null),
      ...newDaily.itemIds.map(id => enrichDailyProduct(id, 'item', null)),
      ...newDaily.potionIds.map(id => enrichDailyProduct(id, 'consumable', null)),
    ].filter(Boolean);

    res.json({
      success: true,
      message: `Loja diária renovada para ${today}`,
      date: newDaily.date,
      products,
    });
  } catch (error) {
    console.error('yuanstore/daily-refresh:', error);
    res.status(500).json({ error: 'Erro ao renovar loja diária' });
  }
});

// GET /api/yuanstore — Loja permanente (mantido do v5)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const items = await prisma.yuanStoreItem.findMany({
      where: { isActive: true, minLevel: { lte: character.level } },
      orderBy: [{ minLevel: 'asc' }, { priceYuan: 'asc' }],
    });

    const enriched = items.map(item => {
      const catalog = findItemByName(item.name);
      const isStackable = catalog?.type === 'consumable' || catalog?.type === 'material';
      return {
        ...item,
        catalogStats: catalog?.stats || null,
        catalogType: catalog?.type || item.type,
        passiveEffect: catalog?.passiveEffect || null,
        passiveDescription: catalog?.passiveDescription || null,
        isStackable,
        maxBuyQuantity: item.stock > 0 ? item.stock : 10,
        skillInfo: item.type === 'skill' ? extractSkillInfo(item) : null,
      };
    });

    res.json({
      characterLevel: character.level,
      characterMoney: character.money,
      items: enriched,
    });
  } catch (error) {
    console.error('yuanstore GET:', error);
    res.status(500).json({ error: 'Erro ao buscar loja' });
  }
});

function extractSkillInfo(item) {
  const match = item.description?.match(/skill:([\w_]+)/);
  if (!match) return null;
  const skill = SKILLS[match[1]];
  if (!skill) return null;
  return {
    id: skill.id, name: skill.name, element: skill.element, icon: skill.icon,
    damage: [skill.baseDamageMin, skill.baseDamageMax],
    chiCost: skill.chiCost, cooldown: skill.baseCooldownTurns,
    path: skill.path, passiveEffect: skill.passiveEffect,
  };
}

// POST /api/yuanstore/buy — Comprar da loja permanente (mantido do v5)
router.post('/buy', authMiddleware, async (req, res) => {
  const { itemId, quantity = 1 } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });

  const buyQuantity = parseInt(quantity, 10);
  if (isNaN(buyQuantity) || buyQuantity < 1) {
    return res.status(400).json({ error: 'Quantidade deve ser um número inteiro positivo' });
  }

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const item = await prisma.yuanStoreItem.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive) return res.status(404).json({ error: 'Item não disponível' });

    if (character.level < item.minLevel) {
      return res.status(400).json({ error: `Requer nível ${item.minLevel}` });
    }
    if (character.money < item.priceYuan * buyQuantity) {
      return res.status(400).json({ error: 'Yuan insuficiente' });
    }
    if (item.stock === 0 || (item.stock > 0 && item.stock < buyQuantity)) {
      return res.status(400).json({
        error: item.stock === 0 ? 'Item esgotado' : `Apenas ${item.stock} unidade(s) disponível.`,
      });
    }
    if (item.type === 'skill' && buyQuantity > 1) {
      return res.status(400).json({ error: 'Skills: máximo 1 por compra' });
    }

    const ops = [
      prisma.character.update({
        where: { id: character.id },
        data: { money: { decrement: item.priceYuan * buyQuantity } },
      }),
    ];

    let infoMsg = '';

    if (item.type === 'skill') {
      const match = item.description?.match(/skill:([\w_]+)/);
      const skillId = match ? match[1] : item.name.toLowerCase().replace(/\s+/g, '_');
      const skill = SKILLS[skillId];
      if (!skill) return res.status(500).json({ error: 'Skill não encontrada no catálogo' });
      const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
      if (unlocked.includes(skillId)) return res.status(400).json({ error: 'Você já possui esta skill' });
      unlocked.push(skillId);
      ops.push(prisma.character.update({ where: { id: character.id }, data: { unlockedSkills: unlocked } }));
      infoMsg = `🎯 Skill "${skill.name}" desbloqueada! Equipe-a no Loadout.`;
    } else {
      const catalog = findItemByName(item.name);
      const isStackable = catalog?.type === 'consumable' || catalog?.type === 'material';
      if (isStackable) {
        const existing = await prisma.inventoryItem.findFirst({ where: { characterId: character.id, itemName: item.name } });
        if (existing) {
          ops.push(prisma.inventoryItem.update({ where: { id: existing.id }, data: { quantity: { increment: buyQuantity } } }));
        } else {
          ops.push(prisma.inventoryItem.create({ data: { characterId: character.id, itemName: item.name, quantity: buyQuantity } }));
        }
      } else {
        for (let i = 0; i < buyQuantity; i++) {
          ops.push(prisma.inventoryItem.create({ data: { characterId: character.id, itemName: item.name, quantity: 1 } }));
        }
      }
      infoMsg = `📦 ${buyQuantity}x ${item.name} adicionado ao inventário!`;
    }

    if (item.stock > 0) {
      ops.push(prisma.yuanStoreItem.update({ where: { id: item.id }, data: { stock: { decrement: buyQuantity } } }));
    }

    await prisma.$transaction(ops);

    res.json({
      success: true,
      message: infoMsg,
      boughtQuantity: buyQuantity,
      remainingYuan: character.money - (item.priceYuan * buyQuantity),
    });
  } catch (error) {
    console.error('yuanstore/buy:', error);
    res.status(500).json({ error: 'Erro ao comprar item' });
  }
});

export default router;