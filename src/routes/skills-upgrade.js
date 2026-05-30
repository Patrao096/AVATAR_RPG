// backend/src/routes/skills-upgrade.js
//
// ROTAS:
// GET /api/skills/my → skills desbloqueadas do jogador com níveis
// POST /api/skills/upgrade → sobe skill de nível (custa Yuans)
// GET /api/skills/talent-tree → estado atual da árvore de talentos
// POST /api/skills/talent-spend → gasta PA em um nó da árvore
// GET /api/skills/shop → skills disponíveis para comprar (por elemento)

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  SKILLS,
  getLeveledSkill,
  getAvailableSkillsForShop,
  getSkillUpgradeCost,
} from '../lib/skills.js';

const router = express.Router();

// ─── Configuração da Árvore de Talentos ─────────────────────────────────
const TALENT_TREE = {
  corpo: [
    { node: 1, cost: 1, effect: 'hp_plus_15', label: '+15 HP máximo' },
    { node: 2, cost: 1, effect: 'hp_plus_15b', label: '+15 HP máximo' },
    { node: 3, cost: 2, effect: 'damage_reduction_10', label: '+10% redução de dano recebido' },
    { node: 4, cost: 3, effect: 'regen_3_hp_turn', label: 'Regenera 3 HP por turno passivamente' },
    { node: 5, cost: 3, effect: 'hp_plus_50', label: '+50 HP máximo' },
    { node: 6, cost: 5, effect: 'auto_shield_10pct', label: 'Ao chegar a 10% HP, ganha escudo de 40 pontos automaticamente' },
  ],
  espirito: [
    { node: 1, cost: 1, effect: 'chi_plus_10', label: '+10 Chi máximo' },
    { node: 2, cost: 1, effect: 'chi_plus_10b', label: '+10 Chi máximo' },
    { node: 3, cost: 2, effect: 'chi_regen_plus3', label: 'Regenera +3 Chi por turno' },
    { node: 4, cost: 3, effect: 'cooldown_minus1', label: 'Cooldown de todas as skills -1 turno' },
    { node: 5, cost: 3, effect: 'chi_plus_30', label: '+30 Chi máximo' },
    { node: 6, cost: 5, effect: 'ultimate_chi_back', label: 'Ao usar skill ULTIMATE, recupera 20 Chi imediatamente' },
  ],
  combate: [
    { node: 1, cost: 1, effect: 'atk_plus_3', label: '+3 ATK base' },
    { node: 2, cost: 1, effect: 'def_plus_3', label: '+3 DEF base' },
    { node: 3, cost: 2, effect: 'atk_def_plus_5_3', label: '+5 ATK e +3 DEF' },
    { node: 4, cost: 3, effect: 'crit_bonus_30', label: 'Ataques críticos causam +30% dano adicional' },
    { node: 5, cost: 3, effect: 'atk_def_plus_10', label: '+10 ATK e +10 DEF' },
    { node: 6, cost: 5, effect: 'guaranteed_crit', label: 'Uma vez por batalha, próximo ataque é garantidamente crítico' },
  ],
};

// ─── Aplica efeitos do talent tree ao personagem ──────────────────────────
function applyTalentTree(character, talentTree) {
  const bonuses = {
    hp: 0,
    chi: 0,
    attack: 0,
    defense: 0,
    chiRegenBonus: 0,
    hpRegenBonus: 0,
    cooldownReduction: 0,
    damageReduction: 0,
    critBonus: 0,
    passives: [],
  };

  const tree = talentTree || {};
  for (const [branch, level] of Object.entries(tree)) {
    const nodes = TALENT_TREE[branch] || [];
    for (let n = 0; n < Math.min(level, nodes.length); n++) {
      const node = nodes[n];
      switch (node.effect) {
        case 'hp_plus_15':
        case 'hp_plus_15b': bonuses.hp += 15; break;
        case 'hp_plus_50': bonuses.hp += 50; break;
        case 'chi_plus_10':
        case 'chi_plus_10b': bonuses.chi += 10; break;
        case 'chi_plus_30': bonuses.chi += 30; break;
        case 'atk_plus_3': bonuses.attack += 3; break;
        case 'def_plus_3': bonuses.defense += 3; break;
        case 'atk_def_plus_5_3': bonuses.attack += 5; bonuses.defense += 3; break;
        case 'atk_def_plus_10': bonuses.attack += 10; bonuses.defense += 10; break;
        case 'chi_regen_plus3': bonuses.chiRegenBonus += 3; break;
        case 'regen_3_hp_turn': bonuses.hpRegenBonus += 3; break;
        case 'cooldown_minus1': bonuses.cooldownReduction += 1; break;
        case 'damage_reduction_10': bonuses.damageReduction += 10; break;
        case 'crit_bonus_30': bonuses.critBonus += 30; break;
        case 'auto_shield_10pct': bonuses.passives.push('auto_shield_at_10pct'); break;
        case 'ultimate_chi_back': bonuses.passives.push('chi_back_on_ultimate'); break;
        case 'guaranteed_crit': bonuses.passives.push('guaranteed_crit_once'); break;
      }
    }
  }
  return bonuses;
}

// ROTAS

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
    const equipped = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];
    const upgrades = (typeof character.skillUpgrades === 'object' && character.skillUpgrades)
      ? character.skillUpgrades
      : {};

    const skills = unlocked.map(skillId => {
      const currentLevel = upgrades[skillId] || 1;
      const leveled = getLeveledSkill(skillId, currentLevel);
      if (!leveled) return null;

      const nextCost = currentLevel < 5 ? getSkillUpgradeCost(skillId, currentLevel) : null;

      return {
        ...leveled,
        currentLevel,
        isEquipped: equipped.includes(skillId),
        canUpgrade: currentLevel < 5,
        upgradeCost: nextCost,
        canAffordUpgrade: nextCost !== null ? (character.money >= nextCost) : false,
      };
    }).filter(Boolean);

    res.json({
      skills,
      unlockedCount: unlocked.length,
      equippedCount: equipped.length,
      money: character.money,
    });
  } catch (error) {
    console.error('skills/my:', error);
    res.status(500).json({ error: 'Erro ao buscar skills' });
  }
});

router.post('/upgrade', authMiddleware, async (req, res) => {
  const { skillId } = req.body;
  if (!skillId) return res.status(400).json({ error: 'skillId é obrigatório' });

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
    if (!unlocked.includes(skillId)) {
      return res.status(400).json({ error: 'Você não possui esta skill' });
    }

    const upgrades = (typeof character.skillUpgrades === 'object' && character.skillUpgrades)
      ? { ...character.skillUpgrades }
      : {};

    const currentLevel = upgrades[skillId] || 1;
    if (currentLevel >= 5) {
      return res.status(400).json({ error: 'Skill já está no nível máximo (5)' });
    }

    const cost = getSkillUpgradeCost(skillId, currentLevel);
    if (character.money < cost) {
      return res.status(400).json({ error: `Yuan insuficiente. Necessário: ${cost}` });
    }

    upgrades[skillId] = currentLevel + 1;
    const newLevel = upgrades[skillId];
    const leveled = getLeveledSkill(skillId, newLevel);

    await prisma.$transaction([
      prisma.character.update({
        where: { id: character.id },
        data: {
          money: { decrement: cost },
          skillUpgrades: upgrades,
        },
      }),
    ]);

    res.json({
      success: true,
      message: `✨ ${leveled.name} evoluída para o Nível ${newLevel}!`,
      skill: leveled,
      newLevel,
      cost,
      remainingYuan: character.money - cost,
      nextUpgradeCost: newLevel < 5 ? getSkillUpgradeCost(skillId, newLevel) : null,
    });
  } catch (error) {
    console.error('skills/upgrade:', error);
    res.status(500).json({ error: 'Erro ao fazer upgrade da skill' });
  }
});

router.get('/talent-tree', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const tree = (typeof character.talentTree === 'object' && character.talentTree)
      ? character.talentTree
      : { corpo: 0, espirito: 0, combate: 0 };

    const attributePoints = character.attributePoints || 0;
    const bonuses = applyTalentTree(character, tree);

    const treeView = {};
    for (const [branch, nodes] of Object.entries(TALENT_TREE)) {
      const currentLevel = tree[branch] || 0;
      treeView[branch] = nodes.map((node, idx) => ({
        ...node,
        unlocked: idx < currentLevel,
        isNext: idx === currentLevel,
        canAfford: attributePoints >= node.cost && idx === currentLevel,
      }));
    }

    res.json({
      tree,
      attributePoints,
      treeView,
      currentBonuses: bonuses,
    });
  } catch (error) {
    console.error('skills/talent-tree:', error);
    res.status(500).json({ error: 'Erro ao buscar árvore de talentos' });
  }
});

router.post('/talent-spend', authMiddleware, async (req, res) => {
  const { branch } = req.body;
  if (!branch || !TALENT_TREE[branch]) {
    return res.status(400).json({ error: 'Ramo inválido. Use: corpo, espirito ou combate' });
  }

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const tree = (typeof character.talentTree === 'object' && character.talentTree)
      ? { ...character.talentTree }
      : { corpo: 0, espirito: 0, combate: 0 };

    const currentLevel = tree[branch] || 0;
    const nodes = TALENT_TREE[branch];

    if (currentLevel >= nodes.length) {
      return res.status(400).json({ error: `Ramo ${branch} já está no máximo` });
    }

    const nextNode = nodes[currentLevel];
    const ap = character.attributePoints || 0;

    if (ap < nextNode.cost) {
      return res.status(400).json({
        error: `Pontos de Atributo insuficientes. Necessário: ${nextNode.cost}, Disponível: ${ap}`,
      });
    }

    tree[branch] = currentLevel + 1;

    await prisma.character.update({
      where: { id: character.id },
      data: {
        talentTree: tree,
        attributePoints: { decrement: nextNode.cost },
      },
    });

    res.json({
      success: true,
      message: `🌳 Nó desbloqueado: ${nextNode.label}`,
      branch,
      newLevel: tree[branch],
      node: nextNode,
      remainingAP: ap - nextNode.cost,
    });
  } catch (error) {
    console.error('skills/talent-spend:', error);
    res.status(500).json({ error: 'Erro ao gastar ponto de atributo' });
  }
});

router.get('/shop', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const element = character.element || 'Ar';
    const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
    const available = getAvailableSkillsForShop(element, character.level);

    const enriched = available.map(skill => {
      const baseCost = Math.max(50, (skill.baseDamageMax || 10) * 8 + (skill.chiCost || 0) * 5);
      return {
        ...skill,
        priceYuan: baseCost,
        owned: unlocked.includes(skill.id),
        canAfford: character.money >= baseCost,
      };
    });

    res.json({
      element,
      characterLevel: character.level,
      characterMoney: character.money,
      skills: enriched,
    });
  } catch (error) {
    console.error('skills/shop:', error);
    res.status(500).json({ error: 'Erro ao buscar loja de skills' });
  }
});

router.post('/shop/buy', authMiddleware, async (req, res) => {
  const { skillId } = req.body;
  if (!skillId) return res.status(400).json({ error: 'skillId é obrigatório' });

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const element = character.element || 'Ar';
    const available = getAvailableSkillsForShop(element, character.level);
    const skill = available.find(s => s.id === skillId);
    if (!skill) {
      return res.status(400).json({ error: 'Skill não disponível para compra ou fora do seu nível' });
    }

    const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
    if (unlocked.includes(skillId)) {
      return res.status(400).json({ error: 'Você já possui esta skill' });
    }

    const price = Math.max(50, (skill.baseDamageMax || 10) * 8 + (skill.chiCost || 0) * 5);
    if (character.money < price) {
      return res.status(400).json({ error: `Yuan insuficiente. Necessário: ${price}` });
    }

    await prisma.character.update({
      where: { id: character.id },
      data: {
        money: { decrement: price },
        unlockedSkills: [...unlocked, skillId],
      },
    });

    res.json({
      success: true,
      message: `✨ Skill ${skill.name} desbloqueada!`,
      skill,
      cost: price,
      remainingYuan: character.money - price,
    });
  } catch (error) {
    console.error('skills/shop/buy:', error);
    res.status(500).json({ error: 'Erro ao comprar skill' });
  }
});

// Exportações finais (apenas uma vez)
export { TALENT_TREE, applyTalentTree };
export default router;