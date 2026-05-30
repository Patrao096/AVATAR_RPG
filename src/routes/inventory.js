// backend/src/routes/inventory.js
// Inventário + sistema de equipar GEAR (arma/armadura/amuleto)
// + sistema de equipar CONSUMÍVEIS (poções p/ arena).
//
// Skills e clan buff ficam em seus próprios endpoints.

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  findItemByName, getItemType, getItemStats, isEquippable, isConsumable,
  getConsumableEffect,
} from '../lib/items-lookup.js';
import { hasPremium } from '../lib/subscription-helper.js';

const router = express.Router();

// Limite de consumíveis equipados pra arena
// (cada um é um TIPO diferente de poção, pode ter N unidades no stack)
const CONSUMABLE_SLOTS_FREE    = 2;
const CONSUMABLE_SLOTS_PREMIUM = 4;

// GET /api/inventory
router.get('/', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { inventory: true },
    });
    if (!character) return res.json([]);

    const items = character.inventory.map(item => {
      const catalog = findItemByName(item.itemName);
      const type = catalog?.type || 'misc';
      return {
        ...item,
        type,
        rarity: catalog?.rarity || 'common',
        element: catalog?.element || 'Neutro',
        stats: catalog?.stats || {},
        description: catalog?.description || '',
        equippable: isEquippable(item.itemName),
        consumable: isConsumable(item.itemName),
        effect: isConsumable(item.itemName) ? getConsumableEffect(item.itemName) : null,
      };
    });
    res.json(items);
  } catch (error) {
    console.error('inventory GET:', error);
    res.status(500).json({ error: 'Erro ao buscar inventário' });
  }
});

// GET /api/inventory/equipped
// Retorna gear equipado + consumíveis equipados + bônus total.
router.get('/equipped', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: {
        inventory: {
          where: { OR: [{ isEquipped: true }, { isConsumableEquipped: true }] },
        },
      },
    });
    if (!character) {
      return res.json({
        gear: [], consumables: [],
        bonus: { attack: 0, defense: 0, chi: 0, hp: 0 },
      });
    }

    const gear = [];
    const consumables = [];
    for (const item of character.inventory) {
      const catalog = findItemByName(item.itemName);
      const enriched = {
        ...item,
        stats: catalog?.stats || {},
        type: catalog?.type || 'misc',
        effect: isConsumable(item.itemName) ? getConsumableEffect(item.itemName) : null,
      };
      if (item.isEquipped && isEquippable(item.itemName)) gear.push(enriched);
      if (item.isConsumableEquipped && isConsumable(item.itemName)) consumables.push(enriched);
    }

    const bonus = { attack: 0, defense: 0, chi: 0, hp: 0 };
    for (const item of gear) {
      for (const [k, v] of Object.entries(item.stats || {})) {
        if (bonus[k] !== undefined) bonus[k] += v;
      }
    }

    res.json({ gear, consumables, bonus });
  } catch (error) {
    console.error('inventory/equipped:', error);
    res.status(500).json({ error: 'Erro ao buscar equipados' });
  }
});

// POST /api/inventory/equip/:id  → equipa GEAR (arma/armadura/amuleto)
router.post('/equip/:id', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.characterId !== character.id) {
      return res.status(404).json({ error: 'Item não encontrado no seu inventário' });
    }

    const catalog = findItemByName(item.itemName);
    if (!catalog) return res.status(400).json({ error: 'Item não reconhecido' });
    if (!isEquippable(item.itemName)) {
      return res.status(400).json({ error: `Itens do tipo "${catalog.type}" não podem ser equipados aqui. Use /equip-consumable para poções.` });
    }
    if (character.level < (catalog.minLevel || 1)) {
      return res.status(400).json({ error: `Requer nível ${catalog.minLevel}.` });
    }

    const itemType = catalog.type;
    const currentlyEquipped = await prisma.inventoryItem.findMany({
      where: { characterId: character.id, isEquipped: true },
    });
    const toUnequip = currentlyEquipped
      .filter(i => {
        const cat = findItemByName(i.itemName);
        return cat?.type === itemType && i.id !== item.id;
      })
      .map(i => i.id);

    const ops = [];
    if (toUnequip.length > 0) {
      ops.push(prisma.inventoryItem.updateMany({
        where: { id: { in: toUnequip } },
        data: { isEquipped: false },
      }));
    }
    ops.push(prisma.inventoryItem.update({
      where: { id: item.id },
      data: { isEquipped: true },
    }));

    await prisma.$transaction(ops);
    res.json({
      success: true,
      message: `${item.itemName} equipado!`,
      stats: catalog.stats,
    });
  } catch (error) {
    console.error('inventory/equip:', error);
    res.status(500).json({ error: 'Erro ao equipar item' });
  }
});

// POST /api/inventory/unequip/:id
router.post('/unequip/:id', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.characterId !== character.id) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    if (!item.isEquipped) {
      return res.status(400).json({ error: 'Item não está equipado' });
    }

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { isEquipped: false },
    });
    res.json({ success: true, message: `${item.itemName} desequipado.` });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desequipar item' });
  }
});

// CONSUMÍVEIS (poções) — equipar p/ usar em arena

// POST /api/inventory/equip-consumable/:id
router.post('/equip-consumable/:id', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.characterId !== character.id) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    if (!isConsumable(item.itemName)) {
      return res.status(400).json({ error: 'Este item não é um consumível.' });
    }
    if (item.isConsumableEquipped) {
      return res.status(400).json({ error: 'Item já está equipado.' });
    }
    if (item.quantity < 1) {
      return res.status(400).json({ error: 'Quantidade insuficiente.' });
    }

    // Verifica limite de slots
    const isPremium = await hasPremium(req.userId);
    const maxSlots = isPremium ? CONSUMABLE_SLOTS_PREMIUM : CONSUMABLE_SLOTS_FREE;

    const equippedCount = await prisma.inventoryItem.count({
      where: { characterId: character.id, isConsumableEquipped: true },
    });
    if (equippedCount >= maxSlots) {
      return res.status(400).json({
        error: `Limite de ${maxSlots} poções equipadas atingido (${isPremium ? 'Premium' : 'Free'}).${!isPremium ? ' Premium tem mais slots.' : ''}`,
        limit: maxSlots,
        isPremium,
      });
    }

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { isConsumableEquipped: true },
    });
    res.json({
      success: true,
      message: `${item.itemName} pronto para usar na arena!`,
      effect: getConsumableEffect(item.itemName),
    });
  } catch (error) {
    console.error('inventory/equip-consumable:', error);
    res.status(500).json({ error: 'Erro ao equipar consumível' });
  }
});

// POST /api/inventory/unequip-consumable/:id
router.post('/unequip-consumable/:id', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!item || item.characterId !== character.id) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    if (!item.isConsumableEquipped) {
      return res.status(400).json({ error: 'Consumível não está equipado.' });
    }

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { isConsumableEquipped: false },
    });
    res.json({ success: true, message: `${item.itemName} desequipado.` });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao desequipar consumível' });
  }
});

// GET /api/inventory/consumable-slots
router.get('/consumable-slots', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const isPremium = await hasPremium(req.userId);
    const maxSlots = isPremium ? CONSUMABLE_SLOTS_PREMIUM : CONSUMABLE_SLOTS_FREE;
    const equippedCount = await prisma.inventoryItem.count({
      where: { characterId: character.id, isConsumableEquipped: true },
    });

    res.json({
      used: equippedCount,
      max: maxSlots,
      isPremium,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar slots' });
  }
});

/**
 * Helper — soma de stats de itens GEAR equipados (p/ arena).
 */
export async function computeEquipBonus(characterId) {
  const items = await prisma.inventoryItem.findMany({
    where: { characterId, isEquipped: true },
  });
  const bonus = { attack: 0, defense: 0, chi: 0, hp: 0 };
  for (const item of items) {
    const stats = getItemStats(item.itemName) || {};
    for (const [k, v] of Object.entries(stats)) {
      if (bonus[k] !== undefined) bonus[k] += v;
    }
  }
  return bonus;
}

/**
 * Helper — lista consumíveis equipados p/ arena (snapshot no início da batalha).
 * Retorna: [{ id, itemName, quantity, effect }]
 */
export async function getEquippedConsumables(characterId) {
  const items = await prisma.inventoryItem.findMany({
    where: { characterId, isConsumableEquipped: true, quantity: { gt: 0 } },
  });
  return items.map(item => ({
    id: item.id,
    itemName: item.itemName,
    quantity: item.quantity,
    effect: getConsumableEffect(item.itemName),
  })).filter(i => i.effect);
}

export default router;
