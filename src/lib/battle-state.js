// backend/src/lib/battle-state.js
// Estado in-memory de batalhas com suporte a:
//   - Skills equipadas (loadout)
//   - Consumíveis equipados (com quantity)
//   - Buffs temporários (de poções)
//   - Bônus de clã

import { tickStatusDuration, serializeStatusEffects, clearStatusEffects } from './status-effects.js';

const battleStates = new Map();
const userToBattle = new Map();

const BATTLE_TIMEOUT_MS = 30 * 60 * 1000;

export function createBattle(battleId, sideA, sideB, { isPvP = false, isFriendly = false } = {}) {
  const existing = battleStates.get(battleId);
  if (existing) return existing;

  const state = {
    battleId,
    isPvP,
    isFriendly,
    turn: 'A',
    turnNumber: 1,
    sides: {
      A: normalizeSide(sideA),
      B: normalizeSide(sideB),
    },
    startedAt: Date.now(),
  };

  battleStates.set(battleId, state);
  if (sideA.userId) userToBattle.set(sideA.userId, battleId);
  if (sideB.userId) userToBattle.set(sideB.userId, battleId);
  return state;
}

function normalizeSide(s) {
  return {
    userId: s.userId || null,
    characterId: s.characterId || null,
    name: s.name,
    element: s.element,
    elo: s.elo || 500,
    level: s.level || 1,
    attack: s.attack || 25,
    defense: s.defense || 20,
    equipBonus: s.equipBonus || { attack: 0, defense: 0, chi: 0, hp: 0 },
    clanBuff: s.clanBuff || { attack: 0, defense: 0, chi: 0, hp: 0 },
    hp: s.hp ?? s.maxHp ?? 100,
    maxHp: s.maxHp ?? 100,
    chi: s.chi ?? s.maxChi ?? 50,
    maxChi: s.maxChi ?? 50,
    cooldowns: {},
    // Skills disponíveis (equipadas + ataque básico)
    equippedSkillIds: Array.isArray(s.equippedSkillIds) ? s.equippedSkillIds : [],
    // Níveis das skills do lado (para a IA do bot levelar suas skills)
    skillLevels: s.skillLevels || {},
    // Talent tree (afeta crit chance e cooldown)
    talentTree: s.talentTree || { corpo: 0, espirito: 0, combate: 0 },
    // Consumíveis equipados: [{ inventoryId, itemName, quantity, effect }]
    consumables: Array.isArray(s.consumables) ? s.consumables.map(c => ({ ...c })) : [],
    // Buffs ativos: [{ type, value, turnsRemaining, label }]
    buffs: [],
    statusEffects: [],
    moveHistory: [],
    defending: false,
    potionCdRemaining: 0,
    isBot: !!s.isBot,
  };
}

export function getBattleState(battleId) {
  return battleStates.get(battleId) || null;
}

export function getSideForUser(battleId, userId) {
  const state = battleStates.get(battleId);
  if (!state) return null;
  if (state.sides.A.userId === userId) return 'A';
  if (state.sides.B.userId === userId) return 'B';
  return null;
}

export function oppositeSide(side) {
  return side === 'A' ? 'B' : 'A';
}

export function isSideTurn(battleId, side) {
  const state = battleStates.get(battleId);
  if (!state) return false;
  return state.turn === side;
}

export function setSkillCooldown(battleId, side, skillId, turns) {
  const state = battleStates.get(battleId);
  if (!state) return;
  state.sides[side].cooldowns[skillId] = turns;
}

export function isSkillOnCooldown(battleId, side, skillId) {
  const state = battleStates.get(battleId);
  if (!state) return false;
  return (state.sides[side].cooldowns[skillId] || 0) > 0;
}

export function applyDamage(battleId, side, damage) {
  const state = battleStates.get(battleId);
  if (!state) return 0;
  state.sides[side].hp = Math.max(0, state.sides[side].hp - damage);
  return state.sides[side].hp;
}

export function consumeChi(battleId, side, amount) {
  const state = battleStates.get(battleId);
  if (!state) return;
  state.sides[side].chi = Math.max(0, state.sides[side].chi - amount);
}

export function applyConsumable(battleId, side, consumableInventoryId) {
  const state = battleStates.get(battleId);
  if (!state) return { applied: false, message: 'Batalha inválida' };

  const sideState = state.sides[side];
  const idx = sideState.consumables.findIndex(c => c.inventoryId === consumableInventoryId);
  if (idx === -1) return { applied: false, message: 'Consumível não equipado' };

  const cons = sideState.consumables[idx];
  if (cons.quantity <= 0) return { applied: false, message: 'Sem unidades restantes' };

  const effect = cons.effect;
  if (!effect) return { applied: false, message: 'Item sem efeito' };

  let result = { applied: true, hpHealed: 0, chiRestored: 0, buffApplied: null };

  switch (effect.type) {
    case 'heal': {
      const healed = Math.min(effect.value, sideState.maxHp - sideState.hp);
      sideState.hp += healed;
      result.hpHealed = healed;
      result.message = `Curou ${healed} HP`;
      break;
    }
    case 'restore_chi': {
      const restored = Math.min(effect.value, sideState.maxChi - sideState.chi);
      sideState.chi += restored;
      result.chiRestored = restored;
      result.message = `Restaurou ${restored} Chi`;
      break;
    }
    case 'heal_and_chi': {
      const healed = Math.min(effect.hp, sideState.maxHp - sideState.hp);
      const restored = Math.min(effect.chi, sideState.maxChi - sideState.chi);
      sideState.hp += healed;
      sideState.chi += restored;
      result.hpHealed = healed;
      result.chiRestored = restored;
      result.message = `Curou ${healed} HP e ${restored} Chi`;
      break;
    }
    case 'buff_attack': {
      sideState.buffs.push({
        type: 'attack',
        value: effect.value,
        turnsRemaining: effect.duration,
        label: `+${effect.value} Atk`,
      });
      result.buffApplied = `+${effect.value} Atk por ${effect.duration} turnos`;
      result.message = result.buffApplied;
      break;
    }
    case 'buff_defense': {
      sideState.buffs.push({
        type: 'defense',
        value: effect.value,
        turnsRemaining: effect.duration,
        label: `+${effect.value} Def`,
      });
      result.buffApplied = `+${effect.value} Def por ${effect.duration} turnos`;
      result.message = result.buffApplied;
      break;
    }
    case 'cleanse': {
      const removed = clearStatusEffects(sideState);
      result.statusCleared = removed.length;
      if (removed.length === 0) {
        result.message = `Sem status para curar`;
      } else {
        const labels = removed.map(r => r.label).join(', ');
        result.message = `Removeu: ${labels}`;
      }
      break;
    }
    case 'revive': {
      const pct = effect.percent || 100;
      const threshold = effect.threshold || 30;
      if ((sideState.hp / sideState.maxHp) > (threshold / 100)) {
        return { applied: false, message: `Use só com HP abaixo de ${threshold}%` };
      }
      const target = Math.floor((sideState.maxHp * pct) / 100);
      const healed = Math.max(0, target - sideState.hp);
      sideState.hp = target;
      result.hpHealed = healed;
      result.message = `🌟 Curou ${healed} HP (HP agora: ${target}/${sideState.maxHp})`;
      break;
    }
    case 'buff_evasion': {
      sideState.buffs.push({
        type: 'evasion',
        value: effect.value, // %
        turnsRemaining: effect.duration,
        label: `+${effect.value}% Esquiva`,
      });
      result.buffApplied = `+${effect.value}% Esquiva por ${effect.duration} turnos`;
      result.message = result.buffApplied;
      break;
    }
    case 'buff_crit': {
      sideState.buffs.push({
        type: 'crit',
        value: effect.value, // %
        turnsRemaining: effect.duration,
        label: `+${effect.value}% Crit`,
      });
      result.buffApplied = `+${effect.value}% Crit por ${effect.duration} turnos`;
      result.message = result.buffApplied;
      break;
    }
    case 'bomb': {
      const oppSideStr = side === 'A' ? 'B' : 'A';
      const opp = state.sides[oppSideStr];
      if (!opp) return { applied: false, message: 'Sem oponente válido' };
      const dmg = effect.value || 30;
      const dealt = Math.min(dmg, opp.hp);
      opp.hp -= dealt;
      result.oppDamage = dealt;
      result.message = `💣 Causou ${dealt} de dano direto`;
      break;
    }
    default:
      result.applied = false;
      result.message = 'Efeito não suportado';
      return result;
  }

  // Decrementa quantidade
  cons.quantity -= 1;
  if (cons.quantity <= 0) {
    sideState.consumables.splice(idx, 1);
  }

  result.itemName = cons.itemName;
  return result;
}

/**
 * Soma os bônus temporários de buffs ativos.
 * Retorna { attack, defense } adicional.
 */
export function getActiveBuffBonus(side) {
  const bonus = { attack: 0, defense: 0 };
  for (const b of (side.buffs || [])) {
    if (b.type === 'attack') bonus.attack += b.value;
    if (b.type === 'defense') bonus.defense += b.value;
  }
  return bonus;
}

export function switchTurn(battleId) {
  const state = battleStates.get(battleId);
  if (!state) return null;

  // Decrementa cooldowns + buffs + status effects do lado que ACABOU de jogar
  tickCooldowns(state.sides[state.turn]);
  tickBuffs(state.sides[state.turn]);
  tickStatusDuration(state.sides[state.turn]);
  // Decrementa cooldown de poção do bot
  if (state.sides[state.turn].potionCdRemaining > 0) {
    state.sides[state.turn].potionCdRemaining -= 1;
  }

  // Escala com a duração da batalha (incentiva combos longos):
  //   turnos 1-4  → +3 chi
  //   turnos 5-9  → +5 chi
  //   turnos 10+  → +7 chi
  // Quem DEFENDEU no turno também ganha +5 chi extra (recompensa por ser cauteloso).
  const finishedSide = state.sides[state.turn];
  const turnNumber = state.turnNumber || 1;
  let regen = 3;
  if (turnNumber >= 10) regen = 7;
  else if (turnNumber >= 5) regen = 5;
  if (finishedSide.defending) regen += 5;
  // Aplica respeitando maxChi
  const before = finishedSide.chi;
  finishedSide.chi = Math.min(finishedSide.maxChi, finishedSide.chi + regen);
  finishedSide.lastChiRegen = finishedSide.chi - before; // pra o frontend mostrar feedback

  state.turn = state.turn === 'A' ? 'B' : 'A';
  state.turnNumber += 1;

  // Quando o turno volta para o lado que estava defendendo, a postura
  // termina (já absorveu o golpe). Se ele defender de novo, é uma escolha
  // ativa, então a flag será setada novamente em /defend.
  state.sides[state.turn].defending = false;

  return state;
}

export function setDefending(battleId, side, value = true) {
  const state = battleStates.get(battleId);
  if (!state) return;
  state.sides[side].defending = value;
}

export function pushMove(battleId, side, move) {
  const state = battleStates.get(battleId);
  if (!state) return;
  const history = state.sides[side].moveHistory || [];
  history.push(move);
  if (history.length > 6) history.shift();
  state.sides[side].moveHistory = history;
}

export function getMoveHistory(battleId, side) {
  const state = battleStates.get(battleId);
  if (!state) return [];
  return state.sides[side].moveHistory || [];
}

function tickCooldowns(side) {
  const next = {};
  for (const [skillId, turns] of Object.entries(side.cooldowns)) {
    const newTurns = turns - 1;
    if (newTurns > 0) next[skillId] = newTurns;
  }
  side.cooldowns = next;
}

function tickBuffs(side) {
  side.buffs = (side.buffs || [])
    .map(b => ({ ...b, turnsRemaining: b.turnsRemaining - 1 }))
    .filter(b => b.turnsRemaining > 0);
}

export function endBattleState(battleId) {
  const state = battleStates.get(battleId);
  if (!state) return;
  if (state.sides.A.userId) userToBattle.delete(state.sides.A.userId);
  if (state.sides.B.userId) userToBattle.delete(state.sides.B.userId);
  state.finishedAt = Date.now();
  // GC tardio: dá 60s p/ o lado perdedor ler o outcome.
  // Já houver um timer agendado, ignora (idempotente).
  if (!state._gcScheduled) {
    state._gcScheduled = true;
    setTimeout(() => {
      battleStates.delete(battleId);
    }, 60000);
  }
}

export function getActiveBattleForUser(userId) {
  const battleId = userToBattle.get(userId);
  if (!battleId) return null;
  return battleStates.get(battleId) || null;
}

export function serializeStateForSide(battleId, mySide) {
  const state = battleStates.get(battleId);
  if (!state) return null;
  const oppSide = oppositeSide(mySide);
  const me = state.sides[mySide];
  const opp = state.sides[oppSide];

  return {
    battleId,
    turnNumber: state.turnNumber,
    isPvP: state.isPvP,
    isFriendly: state.isFriendly || false,
    isMyTurn: state.turn === mySide,
    currentTurn: state.turn === mySide ? 'me' : 'opponent',
    me: {
      hp: me.hp, maxHp: me.maxHp,
      chi: me.chi, maxChi: me.maxChi,
      lastChiRegen: me.lastChiRegen || 0,
      cooldowns: me.cooldowns,
      name: me.name,
      buffs: me.buffs,
      statusEffects: serializeStatusEffects(me),
      consumables: me.consumables.map(c => ({
        inventoryId: c.inventoryId,
        itemName: c.itemName,
        quantity: c.quantity,
        effect: c.effect,
      })),
    },
    opponent: {
      hp: opp.hp, maxHp: opp.maxHp,
      name: opp.name,
      cooldowns: opp.cooldowns,
      buffs: opp.buffs,
      statusEffects: serializeStatusEffects(opp),
    },
  };
}

export function pushLog(battleId, entry) {
  const state = battleStates.get(battleId);
  if (!state) return;
  if (!state.logs) state.logs = [];
  // O cliente guarda o último id visto e ignora logs com id <= lastSeen.
  if (!state._logSeq) state._logSeq = 0;
  state._logSeq += 1;
  state.logs.push({ id: state._logSeq, ...entry, at: Date.now() });
  if (state.logs.length > 30) state.logs = state.logs.slice(-30);
}

export function getLogs(battleId) {
  const state = battleStates.get(battleId);
  return state?.logs || [];
}

export function setOutcome(battleId, winnerSide) {
  const state = battleStates.get(battleId);
  if (!state) return;
  state.outcome = winnerSide;
  state.endedAt = Date.now();
}

export function getOutcome(battleId) {
  const state = battleStates.get(battleId);
  return state?.outcome || null;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, state] of battleStates.entries()) {
    if (now - state.startedAt > BATTLE_TIMEOUT_MS) {
      endBattleState(id);
    }
  }
}, 5 * 60 * 1000);

export function getBattleStatesCount() {
  return battleStates.size;
}
