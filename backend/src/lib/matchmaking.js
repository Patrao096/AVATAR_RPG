// backend/src/lib/matchmaking.js
// Fila de matchmaking com resolução atômica de matches.
//
// Quando dois jogadores matcheiam, o callback `onMatch(playerA, playerB, battleId)`
// é executado UMA VEZ ANTES de notificar ambos via `resolve`. Isso garante que
// o estado de batalha seja criado exatamente uma vez (não há race condition com
// cada jogador tentando criar seu próprio state).

import { canMatch, calculatePowerScore } from './ranks.js';

const queue = new Map();
const activeMatches = new Map();      // battleId -> { player1Id, player2Id, startedAt }
const playersInBattle = new Map();    // userId -> battleId

const MAX_WAIT_MS = 15000;
const POLL_INTERVAL = 1000;

// Callback chamado quando dois jogadores matcheiam. Registrado pelo routes/battle.js.
// Assinatura: onMatch(playerA, playerB) -> battleId
let matchCreator = null;

export function registerMatchCreator(fn) {
  matchCreator = fn;
}

/**
 * Adiciona à fila.
 */
export function enqueue(player) {
  return new Promise((resolve) => {
    if (playersInBattle.has(player.userId)) {
      return resolve({ type: 'error', error: 'Você já está em uma batalha.' });
    }
    if (queue.has(player.userId)) {
      clearTimeout(queue.get(player.userId).timeoutId);
      queue.delete(player.userId);
    }

    const entry = {
      ...player,
      enteredAt: Date.now(),
      power: calculatePowerScore(player),
      resolve,
    };

    // Match imediato?
    const opponent = findOpponent(entry);
    if (opponent) {
      resolveMatch(entry, opponent);
      return;
    }

    // Senão, coloca na fila
    entry.timeoutId = setTimeout(() => {
      queue.delete(entry.userId);
      entry.resolve({ type: 'timeout' });
    }, MAX_WAIT_MS);

    queue.set(entry.userId, entry);

    const retryLoop = setInterval(() => {
      const current = queue.get(entry.userId);
      if (!current) { clearInterval(retryLoop); return; }
      const opp = findOpponent(current);
      if (opp) {
        clearInterval(retryLoop);
        resolveMatch(current, opp);
      }
    }, POLL_INTERVAL);
  });
}

/**
 * Resolve match: cria batalha e resolve AMBOS resolvers.
 * IMPORTANTE: chama matchCreator (registrado pelo battle.js) ANTES de resolver,
 * para que o state de batalha exista quando os clientes receberem a resposta.
 */
function resolveMatch(entryA, entryB) {
  // Remove ambos da fila
  clearTimeout(entryA.timeoutId);
  clearTimeout(entryB.timeoutId);
  queue.delete(entryA.userId);
  queue.delete(entryB.userId);

  // Cria a batalha (state) UMA VEZ via callback
  let battleId;
  if (matchCreator) {
    battleId = matchCreator(entryA, entryB);
  } else {
    battleId = `${Date.now()}-${entryA.userId}-${entryB.userId}`;
  }

  activeMatches.set(battleId, {
    battleId,
    player1Id: entryA.userId,
    player2Id: entryB.userId,
    startedAt: Date.now(),
  });
  playersInBattle.set(entryA.userId, battleId);
  playersInBattle.set(entryB.userId, battleId);

  // Notifica ambos lados
  const payloadFor = (me, them) => ({
    type: 'match',
    battleId,
    mySide: me.userId === entryA.userId ? 'A' : 'B',
    opponent: {
      userId: them.userId,
      characterId: them.characterId,
      name: them.name,
      element: them.element,
      level: them.level,
      elo: them.elo,
      attack: them.attack,
      defense: them.defense,
      maxHp: them.maxHp,
      avatar: them.avatar,
    },
  });

  entryA.resolve(payloadFor(entryA, entryB));
  entryB.resolve(payloadFor(entryB, entryA));
}

export function dequeue(userId) {
  const entry = queue.get(userId);
  if (!entry) return false;
  clearTimeout(entry.timeoutId);
  queue.delete(userId);
  entry.resolve({ type: 'cancelled' });
  return true;
}

function findOpponent(player) {
  const waitSeconds = Math.floor((Date.now() - player.enteredAt) / 1000);
  for (const entry of queue.values()) {
    if (entry.userId === player.userId) continue;
    if (canMatch(player.elo, entry.elo, waitSeconds)) {
      return entry;
    }
  }
  return null;
}

/**
 * Cria batalha sem passar pela fila (usada pelo modo bot/fallback).
 */
export function createBotBattle(userId, battleId) {
  activeMatches.set(battleId, {
    battleId,
    player1Id: userId,
    player2Id: null,
    startedAt: Date.now(),
  });
  playersInBattle.set(userId, battleId);
}

export function finishBattle(battleId) {
  const battle = activeMatches.get(battleId);
  if (!battle) return;
  if (battle.player1Id) playersInBattle.delete(battle.player1Id);
  if (battle.player2Id) playersInBattle.delete(battle.player2Id);
  activeMatches.delete(battleId);
}

export function leaveBattle(userId) {
  const battleId = playersInBattle.get(userId);
  if (!battleId) return;
  finishBattle(battleId);
}

export function getQueueStats() {
  return {
    queueSize: queue.size,
    activeBattles: activeMatches.size,
    onlineInSystem: queue.size + playersInBattle.size,
  };
}

export function isInBattle(userId) {
  return playersInBattle.has(userId);
}

export function getBattle(battleId) {
  return activeMatches.get(battleId);
}
