// backend/src/routes/craft.js
//   - Receitas oficiais (mural) ainda existem mas são opcionais
//   - Usuário pode CRAFTAR LIVREMENTE escolhendo 2-4 ingredientes do inventário
//   - O sistema gera um item baseado nos ingredientes (mesmo tipo + raridade superior se possível)
//   - Custo de Yuan: 50 + (valor base dos ingredientes × 0.3)

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { findItemByName, getAllItems, isEquippable, isConsumable } from '../lib/items-lookup.js';

const router = express.Router();

const DEFAULT_RECIPES = [
  { name: 'Amuleto Avançado', resultItem: 'Amuleto do Ar +1', requiredItems: { 'Amuleto do Ar': 2 }, requiredYuan: 80, rarity: 'rare' },
  { name: 'Luvas do Dragão', resultItem: 'Luvas de Fogo', requiredItems: { 'Luvas de Fogo': 1, 'Pedra da Terra': 3 }, requiredYuan: 150, rarity: 'epic' },
  { name: 'Cristal de Água', resultItem: 'Cristal Puro', requiredItems: { 'Frasco de Água': 3 }, requiredYuan: 60, rarity: 'common' },
  { name: 'Armadura da Terra', resultItem: 'Armadura de Pedra', requiredItems: { 'Pedra da Terra': 5 }, requiredYuan: 120, rarity: 'rare' },
];

const RARITY_RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// ─── COMBINAÇÕES SECRETAS (expansível pelo desenvolvedor) ───
const SECRET_COMBINATIONS = [
  {
    name: 'Forja Ancestral do Dragão',
    requiredItems: { 'Luvas de Fogo': 1, 'Pedra da Terra': 2, 'Amuleto do Ar': 1 },
    resultItem: 'Luvas do Dragão Ancestral',
    requiredYuan: 350,
    rarity: 'legendary',
    message: '🔥 Combinação secreta desbloqueada! Item lendário criado com poder ancestral.'
  },
  {
    name: 'Cristal Eterno da Harmonia',
    requiredItems: { 'Cristal Puro': 1, 'Frasco de Água': 3, 'Amuleto do Ar': 2 },
    resultItem: 'Cristal Eterno da Harmonia',
    requiredYuan: 280,
    rarity: 'legendary',
    message: '💧 Combinação secreta desbloqueada! Cristal lendário de harmonia elemental.'
  },
  {
    name: 'Armadura do Titã Terrestre',
    requiredItems: { 'Pedra da Terra': 4, 'Luvas de Fogo': 1, 'Armadura de Pedra': 1 },
    resultItem: 'Armadura do Titã Terrestre',
    requiredYuan: 420,
    rarity: 'legendary',
    message: '🪨 Combinação secreta desbloqueada! Armadura lendária de titã terrestre.'
  },
  {
    name: 'Amuleto do Vento Furioso',
    requiredItems: { 'Amuleto do Ar': 3, 'Frasco de Água': 1 },
    resultItem: 'Amuleto do Vento Furioso',
    requiredYuan: 220,
    rarity: 'epic',
    message: '🌬️ Combinação secreta desbloqueada! Amuleto épico de vento furioso.'
  },
  // Adicione quantas combinações desejar aqui. O sistema aceita qualquer quantidade de 2 a 4 itens.
];

// ─── Receitas oficiais (legado) ───
router.get('/recipes', async (req, res) => {
  try {
    let recipes = await prisma.craftRecipe.findMany();
    if (recipes.length === 0) {
      await prisma.craftRecipe.createMany({ data: DEFAULT_RECIPES });
      recipes = await prisma.craftRecipe.findMany();
    }
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar receitas' });
  }
});

router.get('/catalog', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { inventory: true },
    });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    // Inventário do usuário (apenas com quantity > 0)
    const inventoryWithCatalog = character.inventory
      .filter(i => i.quantity > 0)
      .map(item => {
        const cat = findItemByName(item.itemName);
        return {
          inventoryId: item.id,
          itemName: item.itemName,
          quantity: item.quantity,
          isEquipped: item.isEquipped,
          isConsumableEquipped: item.isConsumableEquipped,
          type: cat?.type || 'misc',
          rarity: cat?.rarity || 'common',
          element: cat?.element || 'Neutro',
          stats: cat?.stats || {},
          price: cat?.price || 0,
          minLevel: cat?.minLevel || 1,
        };
      });

    res.json({ inventory: inventoryWithCatalog });
  } catch (error) {
    console.error('craft/catalog:', error);
    res.status(500).json({ error: 'Erro ao buscar catálogo' });
  }
});

// ─── Receita oficial: usar ingredientes pré-definidos ───
router.post('/craft', authMiddleware, async (req, res) => {
  const { recipeId } = req.body;
  try {
    const recipe = await prisma.craftRecipe.findUnique({ where: { id: recipeId } });
    if (!recipe) return res.status(404).json({ error: 'Receita não encontrada' });

    const character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { inventory: true },
    });

    if (character.money < recipe.requiredYuan) {
      return res.status(400).json({ error: 'Yuan insuficiente' });
    }

    const required = recipe.requiredItems;
    for (const [itemName, qty] of Object.entries(required)) {
      const item = character.inventory.find(i => i.itemName === itemName);
      if (!item || item.quantity < qty) {
        return res.status(400).json({ error: `${itemName} insuficiente (precisa de ${qty})` });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const [itemName, qty] of Object.entries(required)) {
        const item = character.inventory.find(i => i.itemName === itemName);
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: { decrement: qty } },
        });
      }
      await tx.character.update({
        where: { id: character.id },
        data: { money: { decrement: recipe.requiredYuan } },
      });
      await tx.inventoryItem.create({
        data: { characterId: character.id, itemName: recipe.resultItem, quantity: 1 },
      });
    });

    res.json({ success: true, item: recipe.resultItem });
  } catch (error) {
    console.error('craft/craft:', error);
    res.status(500).json({ error: 'Erro ao craftar item' });
  }
});

// ─── CRAFT LIVRE – Sistema Avançado com Combinações Secretas ───
// Body: { ingredients: [{ inventoryId, quantity }], targetType?: 'weapon'|'armor'|'amulet'|'consumable' }
// Sistema:
//   1. Verifica combinações secretas exatas (prioridade máxima)
//   2. Se não houver, aplica sinergia avançada (elemento + tipo + raridade)
//   3. Gera item único com bônus dinâmicos
//   4. Custo de Yuan: base 50 + soma do valor dos ingredientes × 0.3
router.post('/craft-free', authMiddleware, async (req, res) => {
  const { ingredients, targetType } = req.body;

  if (!Array.isArray(ingredients) || ingredients.length < 2 || ingredients.length > 4) {
    return res.status(400).json({ error: 'Utilize entre 2 e 4 ingredientes.' });
  }

  try {
    const character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { inventory: true },
    });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    // Resolve ingredientes
    const resolved = [];
    const elementCount = { Fogo: 0, Água: 0, Terra: 0, Ar: 0, Neutro: 0 };
    const typeCount = { weapon: 0, armor: 0, amulet: 0, consumable: 0, material: 0, misc: 0 };
    let rarityScore = 0;
    let totalValue = 0;

    for (const ing of ingredients) {
      const inv = character.inventory.find(i => i.id === ing.inventoryId);
      if (!inv) return res.status(400).json({ error: 'Ingrediente não encontrado no inventário.' });

      const qty = parseInt(ing.quantity) || 1;
      if (qty < 1 || inv.quantity < qty) {
        return res.status(400).json({ error: `${inv.itemName}: quantidade insuficiente.` });
      }
      if (inv.isEquipped || inv.isConsumableEquipped) {
        return res.status(400).json({ error: `${inv.itemName} está equipado. Desequipe antes.` });
      }

      const cat = findItemByName(inv.itemName);
      if (!cat) return res.status(400).json({ error: `${inv.itemName} não pode ser usado.` });

      const rarityIdx = RARITY_RANK.indexOf(cat.rarity || 'common');
      rarityScore += (rarityIdx >= 0 ? rarityIdx : 0) * qty;
      totalValue += (cat.price || 10) * qty;

      elementCount[cat.element || 'Neutro'] += qty;
      typeCount[cat.type || 'misc'] += qty;

      resolved.push({ inv, qty, cat });
    }

    const totalQty = resolved.reduce((s, r) => s + r.qty, 0);
    const baseYuanCost = Math.max(50, Math.floor(50 + totalValue * 0.3));

    // ─── 1. VERIFICAÇÃO DE COMBINAÇÕES SECRETAS (prioridade máxima) ───
    const providedMap = new Map();
    resolved.forEach(r => {
      const current = providedMap.get(r.cat.name) || 0;
      providedMap.set(r.cat.name, current + r.qty);
    });

    for (const secret of SECRET_COMBINATIONS) {
      let match = true;
      for (const [itemName, requiredQty] of Object.entries(secret.requiredItems)) {
        if ((providedMap.get(itemName) || 0) !== requiredQty) {
          match = false;
          break;
        }
      }
      // Verifica se não há ingredientes extras
      if (match && providedMap.size === Object.keys(secret.requiredItems).length) {
        const yuanCost = Math.max(baseYuanCost, secret.requiredYuan);

        if (character.money < yuanCost) {
          return res.status(400).json({ error: `Yuan insuficiente. Custo da combinação secreta: ${yuanCost}.` });
        }

        await prisma.$transaction(async (tx) => {
          for (const r of resolved) {
            const newQty = r.inv.quantity - r.qty;
            if (newQty <= 0) {
              await tx.inventoryItem.delete({ where: { id: r.inv.id } });
            } else {
              await tx.inventoryItem.update({ where: { id: r.inv.id }, data: { quantity: newQty } });
            }
          }
          await tx.character.update({
            where: { id: character.id },
            data: { money: { decrement: yuanCost } },
          });
          await tx.inventoryItem.create({
            data: { characterId: character.id, itemName: secret.resultItem, quantity: 1 },
          });
        });

        return res.json({
          success: true,
          result: { name: secret.resultItem, rarity: secret.rarity },
          yuanSpent: yuanCost,
          message: secret.message,
          isSecret: true,
        });
      }
    }

    // ─── 2. CRAFT LIVRE NORMAL COM SISTEMA DE SINERGIA ───
    if (character.money < baseYuanCost) {
      return res.status(400).json({ error: `Yuan insuficiente. Custo: ${baseYuanCost}.` });
    }

    // Cálculo de sinergia
    const dominantElement = Object.entries(elementCount)
      .sort((a, b) => b[1] - a[1])[0][0];

    // Bônus de sinergia por elemento (exemplo expansível)
    const synergyBonus = {
      'Fogo+Terra': elementCount.Fogo > 0 && elementCount.Terra > 0 ? 1 : 0,
      'Água+Ar': elementCount.Água > 0 && elementCount.Ar > 0 ? 1 : 0,
      // Adicione mais pares conforme necessário
    };
    let totalSynergy = Object.values(synergyBonus).reduce((a, b) => a + b, 0);

    // Determina tipo e raridade base
    let resultType = targetType && ['weapon', 'armor', 'amulet', 'consumable'].includes(targetType)
      ? targetType
      : Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0][0] || 'consumable';

    const avgRarityIdx = Math.floor(rarityScore / totalQty);
    let targetRarityIdx = Math.min(4, avgRarityIdx + (totalQty >= 4 ? 1 : 0) + totalSynergy);

    const targetRarity = RARITY_RANK[targetRarityIdx];

    // Busca candidatos no catálogo
    let candidates = getAllItems().filter(it =>
      it.type === resultType &&
      (it.element === dominantElement || it.element === 'Neutro') &&
      it.rarity === targetRarity &&
      (it.minLevel || 1) <= character.level
    );

    // Fallbacks inteligentes
    if (candidates.length === 0) {
      candidates = getAllItems().filter(it =>
        it.type === resultType && it.rarity === RARITY_RANK[Math.max(0, targetRarityIdx - 1)]
      );
    }
    if (candidates.length === 0) {
      candidates = getAllItems().filter(it => it.type === resultType);
    }

    if (candidates.length === 0) {
      return res.status(400).json({ error: 'Combinação inválida. Tente outros ingredientes.' });
    }

    candidates.sort((a, b) => (b.price || 0) - (a.price || 0));
    let result = candidates[0];

    // Anti-loop: evita devolver um dos ingredientes
    const ingredientNames = new Set(resolved.map(r => r.cat.name));
    if (ingredientNames.has(result.name)) {
      result = candidates.find(c => !ingredientNames.has(c.name)) || result;
    }

    // Transação final
    await prisma.$transaction(async (tx) => {
      for (const r of resolved) {
        const newQty = r.inv.quantity - r.qty;
        if (newQty <= 0) {
          await tx.inventoryItem.delete({ where: { id: r.inv.id } });
        } else {
          await tx.inventoryItem.update({ where: { id: r.inv.id }, data: { quantity: newQty } });
        }
      }
      await tx.character.update({
        where: { id: character.id },
        data: { money: { decrement: baseYuanCost } },
      });

      const stackable = result.type === 'consumable' || result.type === 'material';
      if (stackable) {
        const existing = await tx.inventoryItem.findFirst({
          where: { characterId: character.id, itemName: result.name },
        });
        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: 1 } },
          });
        } else {
          await tx.inventoryItem.create({ data: { characterId: character.id, itemName: result.name, quantity: 1 } });
        }
      } else {
        await tx.inventoryItem.create({ data: { characterId: character.id, itemName: result.name, quantity: 1 } });
      }
    });

    res.json({
      success: true,
      result: {
        name: result.name,
        type: result.type,
        element: result.element,
        rarity: result.rarity,
        stats: result.stats || {},
      },
      yuanSpent: baseYuanCost,
      message: `🔨 Você craftou ${result.name} (${result.rarity}) com sinergia ${totalSynergy}!`,
      synergyScore: totalSynergy,
    });
  } catch (error) {
    console.error('craft/craft-free:', error);
    res.status(500).json({ error: 'Erro interno ao processar o craft livre.' });
  }
});

export default router;