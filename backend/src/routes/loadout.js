// backend/src/routes/loadout.js
// Loadout para arena: skills equipadas + buff de clã ativo.
//
// FREE: 3 slots de skills
// PREMIUM: 6 slots
// Skills devem estar em unlockedSkills + nível mínimo cumprido.
// Ataque Básico é automaticamente disponível (não ocupa slot).

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { SKILLS } from '../lib/skills.js';
import { hasPremium } from '../lib/subscription-helper.js';

const router = express.Router();

const SKILL_SLOTS_FREE    = 3;
const SKILL_SLOTS_PREMIUM = 6;

// Lista skills que PODEM ser equipadas (disponíveis ao jogador)
// + o loadout atual.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const isPremium = await hasPremium(req.userId);
    const maxSlots = isPremium ? SKILL_SLOTS_PREMIUM : SKILL_SLOTS_FREE;

    const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
    const equipped = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];

    // Monta lista de todas as skills disponíveis pro jogador
    const available = [];

    // Exceção: skill base do elemento (dobra_<elemento>) sempre disponível
    // (vem após cap. 1 da história, mas pra retrocompat aceitamos mesmo sem unlock).
    const baseSkillForCharElement = ({
      Fogo: 'dobra_fogo', 'Água': 'dobra_agua', Terra: 'dobra_terra', Ar: 'dobra_ar',
    })[character.element];

    // Skill base elemental — sempre disponível pra equipar
    if (baseSkillForCharElement && SKILLS[baseSkillForCharElement]) {
      const skill = SKILLS[baseSkillForCharElement];
      if (character.level >= (skill.minLevel || 1)) {
        available.push({
          ...skill,
          source: 'elemental_base',
          equipped: equipped.includes(skill.id),
        });
      }
    }

    // Outras skills só se estiverem em unlockedSkills
    for (const skillId of unlocked) {
      if (skillId === baseSkillForCharElement) continue; // já adicionou
      const skill = SKILLS[skillId];
      if (!skill) continue;
      if (character.level < (skill.minLevel || 1)) continue;
      // Filtra elemento — não pode equipar skill de outro elemento
      if (skill.element !== 'Neutro' && skill.element !== character.element) continue;
      available.push({
        ...skill,
        source: skill.tier === 4 ? 'story' : 'unlocked',
        equipped: equipped.includes(skill.id),
      });
    }

    // Ordena: equipadas primeiro, depois tier asc
    available.sort((a, b) => {
      if (a.equipped !== b.equipped) return a.equipped ? -1 : 1;
      return a.tier - b.tier;
    });

    res.json({
      isPremium,
      maxSlots,
      slotsUsed: equipped.length,
      equipped,          // array de IDs
      available,         // lista completa com flag `equipped`
      clanBuffActive: character.clanBuffActive,
    });
  } catch (error) {
    console.error('loadout GET:', error);
    res.status(500).json({ error: 'Erro ao buscar loadout' });
  }
});

// POST /api/loadout/equip-skill
router.post('/equip-skill', authMiddleware, async (req, res) => {
  const { skillId } = req.body;
  if (!skillId) return res.status(400).json({ error: 'skillId obrigatório' });

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const skill = SKILLS[skillId];
    if (!skill) return res.status(400).json({ error: 'Skill inválida' });
    if (skill.tier === 0) return res.status(400).json({ error: 'Ataque Básico já está sempre disponível.' });
    if (character.level < skill.minLevel) {
      return res.status(400).json({ error: `Requer nível ${skill.minLevel}.` });
    }

    // Validação de acesso à skill
    const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
    //   1. A skill BASE do elemento (dobra_fogo / dobra_agua / etc.) é
    //      sempre liberada automaticamente após o cap. 1.
    //   2. Outras skills do elemento exigem estar em `unlockedSkills`
    //      (ganha por capítulo de história ou comprando na loja).
    //   3. Skills lendárias/eventos ficam em unlocked também.
    const baseSkillForCharElement = ({
      Fogo: 'dobra_fogo', 'Água': 'dobra_agua', Terra: 'dobra_terra', Ar: 'dobra_ar',
    })[character.element];
    const isBaseElementalSkill = (skillId === baseSkillForCharElement);
    const isUnlocked = unlocked.includes(skillId);
    if (!isBaseElementalSkill && !isUnlocked) {
      return res.status(400).json({
        error: 'Skill não desbloqueada. Compre na Loja Yuan ou avance na história.',
      });
    }
    // Verifica também o elemento (não dá pra equipar skill de outro elemento mesmo que esteja em unlocked)
    if (skill.element !== 'Neutro' && skill.element !== character.element) {
      return res.status(400).json({ error: 'Skill de outro elemento. Você só pode equipar skills do seu elemento.' });
    }

    const equipped = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];
    if (equipped.includes(skillId)) {
      return res.status(400).json({ error: 'Skill já equipada.' });
    }

    const isPremium = await hasPremium(req.userId);
    const maxSlots = isPremium ? SKILL_SLOTS_PREMIUM : SKILL_SLOTS_FREE;
    if (equipped.length >= maxSlots) {
      return res.status(400).json({
        error: `Limite de ${maxSlots} skills equipadas atingido (${isPremium ? 'Premium' : 'Free'}).${!isPremium ? ' Premium tem 6 slots.' : ''}`,
        limit: maxSlots,
      });
    }

    const newEquipped = [...equipped, skillId];
    await prisma.character.update({
      where: { id: character.id },
      data: { equippedSkills: newEquipped },
    });

    res.json({ success: true, equipped: newEquipped, message: `${skill.name} equipada!` });
  } catch (error) {
    console.error('loadout/equip-skill:', error);
    res.status(500).json({ error: 'Erro ao equipar skill' });
  }
});

// POST /api/loadout/unequip-skill
router.post('/unequip-skill', authMiddleware, async (req, res) => {
  const { skillId } = req.body;
  if (!skillId) return res.status(400).json({ error: 'skillId obrigatório' });

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const equipped = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];
    if (!equipped.includes(skillId)) {
      return res.status(400).json({ error: 'Skill não está equipada.' });
    }

    const newEquipped = equipped.filter(s => s !== skillId);
    await prisma.character.update({
      where: { id: character.id },
      data: { equippedSkills: newEquipped },
    });

    const skill = SKILLS[skillId];
    res.json({ success: true, equipped: newEquipped, message: `${skill?.name || skillId} desequipada.` });
  } catch (error) {
    console.error('loadout/unequip-skill:', error);
    res.status(500).json({ error: 'Erro ao desequipar skill' });
  }
});

// POST /api/loadout/toggle-clan-buff
router.post('/toggle-clan-buff', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const newVal = !character.clanBuffActive;
    await prisma.character.update({
      where: { id: character.id },
      data: { clanBuffActive: newVal },
    });

    res.json({
      success: true,
      clanBuffActive: newVal,
      message: newVal ? 'Bônus de clã ativado.' : 'Bônus de clã desativado.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar bônus de clã' });
  }
});

// GET /api/loadout/clan-buff — retorna dados do buff de clã (se houver clã)
router.get('/clan-buff', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const member = await prisma.clanMember.findUnique({
      where: { userId: req.userId },
      include: { clan: true },
    });

    if (!member) {
      return res.json({ hasClan: false, buff: null, clanBuffActive: character.clanBuffActive });
    }

    const clan = member.clan;
    const buff = calculateClanBuff(clan);

    res.json({
      hasClan: true,
      clanBuffActive: character.clanBuffActive,
      clan: {
        id: clan.id, name: clan.name, element: clan.element,
        level: clan.level, wins: clan.wins,
      },
      buff,
    });
  } catch (error) {
    console.error('loadout/clan-buff:', error);
    res.status(500).json({ error: 'Erro ao buscar buff de clã' });
  }
});

/**
 * Calcula bônus passivo de clã pro membro.
 * Escala com level do clã (cresce 1 stat por nível).
 */
export function calculateClanBuff(clan) {
  if (!clan) return { attack: 0, defense: 0, chi: 0, hp: 0 };
  const lvl = Math.max(1, clan.level || 1);
  // Bônus distribuído por elemento do clã
  const base = {
    Fogo:  { attack: 2, defense: 0, chi: 1, hp: 0 },
    'Água':{ attack: 1, defense: 1, chi: 2, hp: 0 },
    Terra: { attack: 0, defense: 3, chi: 0, hp: 5 },
    Ar:    { attack: 1, defense: 1, chi: 3, hp: 0 },
  }[clan.element] || { attack: 1, defense: 1, chi: 1, hp: 2 };

  return {
    attack:  base.attack  * lvl,
    defense: base.defense * lvl,
    chi:     base.chi     * lvl,
    hp:      base.hp      * lvl,
  };
}

/**
 * Helper: dado um characterId, retorna o buff efetivo de clã
 * (0 se o usuário desativou ou não tem clã).
 */
export async function getEffectiveClanBuff(characterId, userId) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
  });
  if (!character || !character.clanBuffActive) {
    return { attack: 0, defense: 0, chi: 0, hp: 0 };
  }
  const member = await prisma.clanMember.findUnique({
    where: { userId },
    include: { clan: true },
  });
  if (!member || !member.clan) return { attack: 0, defense: 0, chi: 0, hp: 0 };
  return calculateClanBuff(member.clan);
}

export default router;
