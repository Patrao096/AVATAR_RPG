// backend/src/routes/battle.js
// Sistema de batalha em turnos com:
//   - Skills equipadas (loadout do jogador)
//   - Consumíveis equipados (poções) usáveis na arena
//   - Bônus de clã (se ativo)
//   - Quantidades de consumíveis decrementadas no inventário ao usar

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  enqueue, dequeue, getQueueStats, finishBattle, isInBattle,
  registerMatchCreator, createBotBattle, leaveBattle,
} from '../lib/matchmaking.js';
import {
  calculateEloChange, getRankFromElo, getNextTier, getRankProgress,
} from '../lib/ranks.js';
import {
  SKILLS, ATTACK_BASIC,
  calculateCooldownTurns, calculateDamage, calculateDamageDetailed,
  getEquippedSkillsForBattle, getElementalMultiplier, rollStatusApplication,
} from '../lib/skills.js';
import { hasPremium } from '../lib/subscription-helper.js';
import { applyExpGain } from '../lib/progression.js';
import { computeEquipBonus, getEquippedConsumables } from './inventory.js';
import { getEffectiveClanBuff } from './loadout.js';
import {
  createBattle as createBattleState,
  getBattleState, getSideForUser, oppositeSide, isSideTurn,
  applyDamage, consumeChi, setSkillCooldown, isSkillOnCooldown,
  switchTurn, endBattleState, serializeStateForSide,
  pushLog, getLogs, setOutcome, getOutcome, getActiveBattleForUser,
  applyConsumable, setDefending, pushMove, getMoveHistory,
} from '../lib/battle-state.js';
import { chooseBossAction, getBossPersonality } from '../lib/boss-ai.js';
import {
  applyStatusEffect, runTurnStartHooks, applySkillUseModifiers,
  STATUS_EFFECTS,
} from '../lib/status-effects.js';
import {
  registerClanWarBattle, getClanEventBuffMultiplier,
} from '../lib/clan-war.js';

const router = express.Router();

const FREE_DAILY_BATTLE_LIMIT = 8;

const FALLBACK_BOTS = [
  { name: 'Katara',  element: 'Água',  icon: '💧', attack: 28, defense: 18, level: 3,  elo: 600,  maxHp: 100 },
  { name: 'Zuko',    element: 'Fogo',  icon: '🔥', attack: 35, defense: 15, level: 5,  elo: 900,  maxHp: 110 },
  { name: 'Toph',    element: 'Terra', icon: '🪨', attack: 24, defense: 32, level: 4,  elo: 750,  maxHp: 120 },
  { name: 'Aang',    element: 'Ar',    icon: '🌬️', attack: 30, defense: 22, level: 8,  elo: 1400, maxHp: 115 },
  { name: 'Azula',   element: 'Fogo',  icon: '⚡', attack: 40, defense: 18, level: 10, elo: 1800, maxHp: 120 },
  { name: 'Iroh',    element: 'Fogo',  icon: '🍵', attack: 38, defense: 28, level: 12, elo: 2100, maxHp: 130 },
  { name: 'Pakku',   element: 'Água',  icon: '❄️', attack: 34, defense: 26, level: 11, elo: 1950, maxHp: 125 },
  { name: 'Bumi',    element: 'Terra', icon: '👴', attack: 32, defense: 40, level: 13, elo: 2250, maxHp: 140 },
];

function pickFallbackBot(playerElo) {
  return [...FALLBACK_BOTS].sort((a, b) => Math.abs(a.elo - playerElo) - Math.abs(b.elo - playerElo))[0];
}

async function refreshDailyBattles(character) {
  const now = new Date();
  const lastReset = character.battlesResetAt ? new Date(character.battlesResetAt) : new Date(0);
  if (now.getTime() - lastReset.getTime() >= 24 * 60 * 60 * 1000) {
    return prisma.character.update({
      where: { id: character.id },
      data: { battlesToday: 0, battlesResetAt: now },
    });
  }
  return character;
}

const pvpPreflightCache = new Map();

registerMatchCreator((entryA, entryB) => {
  const battleId = `pvp-${Date.now()}-${entryA.userId}-${entryB.userId}`;

  const dataA = pvpPreflightCache.get(entryA.userId) || {};
  const dataB = pvpPreflightCache.get(entryB.userId) || {};

  createBattleState(battleId, {
    userId: entryA.userId,
    characterId: dataA.characterId,
    name: entryA.name,
    element: entryA.element,
    elo: entryA.elo,
    level: entryA.level,
    attack: entryA.attack,
    defense: entryA.defense,
    maxHp: dataA.maxHp || entryA.maxHp,
    hp: dataA.maxHp || entryA.maxHp,
    maxChi: dataA.maxChi || 50,
    chi: dataA.maxChi || 50,
    equipBonus: dataA.equipBonus || { attack: 0, defense: 0, chi: 0, hp: 0 },
    clanBuff: dataA.clanBuff || { attack: 0, defense: 0, chi: 0, hp: 0 },
    equippedSkillIds: dataA.equippedSkillIds || [],
    consumables: dataA.consumables || [],
    isBot: false,
  }, {
    userId: entryB.userId,
    characterId: dataB.characterId,
    name: entryB.name,
    element: entryB.element,
    elo: entryB.elo,
    level: entryB.level,
    attack: entryB.attack,
    defense: entryB.defense,
    maxHp: dataB.maxHp || entryB.maxHp,
    hp: dataB.maxHp || entryB.maxHp,
    maxChi: dataB.maxChi || 50,
    chi: dataB.maxChi || 50,
    equipBonus: dataB.equipBonus || { attack: 0, defense: 0, chi: 0, hp: 0 },
    clanBuff: dataB.clanBuff || { attack: 0, defense: 0, chi: 0, hp: 0 },
    equippedSkillIds: dataB.equippedSkillIds || [],
    consumables: dataB.consumables || [],
    isBot: false,
  }, { isPvP: true });

  pvpPreflightCache.delete(entryA.userId);
  pvpPreflightCache.delete(entryB.userId);

  return battleId;
});

router.get('/queue/stats', async (req, res) => {
  try {
    const stats = getQueueStats();
    const onlineHoje = await prisma.battleLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
    res.json({
      online: stats.onlineInSystem + Math.max(0, Math.floor(onlineHoje / 10)),
      queueSize: stats.queueSize,
      battlesHoje: onlineHoje,
      waitSeconds: stats.queueSize > 0 ? 5 : 8,
    });
  } catch (e) {
    res.json({ online: 0, queueSize: 0, battlesHoje: 0, waitSeconds: 8 });
  }
});

router.get('/limits', authMiddleware, async (req, res) => {
  try {
    let character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    character = await refreshDailyBattles(character);
    const isPremium = await hasPremium(req.userId);
    res.json({
      isPremium,
      battlesToday: character.battlesToday,
      dailyLimit: isPremium ? null : FREE_DAILY_BATTLE_LIMIT,
      remaining: isPremium ? null : Math.max(0, FREE_DAILY_BATTLE_LIMIT - character.battlesToday),
      resetAt: character.battlesResetAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar limites' });
  }
});

router.post('/queue/join', authMiddleware, async (req, res) => {
  try {
    let character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { user: true },
    });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    if (!character.element || character.element === 'Nenhum') {
      return res.status(400).json({
        error: 'Complete o Capítulo 1 da História antes de batalhar.',
        needsStory: true,
      });
    }

    character = await refreshDailyBattles(character);
    const isPremium = await hasPremium(req.userId);
    if (!isPremium && character.battlesToday >= FREE_DAILY_BATTLE_LIMIT) {
      return res.status(403).json({
        error: `Limite diário atingido (${FREE_DAILY_BATTLE_LIMIT}/dia). Vire Premium.`,
        requiresPremium: true,
      });
    }

    if (isInBattle(req.userId)) {
      // Auto-recuperação: se o estado da batalha não existe mais (limpou),
      // mas o matchmaking ainda registra o usuário, libera ele.
      const stale = getActiveBattleForUser(req.userId);
      if (!stale) {
        // Estado da batalha já foi limpo, mas matchmaking não registrou —
        // libera o usuário e segue.
        leaveBattle(req.userId);
      } else {
        // Existe uma batalha de verdade ativa
        return res.status(400).json({
          error: 'Você já está em uma batalha. Termine ela antes de entrar em outra.',
          activeBattleId: stale.battleId,
        });
      }
    }

    // ─── Snapshot de loadout do jogador ───
    const equipBonus = await computeEquipBonus(character.id);
    const clanBuff = await getEffectiveClanBuff(character.id, req.userId);
    const equippedConsumables = await getEquippedConsumables(character.id);
    const equippedSkillIds = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];

    const fullMaxHp = character.maxHp + (equipBonus.hp || 0) + (clanBuff.hp || 0);
    const fullMaxChi = character.maxChi + (equipBonus.chi || 0) + (clanBuff.chi || 0);

    pvpPreflightCache.set(req.userId, {
      characterId: character.id,
      hp: fullMaxHp, maxHp: fullMaxHp,
      chi: fullMaxChi, maxChi: fullMaxChi,
      equipBonus,
      clanBuff,
      equippedSkillIds,
      consumables: equippedConsumables.map(c => ({
        inventoryId: c.id,
        itemName: c.itemName,
        quantity: c.quantity,
        effect: c.effect,
      })),
    });

    const payload = {
      userId: req.userId,
      characterId: character.id,
      name: character.name,
      element: character.element,
      level: character.level,
      elo: character.elo,
      attack: character.attack,
      defense: character.defense,
      maxHp: fullMaxHp,
      avatar: character.user.avatar,
    };

    const result = await enqueue(payload);

    if (result.type === 'match') {
      const mySide = result.mySide;
      const opp = result.opponent;

      return res.json({
        type: 'match',
        battleId: result.battleId,
        mySide,
        player: {
          name: character.name,
          element: character.element,
          level: character.level,
          elo: character.elo,
          attack: character.attack,
          defense: character.defense,
          hp: fullMaxHp,
          maxHp: fullMaxHp,
          chi: fullMaxChi,
          maxChi: fullMaxChi,
          rank: getRankFromElo(character.elo),
          equipBonus,
          clanBuff,
        },
        opponent: {
          name: opp.name,
          element: opp.element,
          icon: elementIcon(opp.element),
          attack: opp.attack,
          defense: opp.defense,
          level: opp.level,
          elo: opp.elo,
          rank: getRankFromElo(opp.elo),
          maxHp: opp.maxHp,
          isBot: false,
          avatar: opp.avatar,
        },
      });
    }

    if (result.type === 'timeout') {
      pvpPreflightCache.delete(req.userId);
      const bot = pickFallbackBot(character.elo);
      const battleId = `bot-${Date.now()}-${req.userId}`;

      createBattleState(battleId, {
        userId: req.userId,
        characterId: character.id,
        name: character.name,
        element: character.element,
        elo: character.elo,
        level: character.level,
        attack: character.attack,
        defense: character.defense,
        maxHp: fullMaxHp, hp: fullMaxHp,
        maxChi: fullMaxChi, chi: fullMaxChi,
        equipBonus,
        clanBuff,
        equippedSkillIds,
        consumables: equippedConsumables.map(c => ({
          inventoryId: c.id,
          itemName: c.itemName,
          quantity: c.quantity,
          effect: c.effect,
        })),
        isBot: false,
      }, {
        userId: null,
        name: bot.name,
        element: bot.element,
        level: bot.level,
        attack: bot.attack,
        defense: bot.defense,
        maxHp: bot.maxHp, hp: bot.maxHp,
        maxChi: 50, chi: 50,
        elo: bot.elo,
        equippedSkillIds: [],
        consumables: [],
        isBot: true,
      }, { isPvP: false });

      createBotBattle(req.userId, battleId);

      return res.json({
        type: 'match',
        battleId,
        mySide: 'A',
        player: {
          name: character.name,
          element: character.element,
          level: character.level,
          elo: character.elo,
          attack: character.attack,
          defense: character.defense,
          hp: fullMaxHp, maxHp: fullMaxHp,
          chi: fullMaxChi, maxChi: fullMaxChi,
          rank: getRankFromElo(character.elo),
          equipBonus,
          clanBuff,
        },
        opponent: { ...bot, rank: getRankFromElo(bot.elo), isBot: true },
      });
    }

    pvpPreflightCache.delete(req.userId);
    if (result.type === 'cancelled') return res.status(200).json({ type: 'cancelled' });
    if (result.type === 'error')     return res.status(400).json({ error: result.error });
    return res.status(500).json({ error: 'Erro inesperado na fila' });
  } catch (error) {
    console.error('queue/join:', error);
    pvpPreflightCache.delete(req.userId);
    res.status(500).json({ error: 'Erro ao entrar na fila' });
  }
});

router.post('/queue/leave', authMiddleware, async (req, res) => {
  pvpPreflightCache.delete(req.userId);
  const removed = dequeue(req.userId);
  res.json({ success: removed });
});

router.get('/state', authMiddleware, async (req, res) => {
  const battleId = req.query.battleId;
  if (!battleId) return res.status(400).json({ error: 'battleId obrigatório' });

  const mySide = getSideForUser(battleId, req.userId);
  if (!mySide) return res.status(403).json({ error: 'Você não está nesta batalha.' });

  const state = serializeStateForSide(battleId, mySide);
  if (!state) return res.status(404).json({ error: 'Batalha não encontrada.' });

  const logs = getLogs(battleId).slice(-10);
  const outcome = getOutcome(battleId);

  let myOutcome = null;
  if (outcome === mySide) myOutcome = 'won';
  else if (outcome) myOutcome = 'lost';

  res.json({
    ...state,
    logs,
    outcome: myOutcome,
  });
});

// Retorna SOMENTE skills equipadas para a arena.
router.get('/skills', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const equipped = getEquippedSkillsForBattle(character);
    const battleId = req.query.battleId;
    let myCooldowns = {};

    if (battleId) {
      const mySide = getSideForUser(battleId, req.userId);
      if (mySide) {
        const state = getBattleState(battleId);
        myCooldowns = state?.sides[mySide]?.cooldowns || {};
      }
    }

    // Inserido no topo (a UI renderiza em destaque).
    // Se o jogador equipou o "soco" (raro mas possível), evitamos duplicar.
    const hasManualBasic = equipped.some(s => s.id === 'ataque_basico');
    const allSkills = hasManualBasic ? equipped : [ATTACK_BASIC, ...equipped];

    const skills = allSkills.map(skill => ({
      ...skill,
      cooldownTurns: calculateCooldownTurns(skill, character),
      turnsRemaining: myCooldowns[skill.id] || 0,
    }));

    res.json(skills);
  } catch (error) {
    console.error('battle/skills:', error);
    res.status(500).json({ error: 'Erro ao buscar skills' });
  }
});

router.post('/use-skill', authMiddleware, async (req, res) => {
  const { battleId, skillId } = req.body;
  if (!battleId || !skillId) return res.status(400).json({ error: 'battleId e skillId obrigatórios' });

  try {
    const mySide = getSideForUser(battleId, req.userId);
    if (!mySide) return res.status(403).json({ error: 'Você não está nesta batalha.' });

    const state = getBattleState(battleId);
    if (!state) return res.status(404).json({ error: 'Batalha não encontrada.' });

    if (state.turn !== mySide) {
      return res.status(400).json({ error: 'Não é seu turno.' });
    }

    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const skill = SKILLS[skillId];
    if (!skill) return res.status(400).json({ error: 'Skill inválida' });
    if (character.level < skill.minLevel) {
      return res.status(400).json({ error: `Requer nível ${skill.minLevel}` });
    }

    // ─── Validação de skill EQUIPADA ───
    if (skill.tier !== 0) {
      const equipped = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];
      if (!equipped.includes(skill.id)) {
        return res.status(400).json({
          error: 'Esta skill não está equipada. Equipe em "Loadout" antes da batalha.',
        });
      }
      if (skill.tier === 4) {
        const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
        if (!unlocked.includes(skill.id)) {
          return res.status(400).json({ error: 'Skill ainda não desbloqueada.' });
        }
      }
    }

    if (isSkillOnCooldown(battleId, mySide, skill.id)) {
      const turns = state.sides[mySide].cooldowns[skill.id];
      return res.status(400).json({ error: `Skill em cooldown (${turns} turno${turns > 1 ? 's' : ''})` });
    }

    const mySideState = state.sides[mySide];
    const oppSide = oppositeSide(mySide);
    const oppSideState = state.sides[oppSide];

    if (mySideState.chi < skill.chiCost) {
      return res.status(400).json({ error: 'Chi insuficiente' });
    }

    const dmgInfo = calculateDamageDetailed(skill, mySideState, oppSideState, mySideState.buffs);
    const damage = dmgInfo.damage;

    consumeChi(battleId, mySide, skill.chiCost);
    if (damage > 0) applyDamage(battleId, oppSide, damage);

    let cdTurns = calculateCooldownTurns(skill, character);
    cdTurns = applySkillUseModifiers(mySideState, skill, cdTurns);
    if (cdTurns > 0) setSkillCooldown(battleId, mySide, skill.id, cdTurns);

    // Só aplica se o ataque conectou (não dodge) e o oponente está vivo.
    let statusApplied = null;
    if (!dmgInfo.isDodge && state.sides[oppSide].hp > 0) {
      const roll = rollStatusApplication(skill);
      if (roll) {
        const inst = applyStatusEffect(state.sides[oppSide], roll.statusId, { duration: roll.duration });
        if (inst) {
          statusApplied = { id: inst.id, label: inst.label, icon: inst.icon, turnsRemaining: inst.turnsRemaining };
        }
      }
    }

    // Histórico para a IA do bot reagir a padrões do jogador
    pushMove(battleId, mySide, { action: 'skill', skillId: skill.id, turn: state.turnNumber });

    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: mySideState.name,
      skillIcon: skill.icon,
      skillName: skill.name,
      damage,
      chiCost: skill.chiCost,
      isCrit: dmgInfo.isCrit,
      isDodge: dmgInfo.isDodge,
      elementalMult: dmgInfo.elementalMult,
      statusApplied,
      turnNumber: state.turnNumber,
    });

    if (state.sides[oppSide].hp <= 0) {
      setOutcome(battleId, mySide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome: 'won',
      });
    }

    switchTurn(battleId);

    if (!state.isPvP && state.sides[oppSide].isBot) {
      const { outcome } = resolveBotTurnAndReturnToPlayer(battleId, mySide, oppSide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome,
      });
    }

    res.json({
      success: true,
      state: serializeStateForSide(battleId, mySide),
      logs: getLogs(battleId).slice(-10),
      outcome: 'continue',
    });
  } catch (error) {
    console.error('use-skill:', error);
    res.status(500).json({ error: 'Erro ao usar skill' });
  }
});

// POST /api/battle/use-consumable
// Body: { battleId, consumableInventoryId }
// Usa um consumível equipado. NÃO consome turno.
router.post('/use-consumable', authMiddleware, async (req, res) => {
  const { battleId, consumableInventoryId } = req.body;
  if (!battleId || !consumableInventoryId) {
    return res.status(400).json({ error: 'battleId e consumableInventoryId obrigatórios' });
  }

  try {
    const mySide = getSideForUser(battleId, req.userId);
    if (!mySide) return res.status(403).json({ error: 'Você não está nesta batalha.' });

    const state = getBattleState(battleId);
    if (!state) return res.status(404).json({ error: 'Batalha não encontrada.' });

    if (state.turn !== mySide) {
      return res.status(400).json({ error: 'Você só pode usar consumíveis no seu turno.' });
    }

    // Aplica efeito no estado in-memory
    const result = applyConsumable(battleId, mySide, consumableInventoryId);
    if (!result.applied) {
      return res.status(400).json({ error: result.message });
    }

    // Decrementa quantidade no banco
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    const dbItem = await prisma.inventoryItem.findUnique({ where: { id: consumableInventoryId } });

    if (dbItem && dbItem.characterId === character.id) {
      const newQty = Math.max(0, dbItem.quantity - 1);
      if (newQty === 0) {
        // Remove item zerado
        await prisma.inventoryItem.delete({ where: { id: dbItem.id } });
      } else {
        await prisma.inventoryItem.update({
          where: { id: dbItem.id },
          data: { quantity: newQty },
        });
      }
    }

    pushMove(battleId, mySide, { action: 'potion', turn: state.turnNumber });
    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: state.sides[mySide].name,
      skillIcon: result.itemName ? '🧪' : '✨',
      skillName: `Usou ${result.itemName || 'poção'}`,
      damage: result.oppDamage || 0,
      consumable: true,
      consumableEffect: result.message,
      hpHealed: result.hpHealed || 0,
      chiRestored: result.chiRestored || 0,
      buffApplied: result.buffApplied,
      statusCleared: result.statusCleared || 0,
      turnNumber: state.turnNumber,
    });

    const oppSide = oppositeSide(mySide);
    if (result.oppDamage && state.sides[oppSide].hp <= 0) {
      setOutcome(battleId, mySide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome: 'won',
        effect: result,
      });
    }

    // Usar consumível NÃO passa turno — jogador pode atacar/defender depois.
    res.json({
      success: true,
      state: serializeStateForSide(battleId, mySide),
      logs: getLogs(battleId).slice(-10),
      outcome: 'continue',
      effect: result,
    });
  } catch (error) {
    console.error('use-consumable:', error);
    res.status(500).json({ error: 'Erro ao usar consumível' });
  }
});

router.post('/defend', authMiddleware, async (req, res) => {
  const { battleId } = req.body;
  if (!battleId) return res.status(400).json({ error: 'battleId obrigatório' });

  try {
    const mySide = getSideForUser(battleId, req.userId);
    if (!mySide) return res.status(403).json({ error: 'Você não está nesta batalha.' });

    const state = getBattleState(battleId);
    if (!state) return res.status(404).json({ error: 'Batalha não encontrada.' });
    if (state.turn !== mySide) return res.status(400).json({ error: 'Não é seu turno.' });

    const oppSide = oppositeSide(mySide);

    // Assim, quando o oponente atacar, o calculateDamageDetailed lê
    // `defender.defending === true` e reduz o dano em 50%.
    setDefending(battleId, mySide, true);
    pushMove(battleId, mySide, { action: 'defend', turn: state.turnNumber });

    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: state.sides[mySide].name,
      skillIcon: '🛡️',
      skillName: 'Defender',
      damage: 0,
      chiCost: 0,
      defending: true,
      turnNumber: state.turnNumber,
    });

    switchTurn(battleId);

    if (!state.isPvP && state.sides[oppSide].isBot) {
      const { outcome } = resolveBotTurnAndReturnToPlayer(battleId, mySide, oppSide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome,
      });
    }

    res.json({
      success: true,
      state: serializeStateForSide(battleId, mySide),
      logs: getLogs(battleId).slice(-10),
      outcome: 'continue',
    });
  } catch (error) {
    console.error('defend:', error);
    res.status(500).json({ error: 'Erro ao defender' });
  }
});

router.post('/end', authMiddleware, async (req, res) => {
  const { battleId, opponentName, opponentElement, opponentElo = 500, result } = req.body;
  if (!opponentName || !result) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    let character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    // ─── Detecta batalha amistosa pela state ANTES de limpar ───
    const battleState = getBattleState(battleId);
    const isFriendly = !!battleState?.isFriendly;

    if (isFriendly) {
      // Amistosa: 50% EXP, sem ELO, sem wins/losses, sem quota, sem money grande
      const won = result === 'win';
      const baseExp = won ? 25 : 8;            // ~50% do normal
      const baseMoney = won ? 10 : 3;
      const progression = applyExpGain(character, baseExp);

      await prisma.character.update({
        where: { id: character.id },
        data: {
          exp:   progression.newExp,
          level: progression.newLevel,
          attributePoints: progression.newAttributePoints,
          money: { increment: baseMoney },
        },
      });

      finishBattle(battleId);
      endBattleState(battleId);

      return res.json({
        isFriendly: true,
        expGained: baseExp,
        moneyGained: baseMoney,
        leveled: progression.leveled,
        levelsGained: progression.levelsGained,
        newLevel: progression.newLevel,
        newExp: progression.newExp,
        expRequired: progression.expRequired,
        eloChange: 0,
        newElo: character.elo,
        rank: getRankFromElo(character.elo),
        rankUp: false,
        rankDown: false,
      });
    }

    // ─── Caminho normal (PvP/bot ranqueado) ───
    character = await refreshDailyBattles(character);

    const won = result === 'win';
    const eloChange = calculateEloChange(character.elo, opponentElo, won);
    const newElo = Math.max(0, character.elo + eloChange);
    const newRank = getRankFromElo(newElo);
    const oldRank = getRankFromElo(character.elo);

    const eloBonus = Math.floor(opponentElo / 500);
    let expGained   = won ? (40 + Math.floor(Math.random() * 20) + eloBonus * 5) : 10;
    let moneyGained = won ? (20 + Math.floor(Math.random() * 15) + eloBonus * 3) : 5;

    const buffMult = await getClanEventBuffMultiplier(req.userId);
    let buffApplied = null;
    if (buffMult > 1.0) {
      const expBonus = Math.round(expGained * (buffMult - 1));
      const moneyBonus = Math.round(moneyGained * (buffMult - 1));
      expGained += expBonus;
      moneyGained += moneyBonus;
      buffApplied = { multiplier: buffMult, expBonus, moneyBonus };
    }

    // ─── Aplica EXP corretamente ───
    // EXP é acumulada DENTRO do nível atual; só sobe quando atinge o threshold do nível.
    const progression = applyExpGain(character, expGained);

    await prisma.$transaction([
      prisma.battleLog.create({
        data: {
          characterId: character.id,
          opponentName,
          opponentElement: opponentElement || 'Desconhecido',
          result, expGained, moneyGained, eloChange,
        },
      }),
      prisma.character.update({
        where: { id: character.id },
        data: {
          wins:    won  ? { increment: 1 } : undefined,
          losses:  !won ? { increment: 1 } : undefined,
          // ↓ valor absoluto, não increment, pois pode ter resetado depois do level-up
          exp:     progression.newExp,
          level:   progression.newLevel,
          attributePoints: progression.newAttributePoints,
          money:   { increment: moneyGained },
          elo:     newElo,
          peakElo: newElo > character.peakElo ? newElo : undefined,
          rankTier: newRank.id,
          battlesToday: { increment: 1 },
        },
      }),
      prisma.userQuest.updateMany({
        where: { characterId: character.id, type: 'battle', isCompleted: false, isFailed: false },
        data: { progress: { increment: won ? 1 : 0 } },
      }),
    ]);

    let clanWarResult = null;
    if (battleState?.isPvP) {
      try {
        const mySideId = getSideForUser(battleId, req.userId);
        const oppSide = oppositeSide(mySideId);
        const oppUserId = battleState.sides[oppSide]?.userId;
        if (oppUserId) {
          const winnerUserId = won ? req.userId : oppUserId;
          const loserUserId  = won ? oppUserId : req.userId;
          clanWarResult = await registerClanWarBattle({ winnerUserId, loserUserId });
        }
      } catch (e) {
        console.warn('clan-war register (não-fatal):', e.message);
      }
    }

    // ─── Libera o usuário da batalha IMEDIATAMENTE ───
    finishBattle(battleId);
    endBattleState(battleId);

    res.json({
      expGained, moneyGained,
      buffApplied,
      clanWar: clanWarResult,
      leveled: progression.leveled,
      levelsGained: progression.levelsGained,
      newLevel: progression.newLevel,
      newExp: progression.newExp,
      expRequired: progression.expRequired,
      eloChange, newElo, rank: newRank,
      rankUp:   newRank.id !== oldRank.id && newElo > character.elo,
      rankDown: newRank.id !== oldRank.id && newElo < character.elo,
    });
  } catch (error) {
    console.error('battle/end:', error);
    res.status(500).json({ error: 'Erro ao salvar batalha' });
  }
});

router.get('/history', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    const logs = await prisma.battleLog.findMany({
      where: { characterId: character.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

router.get('/rank', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    const rank = getRankFromElo(character.elo);
    const next = getNextTier(character.elo);
    const progress = getRankProgress(character.elo);
    res.json({
      elo: character.elo,
      peakElo: character.peakElo,
      rank, nextTier: next, progress,
      wins: character.wins, losses: character.losses,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar rank' });
  }
});

router.get('/active', authMiddleware, async (req, res) => {
  const state = getActiveBattleForUser(req.userId);
  if (!state) return res.json({ active: false });
  const mySide = getSideForUser(state.battleId, req.userId);
  const oppSide = oppositeSide(mySide);
  const opp = state.sides[oppSide];
  const me = state.sides[mySide];

  res.json({
    active: true,
    battleId: state.battleId,
    mySide,
    isPvP: !!state.isPvP,
    player: {
      name: me.name,
      element: me.element,
      hp: me.hp, maxHp: me.maxHp,
      chi: me.chi, maxChi: me.maxChi,
      level: me.level,
      elo: me.elo,
      attack: me.attack, defense: me.defense,
      rank: getRankFromElo(me.elo),
      equipBonus: me.equipBonus,
      clanBuff: me.clanBuff,
    },
    opponent: {
      name: opp.name,
      element: opp.element,
      icon: elementIcon(opp.element),
      hp: opp.hp, maxHp: opp.maxHp,
      level: opp.level,
      elo: opp.elo,
      attack: opp.attack, defense: opp.defense,
      rank: getRankFromElo(opp.elo),
      isBot: opp.isBot,
    },
  });
});

function elementIcon(element) {
  return { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' }[element] || '⚔️';
}

function resolveBotTurnAndReturnToPlayer(battleId, mySide, oppSide) {
  const state = getBattleState(battleId);
  if (!state || !state.sides[oppSide].isBot) return { outcome: 'continue' };

  // ── 1. Status no bot ──
  const botStatus = runTurnStartHooks(state.sides[oppSide]);
  for (const ev of botStatus.logs) {
    pushLog(battleId, {
      attackerSide: oppSide,
      attackerName: state.sides[oppSide].name,
      skillIcon: STATUS_EFFECTS[ev.statusId]?.icon || '⚡',
      skillName: 'Status',
      damage: ev.hpDelta < 0 ? -ev.hpDelta : 0,
      isStatusTick: true,
      statusId: ev.statusId,
      statusMessage: ev.message,
      turnNumber: state.turnNumber,
    });
  }
  if (botStatus.died || state.sides[oppSide].hp <= 0) {
    setOutcome(battleId, mySide);
    return { outcome: 'won' };
  }

  // ── 2. Bot age (ou pula) ──
  if (botStatus.skipTurn) {
    pushLog(battleId, {
      attackerSide: oppSide,
      attackerName: state.sides[oppSide].name,
      skillIcon: '⏭️',
      skillName: 'Turno pulado',
      damage: 0,
      turnSkipped: true,
      turnNumber: state.turnNumber,
    });
  } else {
    const botLog = executeBotTurn(battleId, oppSide);
    if (botLog) pushLog(battleId, botLog);
  }

  if (state.sides[mySide].hp <= 0) {
    setOutcome(battleId, oppSide);
    return { outcome: 'lost' };
  }

  // ── 3. Troca pra jogador ──
  switchTurn(battleId);

  // ── 4. Status no jogador (no início do turno DELE) ──
  const myStatus = runTurnStartHooks(state.sides[mySide]);
  for (const ev of myStatus.logs) {
    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: state.sides[mySide].name,
      skillIcon: STATUS_EFFECTS[ev.statusId]?.icon || '⚡',
      skillName: 'Status',
      damage: ev.hpDelta < 0 ? -ev.hpDelta : 0,
      isStatusTick: true,
      statusId: ev.statusId,
      statusMessage: ev.message,
      turnNumber: state.turnNumber,
    });
  }
  if (myStatus.died || state.sides[mySide].hp <= 0) {
    setOutcome(battleId, oppSide);
    return { outcome: 'lost' };
  }

  // ── 5. Se status pulou turno do jogador, bot age de novo ──
  if (myStatus.skipTurn) {
    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: state.sides[mySide].name,
      skillIcon: '⏭️',
      skillName: 'Turno pulado',
      damage: 0,
      turnSkipped: true,
      turnNumber: state.turnNumber,
    });
    switchTurn(battleId);
    return resolveBotTurnAndReturnToPlayer(battleId, mySide, oppSide);
  }

  return { outcome: 'continue' };
}

function executeBotTurn(battleId, botSide) {
  const state = getBattleState(battleId);
  if (!state) return null;
  const bot = state.sides[botSide];
  const targetSide = oppositeSide(botSide);
  const target = state.sides[targetSide];

  // Personalidade: derivada do elemento, ou já pré-definida em createBattle
  const personality = bot.personality || getBossPersonality(bot.element);

  // Histórico do JOGADOR (oponente), para a IA reagir a padrões dele
  const playerHistory = getMoveHistory(battleId, targetSide);

  // Bot tem poção?
  const usablePotion = (bot.consumables || []).find(c => c.quantity > 0 && c.effect);
  const hasPotion = !!usablePotion;

  // Decide a ação
  const decision = chooseBossAction(bot, target, personality, {
    hasPotion,
    potionCdRemaining: bot.potionCdRemaining || 0,
    playerElo: target.elo || 500,
    moveHistory: playerHistory,
  });

  // ─── EXECUÇÃO DA AÇÃO ───

  // Caso 1: poção
  if (decision.action === 'potion' && usablePotion) {
    const result = applyConsumable(battleId, botSide, usablePotion.inventoryId);
    bot.potionCdRemaining = 2; // 2 turnos de cooldown antes da próxima poção
    pushMove(battleId, botSide, { action: 'potion', turn: state.turnNumber });
    return {
      attackerSide: botSide,
      attackerName: bot.name,
      skillIcon: '🧪',
      skillName: `Usou ${result.itemName || 'poção'}`,
      damage: 0,
      consumable: true,
      consumableEffect: result.message,
      hpHealed: result.hpHealed || 0,
      chiRestored: result.chiRestored || 0,
      buffApplied: result.buffApplied,
      turnNumber: state.turnNumber,
    };
  }

  // Caso 2: defender
  if (decision.action === 'defend') {
    setDefending(battleId, botSide, true);
    pushMove(battleId, botSide, { action: 'defend', turn: state.turnNumber });
    return {
      attackerSide: botSide,
      attackerName: bot.name,
      skillIcon: '🛡️',
      skillName: 'Defender',
      damage: 0,
      chiCost: 0,
      defending: true,
      turnNumber: state.turnNumber,
    };
  }

  // Caso 3: skill — fallback robusto se o id retornado não estiver disponível
  let skill = SKILLS[decision.skillId];
  if (!skill || (bot.cooldowns[skill.id] || 0) > 0 || bot.chi < (skill.chiCost || 0)) {
    skill = SKILLS.ataque_basico;
  }

  const dmgInfo = calculateDamageDetailed(skill, bot, target, bot.buffs);
  const damage = dmgInfo.damage;

  consumeChi(battleId, botSide, skill.chiCost || 0);
  if (damage > 0) applyDamage(battleId, targetSide, damage);

  const cdTurns = calculateCooldownTurns(skill, { level: bot.level, talentTree: bot.talentTree });
  if (cdTurns > 0) setSkillCooldown(battleId, botSide, skill.id, cdTurns);

  pushMove(battleId, botSide, { action: 'skill', skillId: skill.id, turn: state.turnNumber });

  return {
    attackerSide: botSide,
    attackerName: bot.name,
    skillIcon: skill.icon,
    skillName: skill.name,
    damage,
    chiCost: skill.chiCost || 0,
    isCrit: dmgInfo.isCrit,
    isDodge: dmgInfo.isDodge,
    elementalMult: dmgInfo.elementalMult,
    turnNumber: state.turnNumber,
  };
}

export default router;
