// backend/src/routes/training.js
// Training Grounds — Mini-game contra bosses
//   POST /api/training/start/:bossId    Inicia batalha contra boss
//   POST /api/training/use-skill        Usa skill (espelha /battle/use-skill)
//   POST /api/training/use-potion       Usa poção ilimitada (cooldown 2 turnos)
//   POST /api/training/defend           Defende
//   POST /api/training/end              Finaliza batalha (registra vitória/derrota)
//   GET  /api/training/state            Estado atual da batalha de treino

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  TRAINING_BOSSES, getBossById, getBossesByNation, getAllBosses,
  computeBossStats, computeRewards, isBossUnlocked,
} from '../lib/training-bosses.js';
import { chooseBossAction, POTION_COOLDOWN_TURNS } from '../lib/boss-ai.js';
import { SKILLS, calculateCooldownTurns, calculateDamage, calculateDamageDetailed, getEquippedSkillsForBattle, rollStatusApplication } from '../lib/skills.js';
import { applyExpGain } from '../lib/progression.js';
import { computeEquipBonus } from './inventory.js';
import { getEffectiveClanBuff } from './loadout.js';
import {
  createBattle as createBattleState,
  getBattleState, getSideForUser, oppositeSide,
  applyDamage, consumeChi, setSkillCooldown, isSkillOnCooldown,
  switchTurn, endBattleState, serializeStateForSide,
  pushLog, getLogs, setOutcome, getOutcome, getActiveBattleForUser,
} from '../lib/battle-state.js';
import { isInBattle, leaveBattle, createBotBattle, finishBattle } from '../lib/matchmaking.js';
import {
  applyStatusEffect, runTurnStartHooks, applySkillUseModifiers,
  STATUS_EFFECTS,
} from '../lib/status-effects.js';

const router = express.Router();

// ─── Estado de poção do training (em-memória, por battleId) ───
// {
//   [battleId]: {
//     player: { potionsLeft: 5, lastUsedTurn: null },
//     boss:   { potionsLeft: 5, lastUsedTurn: null },
//   }
// }
const potionState = new Map();

const POTIONS_PER_MATCH = 5;        // Total de poções por partida
const POTION_HEAL_PERCENT = 0.40;   // Restaura 40% do HP máximo
const POTION_CHI_PERCENT = 0.20;    // Restaura 20% do chi máximo

function initPotionState(battleId) {
  potionState.set(battleId, {
    player: { potionsLeft: POTIONS_PER_MATCH, lastUsedTurn: null },
    boss:   { potionsLeft: POTIONS_PER_MATCH, lastUsedTurn: null },
  });
}

function canUsePotion(battleId, side, currentTurn) {
  const ps = potionState.get(battleId);
  if (!ps) return { ok: false, reason: 'state-missing' };
  const data = ps[side];
  if (!data) return { ok: false, reason: 'side-missing' };
  if (data.potionsLeft <= 0) return { ok: false, reason: 'no-potions-left' };
  if (data.lastUsedTurn === currentTurn) return { ok: false, reason: 'already-used-this-turn' };
  return { ok: true };
}

function consumePotion(battleId, side, currentTurn) {
  const ps = potionState.get(battleId);
  if (!ps) return;
  const data = ps[side];
  if (!data) return;
  data.potionsLeft = Math.max(0, data.potionsLeft - 1);
  data.lastUsedTurn = currentTurn;
}

function getPotionsLeft(battleId, side) {
  const ps = potionState.get(battleId);
  return ps?.[side]?.potionsLeft ?? 0;
}

function applyPotionEffects(side) {
  const healHp = Math.round((side.maxHp || 100) * POTION_HEAL_PERCENT);
  const restoreChi = Math.round((side.maxChi || 50) * POTION_CHI_PERCENT);
  const oldHp = side.hp;
  const oldChi = side.chi;
  side.hp  = Math.min(side.maxHp,  side.hp + healHp);
  side.chi = Math.min(side.maxChi, side.chi + restoreChi);
  return {
    hpHealed: side.hp - oldHp,
    chiRestored: side.chi - oldChi,
  };
}

router.get('/progress', authMiddleware, async (req, res) => {
  try {
    // ─── 🛡️ Treino é exclusivo para membros de clã ───
    const member = await prisma.clanMember.findUnique({ where: { userId: req.userId } });
    if (!member) {
      return res.status(403).json({
        error: 'O Salão de Treino é exclusivo para membros de clãs.',
        requiresClan: true,
      });
    }

    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const defeats = await prisma.bossDefeat.findMany({
      where: { characterId: character.id },
    });
    const defeatedIds = new Set(defeats.map(d => d.bossId));
    const winsByBoss = Object.fromEntries(defeats.map(d => [d.bossId, d.totalWins]));

    const result = {};
    for (const nation of ['Ar', 'Água', 'Terra', 'Fogo']) {
      const bosses = getBossesByNation(nation);
      result[nation] = bosses.map(b => ({
        id: b.id,
        name: b.name,
        icon: b.icon,
        tier: b.tier,
        nation: b.nation,
        personality: b.personality,
        description: b.desc,
        defeated: defeatedIds.has(b.id),
        totalWins: winsByBoss[b.id] || 0,
        unlocked: isBossUnlocked(b, [...defeatedIds], character.level),
        // Stats que ele teria se enfrentado agora
        previewStats: computeBossStats(b, character.level),
      }));
    }

    // Progressão geral
    const totalBosses = getAllBosses().length;
    const totalDefeated = defeats.length;

    res.json({
      progress: result,
      stats: {
        totalBosses,
        totalDefeated,
        percent: totalBosses > 0 ? Math.round((totalDefeated / totalBosses) * 100) : 0,
        byNation: Object.fromEntries(
          Object.entries(result).map(([nation, list]) => [
            nation,
            { defeated: list.filter(b => b.defeated).length, total: list.length },
          ])
        ),
      },
      myCharacter: {
        level: character.level,
        element: character.element,
      },
    });
  } catch (error) {
    console.error('training/progress:', error);
    res.status(500).json({ error: 'Erro ao buscar progresso' });
  }
});

// INICIAR BATALHA
router.post('/start/:bossId', authMiddleware, async (req, res) => {
  try {
    // ─── 🛡️ Treino é exclusivo para membros de clã ───
    const member = await prisma.clanMember.findUnique({ where: { userId: req.userId } });
    if (!member) {
      return res.status(403).json({
        error: 'O Salão de Treino é exclusivo para membros de clãs. Entre em um clã primeiro.',
        requiresClan: true,
      });
    }

    const boss = getBossById(req.params.bossId);
    if (!boss) return res.status(404).json({ error: 'Boss não encontrado' });

    const character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { user: true },
    });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    if (!character.element || character.element === 'Nenhum') {
      return res.status(400).json({ error: 'Complete o Capítulo 1 antes de treinar' });
    }

    // Confere se boss está desbloqueado
    const defeats = await prisma.bossDefeat.findMany({ where: { characterId: character.id } });
    const defeatedIds = defeats.map(d => d.bossId);
    if (!isBossUnlocked(boss, defeatedIds, character.level)) {
      return res.status(403).json({ error: 'Boss bloqueado. Derrote o anterior primeiro.' });
    }

    // Não pode estar em batalha
    if (isInBattle(req.userId)) {
      const stale = getActiveBattleForUser(req.userId);
      if (!stale) leaveBattle(req.userId);
      else return res.status(400).json({ error: 'Você já está em uma batalha' });
    }

    // Carrega bônus do player
    const equipBonus = await computeEquipBonus(character.id);
    const clanBuff = await getEffectiveClanBuff(character.id, req.userId);
    const equippedSkillIds = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];

    const fullMaxHp = character.maxHp + (equipBonus.hp || 0) + (clanBuff.hp || 0);
    const fullMaxChi = character.maxChi + (equipBonus.chi || 0) + (clanBuff.chi || 0);

    // Stats do boss (escalados)
    const bossStats = computeBossStats(boss, character.level);

    // Cria battle state
    const battleId = `train-${Date.now()}-${req.userId}`;
    createBattleState(
      battleId,
      // Side A — player
      {
        userId: req.userId,
        characterId: character.id,
        name: character.name,
        element: character.element,
        level: character.level,
        elo: character.elo,
        attack: character.attack,
        defense: character.defense,
        maxHp: fullMaxHp, hp: fullMaxHp,
        maxChi: fullMaxChi, chi: fullMaxChi,
        equipBonus,
        clanBuff,
        equippedSkillIds,
        consumables: [], // training não usa consumíveis do inventário
        isBot: false,
      },
      // Side B — boss
      {
        userId: null,
        name: boss.name,
        element: boss.nation,
        level: bossStats.level,
        elo: bossStats.elo,
        attack: bossStats.attack,
        defense: bossStats.defense,
        maxHp: bossStats.maxHp, hp: bossStats.maxHp,
        maxChi: bossStats.maxChi, chi: bossStats.maxChi,
        equippedSkillIds: boss.skillIds,
        consumables: [],
        isBot: true,
        // Metadados específicos de training
        bossId: boss.id,
        bossPersonality: boss.personality,
        bossIcon: boss.icon,
      },
      { isPvP: false, isFriendly: false }
    );

    // Marca batalha de treino (flag custom no state)
    const state = getBattleState(battleId);
    state.isTraining = true;
    state.bossId = boss.id;

    createBotBattle(req.userId, battleId);
    initPotionState(battleId);

    return res.json({
      success: true,
      battleId,
      mySide: 'A',
      isTraining: true,
      boss: {
        id: boss.id,
        name: boss.name,
        icon: boss.icon,
        nation: boss.nation,
        tier: boss.tier,
        personality: boss.personality,
        description: boss.desc,
      },
      player: {
        name: character.name,
        element: character.element,
        level: character.level,
        attack: character.attack,
        defense: character.defense,
        hp: fullMaxHp, maxHp: fullMaxHp,
        chi: fullMaxChi, maxChi: fullMaxChi,
        equipBonus, clanBuff,
      },
      opponent: {
        name: boss.name,
        icon: boss.icon,
        element: boss.nation,
        level: bossStats.level,
        elo: bossStats.elo,
        attack: bossStats.attack,
        defense: bossStats.defense,
        hp: bossStats.maxHp, maxHp: bossStats.maxHp,
        chi: bossStats.maxChi, maxChi: bossStats.maxChi,
        isBot: true,
        personality: boss.personality,
      },
    });
  } catch (error) {
    console.error('training/start:', error);
    res.status(500).json({ error: 'Erro ao iniciar treino' });
  }
});

// USAR SKILL
router.post('/use-skill', authMiddleware, async (req, res) => {
  const { battleId, skillId } = req.body;
  if (!battleId || !skillId) return res.status(400).json({ error: 'Dados faltando' });

  try {
    const mySide = getSideForUser(battleId, req.userId);
    if (!mySide) return res.status(403).json({ error: 'Você não está nesta batalha' });

    const state = getBattleState(battleId);
    if (!state) return res.status(404).json({ error: 'Batalha não encontrada' });
    if (!state.isTraining) return res.status(400).json({ error: 'Não é uma batalha de treino' });

    if (getOutcome(battleId)) {
      return res.json({ outcome: getOutcome(battleId) === mySide ? 'won' : 'lost' });
    }

    if (state.turn !== mySide) return res.status(400).json({ error: 'Não é seu turno' });

    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    const skill = SKILLS[skillId];
    if (!skill) return res.status(400).json({ error: 'Skill inválida' });
    if (character.level < skill.minLevel) return res.status(400).json({ error: `Requer nível ${skill.minLevel}` });

    if (skill.tier !== 0) {
      const equipped = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];
      if (!equipped.includes(skill.id)) {
        return res.status(400).json({ error: 'Skill não equipada — equipe em Loadout' });
      }
    }

    if (isSkillOnCooldown(battleId, mySide, skill.id)) {
      const turns = state.sides[mySide].cooldowns[skill.id];
      return res.status(400).json({ error: `Em cooldown (${turns} turno${turns > 1 ? 's' : ''})` });
    }

    const me = state.sides[mySide];
    const oppSide = oppositeSide(mySide);
    const opp = state.sides[oppSide];

    if (me.chi < skill.chiCost) return res.status(400).json({ error: 'Chi insuficiente' });

    // O calculateDamageDetailed já considera defender.defending para reduzir
    // 50%, então a duplicação anterior aqui é removida.
    const dmgInfo = calculateDamageDetailed(skill, me, opp, me.buffs);
    const finalDamage = dmgInfo.damage;
    if (opp.defending) opp.defending = false; // postura consumida ao receber o golpe

    consumeChi(battleId, mySide, skill.chiCost);
    if (finalDamage > 0) applyDamage(battleId, oppSide, finalDamage);

    let cdTurns = calculateCooldownTurns(skill, character);
    cdTurns = applySkillUseModifiers(me, skill, cdTurns);
    if (cdTurns > 0) setSkillCooldown(battleId, mySide, skill.id, cdTurns);

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

    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: me.name,
      skillIcon: skill.icon,
      skillName: skill.name,
      damage: finalDamage,
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
        potionInfo: getPotionInfo(battleId, mySide, state),
      });
    }

    switchTurn(battleId);

    const bossStatus = runTurnStartHooks(state.sides[oppSide]);
    for (const ev of bossStatus.logs) {
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
    if (bossStatus.died || state.sides[oppSide].hp <= 0) {
      setOutcome(battleId, mySide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome: 'won',
        potionInfo: getPotionInfo(battleId, mySide, state),
      });
    }

    // Boss joga (a menos que esteja atordoado/congelado)
    if (bossStatus.skipTurn) {
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
      const botResult = executeBossTurn(battleId, oppSide);
      if (botResult.log) pushLog(battleId, botResult.log);
    }

    if (state.sides[mySide].hp <= 0) {
      setOutcome(battleId, oppSide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome: 'lost',
        potionInfo: getPotionInfo(battleId, mySide, state),
      });
    }

    switchTurn(battleId);

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
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome: 'lost',
        potionInfo: getPotionInfo(battleId, mySide, state),
      });
    }

    res.json({
      success: true,
      state: serializeStateForSide(battleId, mySide),
      logs: getLogs(battleId).slice(-10),
      outcome: 'continue',
      potionInfo: getPotionInfo(battleId, mySide, state),
    });
  } catch (error) {
    console.error('training/use-skill:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

// USAR POÇÃO (ilimitada, mas com cooldown)
router.post('/use-potion', authMiddleware, async (req, res) => {
  const { battleId } = req.body;
  if (!battleId) return res.status(400).json({ error: 'battleId obrigatório' });

  try {
    const mySide = getSideForUser(battleId, req.userId);
    if (!mySide) return res.status(403).json({ error: 'Você não está nesta batalha' });
    const state = getBattleState(battleId);
    if (!state || !state.isTraining) return res.status(400).json({ error: 'Não é treino' });

    if (getOutcome(battleId)) return res.json({ outcome: 'ended' });
    if (state.turn !== mySide) return res.status(400).json({ error: 'Não é seu turno' });

    // ─── Validação: 5 por partida + 1 por turno ───
    const check = canUsePotion(battleId, 'player', state.turnNumber);
    if (!check.ok) {
      const msg = check.reason === 'no-potions-left'
        ? 'Suas poções acabaram (5 por partida)'
        : check.reason === 'already-used-this-turn'
        ? 'Você já usou poção neste turno'
        : 'Não pode usar poção agora';
      return res.status(400).json({ error: msg });
    }

    const me = state.sides[mySide];
    const effects = applyPotionEffects(me);
    consumePotion(battleId, 'player', state.turnNumber);

    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: me.name,
      skillIcon: '🧪',
      skillName: 'Poção de Cura',
      damage: 0,
      consumable: true,
      consumableEffect: `Curou ${effects.hpHealed} HP, +${effects.chiRestored} chi`,
      hpHealed: effects.hpHealed,
      chiRestored: effects.chiRestored,
      turnNumber: state.turnNumber,
    });

    switchTurn(battleId);

    // Boss joga
    const oppSide = oppositeSide(mySide);
    const botResult = executeBossTurn(battleId, oppSide);
    if (botResult.log) pushLog(battleId, botResult.log);

    if (state.sides[mySide].hp <= 0) {
      setOutcome(battleId, oppSide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome: 'lost',
        potionInfo: getPotionInfo(battleId, mySide, state),
      });
    }

    switchTurn(battleId);

    res.json({
      success: true,
      state: serializeStateForSide(battleId, mySide),
      logs: getLogs(battleId).slice(-10),
      outcome: 'continue',
      potionInfo: getPotionInfo(battleId, mySide, state),
    });
  } catch (error) {
    console.error('training/use-potion:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

// DEFENDER
router.post('/defend', authMiddleware, async (req, res) => {
  const { battleId } = req.body;
  if (!battleId) return res.status(400).json({ error: 'battleId obrigatório' });

  try {
    const mySide = getSideForUser(battleId, req.userId);
    if (!mySide) return res.status(403).json({ error: 'Você não está nesta batalha' });
    const state = getBattleState(battleId);
    if (!state || !state.isTraining) return res.status(400).json({ error: 'Não é treino' });

    if (getOutcome(battleId)) return res.json({ outcome: 'ended' });
    if (state.turn !== mySide) return res.status(400).json({ error: 'Não é seu turno' });

    const me = state.sides[mySide];
    const maxChi = me.maxChi || 50;
    const defense = (me.defense || 0) + (me.equipBonus?.defense || 0) + (me.clanBuff?.defense || 0);
    const baseRegen = Math.floor(maxChi * 0.25);
    const defenseBonus = Math.floor(defense * 0.3);
    const chiRegen = Math.max(15, Math.min(maxChi, baseRegen + defenseBonus));
    me.chi = Math.min(maxChi, me.chi + chiRegen);
    me.defending = true;

    pushLog(battleId, {
      attackerSide: mySide,
      attackerName: me.name,
      skillIcon: '🛡️',
      skillName: 'Defender',
      damage: 0,
      defending: true,
      chiRestored: chiRegen,
      turnNumber: state.turnNumber,
    });

    switchTurn(battleId);

    const oppSide = oppositeSide(mySide);
    const botResult = executeBossTurn(battleId, oppSide);
    if (botResult.log) pushLog(battleId, botResult.log);

    if (state.sides[mySide].hp <= 0) {
      setOutcome(battleId, oppSide);
      return res.json({
        success: true,
        state: serializeStateForSide(battleId, mySide),
        logs: getLogs(battleId).slice(-10),
        outcome: 'lost',
        potionInfo: getPotionInfo(battleId, mySide, state),
      });
    }

    switchTurn(battleId);

    res.json({
      success: true,
      state: serializeStateForSide(battleId, mySide),
      logs: getLogs(battleId).slice(-10),
      outcome: 'continue',
      potionInfo: getPotionInfo(battleId, mySide, state),
    });
  } catch (error) {
    console.error('training/defend:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

// FINALIZAR BATALHA
router.post('/end', authMiddleware, async (req, res) => {
  const { battleId, result } = req.body;
  if (!battleId || !result) return res.status(400).json({ error: 'Dados faltando' });

  try {
    const state = getBattleState(battleId);
    if (!state || !state.isTraining) return res.status(400).json({ error: 'Não é treino' });

    // Idempotência: a state vive 60s após o fim — não premia 2x.
    if (state._endSettled) return res.status(409).json({ error: 'Treino já finalizado.' });
    state._endSettled = true;

    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const bossId = state.bossId;
    const boss = getBossById(bossId);
    if (!boss) return res.status(400).json({ error: 'Boss inválido' });

    // Anti-cheat: deriva o resultado do estado do servidor, não do cliente.
    const mySide = getSideForUser(battleId, req.userId);
    const outcome = getOutcome(battleId);
    const won = outcome ? outcome === mySide : result === 'win';
    let rewards = { exp: 0, yuan: 0, decayFactor: 0, isFirstWin: false, isMilestone: false };
    let progression = null;

    if (won) {
      // Pega/cria o registro de derrota
      const existing = await prisma.bossDefeat.findUnique({
        where: { characterId_bossId: { characterId: character.id, bossId } },
      });
      const totalWinsBefore = existing?.totalWins || 0;
      rewards = computeRewards(boss, totalWinsBefore);

      progression = applyExpGain(character, rewards.exp);

      await prisma.$transaction([
        existing
          ? prisma.bossDefeat.update({
              where: { id: existing.id },
              data: { totalWins: { increment: 1 }, lastWinAt: new Date() },
            })
          : prisma.bossDefeat.create({
              data: {
                characterId: character.id,
                bossId,
                nation: boss.nation,
                tier: boss.tier,
              },
            }),
        prisma.character.update({
          where: { id: character.id },
          data: {
            exp: progression.newExp,
            level: progression.newLevel,
            attributePoints: progression.newAttributePoints,
            money: { increment: rewards.yuan },
          },
        }),
      ]);
    } else {
      // Derrota: pequena consolação de EXP
      progression = applyExpGain(character, 5);
      await prisma.character.update({
        where: { id: character.id },
        data: { exp: progression.newExp, level: progression.newLevel, attributePoints: progression.newAttributePoints },
      });
      rewards = { exp: 5, yuan: 0, decayFactor: 0, isFirstWin: false, isMilestone: false };
    }

    finishBattle(battleId);
    endBattleState(battleId);
    potionState.delete(battleId);

    res.json({
      success: true,
      won,
      rewards,
      progression: {
        leveled: progression.leveled,
        levelsGained: progression.levelsGained,
        newLevel: progression.newLevel,
        newExp: progression.newExp,
        expRequired: progression.expRequired,
      },
    });
  } catch (error) {
    console.error('training/end:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

// HELPERS
function getPotionInfo(battleId, mySide, state) {
  const check = canUsePotion(battleId, 'player', state.turnNumber);
  return {
    canUse: check.ok,
    potionsLeft: getPotionsLeft(battleId, 'player'),
    bossPotionsLeft: getPotionsLeft(battleId, 'boss'),
    reason: check.ok ? null : check.reason,
  };
}

/**
 * Executa um turno do boss usando boss-ai.js.
 * Retorna { log, killed: bool }
 */
function executeBossTurn(battleId, bossSide) {
  const state = getBattleState(battleId);
  if (!state) return { log: null };

  const boss = state.sides[bossSide];
  const playerSide = oppositeSide(bossSide);
  const player = state.sides[playerSide];

  // Boss só pode usar poção se ainda tem (5 por partida) e não usou neste turno
  const bossPotionCheck = canUsePotion(battleId, 'boss', state.turnNumber);

  // IA decide
  const action = chooseBossAction(boss, player, boss.bossPersonality || 'wise', {
    hasPotion: bossPotionCheck.ok,   // só "tem poção" se realmente puder usar
    potionCdRemaining: bossPotionCheck.ok ? 0 : 1,
    turnNumber: state.turnNumber,
  });

  // Executa ação escolhida
  if (action.action === 'potion') {
    const effects = applyPotionEffects(boss);
    consumePotion(battleId, 'boss', state.turnNumber);
    return {
      log: {
        attackerSide: bossSide,
        attackerName: boss.name,
        skillIcon: '🧪',
        skillName: 'Poção',
        damage: 0,
        consumable: true,
        consumableEffect: `${boss.name} bebeu uma poção (+${effects.hpHealed} HP) — restam ${getPotionsLeft(battleId, 'boss')}`,
        hpHealed: effects.hpHealed,
        chiRestored: effects.chiRestored,
        turnNumber: state.turnNumber,
      },
    };
  }

  if (action.action === 'defend') {
    const maxChi = boss.maxChi || 50;
    const defense = (boss.defense || 0);
    const baseRegen = Math.floor(maxChi * 0.25);
    const defenseBonus = Math.floor(defense * 0.3);
    const chiRegen = Math.max(15, Math.min(maxChi, baseRegen + defenseBonus));
    boss.chi = Math.min(maxChi, boss.chi + chiRegen);
    boss.defending = true;
    return {
      log: {
        attackerSide: bossSide,
        attackerName: boss.name,
        skillIcon: '🛡️',
        skillName: 'Defender',
        damage: 0,
        defending: true,
        chiRestored: chiRegen,
        turnNumber: state.turnNumber,
      },
    };
  }

  // action === 'skill'
  const skill = SKILLS[action.skillId];
  if (!skill) return { log: null };

  // O calculateDamageDetailed já considera defender.defending, então a
  // duplicação manual que existia aqui não é mais necessária.
  const dmgInfo = calculateDamageDetailed(skill, boss, player, boss.buffs);
  const damage = dmgInfo.damage;
  if (player.defending) player.defending = false; // postura consumida

  consumeChi(battleId, bossSide, skill.chiCost);
  if (damage > 0) applyDamage(battleId, playerSide, damage);

  const cdTurns = calculateCooldownTurns(skill, { level: boss.level, talentTree: boss.talentTree });
  if (cdTurns > 0) setSkillCooldown(battleId, bossSide, skill.id, cdTurns);

  return {
    log: {
      attackerSide: bossSide,
      attackerName: boss.name,
      skillIcon: skill.icon,
      skillName: skill.name,
      damage,
      chiCost: skill.chiCost,
      isCrit: dmgInfo.isCrit,
      isDodge: dmgInfo.isDodge,
      elementalMult: dmgInfo.elementalMult,
      turnNumber: state.turnNumber,
    },
  };
}

export default router;
