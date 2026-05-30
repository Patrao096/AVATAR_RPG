// backend/src/lib/boss-ai.js
//
// PRINCÍPIO: O bot lê o estado da batalha mas tem limitações intencionais
// para nunca ser impossível de vencer.
//
// NÍVEIS DE DIFICULDADE (baseado no ELO do jogador):
//   Fácil   (ELO < 800)   → age bem aleatoriamente, ignora muita coisa
//   Médio   (ELO 800-1500) → estratégia básica, reage ao HP e Chi
//   Difícil (ELO > 1500)   → lê os últimos movimentos, mas erra 25% do tempo
//
//   1. HP crítico < 20% + tem poção → usa poção
//   2. Pode matar com 1 skill → ataca com tudo
//   3. Sem Chi para nenhuma skill → defende
//
// CAP DE ACERTO INTENCIONAL:
//   Fácil:   60% chance de agir de forma ótima (40% aleatório)
//   Médio:   75% chance de agir de forma ótima (25% aleatório)
//   Difícil: 75% chance de agir de forma ótima (25% aleatório)
//   → Mesmo no nível mais alto, age aleatoriamente 25% do tempo.
//
// PERSONALIDADES (mantidas do sistema anterior):
//   aggressive, defensive, wise, trickster, berserker

import { SKILLS, getLeveledSkill, calculateDamage } from './skills.js';

export const POTION_COOLDOWN_TURNS = 2;

// ─── Determina nível de dificuldade pelo ELO do jogador ─────────────────
function getDifficultyLevel(playerElo) {
  if (playerElo < 800)  return 'easy';
  if (playerElo < 1500) return 'medium';
  return 'hard';
}

// ─── Cap de acerto ótimo por dificuldade ────────────────────────────────
const OPTIMAL_CHANCE = { easy: 0.60, medium: 0.75, hard: 0.75 };

// ─── Estimativa de dano médio de uma skill ──────────────────────────────
function estimateDamage(skill, attacker, defender) {
  if (!skill || (skill.baseDamageMax || 0) === 0) return 0;
  const median = (skill.baseDamageMin + skill.baseDamageMax) / 2;
  const atkTotal = (attacker.attack || 25)
    + (attacker.equipBonus?.attack || 0)
    + (attacker.clanBuff?.attack || 0);
  const defTotal = (defender.defense || 20)
    + (defender.equipBonus?.defense || 0)
    + (defender.clanBuff?.defense || 0);
  return Math.max(1, Math.round(median + atkTotal / 2 - defTotal / 3));
}

// ─── Skill aleatória entre as disponíveis (fallback do random) ──────────
function randomAction(available, boss) {
  const roll = Math.random();
  if (roll < 0.15 && boss.chi > 10) return { action: 'defend' };
  const pick = available[Math.floor(Math.random() * available.length)];
  return { action: 'skill', skillId: pick.id };
}

// ─── Ação ótima: a melhor escolha dada a situação ───────────────────────
function optimalAction(available, boss, player, personality, extras, difficulty) {
  const { hasPotion = false, potionCdRemaining = 0, moveHistory = [] } = extras;
  const myHpRatio  = boss.hp / (boss.maxHp || 100);
  const oppHpRatio = player.hp / (player.maxHp || 100);

  // ── REGRA 1: HP crítico < 20% + poção disponível → cura ──
  if (myHpRatio < 0.20 && hasPotion && potionCdRemaining === 0) {
    return { action: 'potion' };
  }

  // ── REGRA 2: pode matar → usa skill mais forte ──
  const byDamage = [...available].sort((a, b) =>
    estimateDamage(b, boss, player) - estimateDamage(a, boss, player)
  );
  const strongest = byDamage[0];
  if (strongest && estimateDamage(strongest, boss, player) >= player.hp) {
    return { action: 'skill', skillId: strongest.id };
  }

  // ── REGRA 3: sem Chi → defende ──
  const hasAffordable = available.some(s => s.chiCost <= boss.chi);
  if (!hasAffordable) return { action: 'defend' };

  // ── LEITURA DE HISTÓRICO (apenas dificuldade média/difícil) ──
  if (difficulty !== 'easy' && moveHistory.length >= 2) {
    const lastTwo = moveHistory.slice(-2);
    // Se jogador usou cura 2x seguidas → pressiona com skill mais forte
    const healedTwice = lastTwo.every(m => m.action === 'potion' || m.skillId?.includes('cura') || m.skillId?.includes('heal'));
    if (healedTwice) {
      return { action: 'skill', skillId: strongest.id };
    }
    // Se jogador está conservando Chi (defendeu 2x seguidas) → usa skill com debuff
    const defendedTwice = lastTwo.every(m => m.action === 'defend');
    if (defendedTwice) {
      const debuffSkill = available.find(s =>
        s.passiveEffect && ['stun', 'burn', 'freeze', 'silence', 'chi_drain', 'slow'].includes(s.passiveEffect)
      );
      if (debuffSkill) return { action: 'skill', skillId: debuffSkill.id };
    }
    // Se jogador tem pouco Chi → usa drain de Chi (apenas difícil)
    if (difficulty === 'hard' && player.chi < 15) {
      const drainSkill = available.find(s => s.passiveEffect === 'chi_drain' || s.passiveEffect === 'chi_burn');
      if (drainSkill) return { action: 'skill', skillId: drainSkill.id };
    }
  }

  // ── PERSONALIDADES ──
  return personalityAction(personality, available, boss, player, myHpRatio, oppHpRatio, hasPotion, potionCdRemaining);
}

// ─── Ação por personalidade ─────────────────────────────────────────────
function personalityAction(personality, available, boss, player, myHpRatio, oppHpRatio, hasPotion, potionCd) {
  const byDamage = [...available].sort((a, b) =>
    estimateDamage(b, boss, player) - estimateDamage(a, boss, player)
  );

  switch (personality) {

    case 'aggressive':
      // Sempre o mais forte disponível
      return { action: 'skill', skillId: byDamage[0].id };

    case 'defensive':
      // Usa poção se HP < 50%
      if (myHpRatio < 0.50 && hasPotion && potionCd === 0) return { action: 'potion' };
      // Defende se HP < 40%
      if (myHpRatio < 0.40) return { action: 'defend' };
      // Ataque médio (evita o mais fraco e o mais forte — equilíbrio)
      const mid = byDamage[Math.floor(byDamage.length / 2)] || byDamage[0];
      return { action: 'skill', skillId: mid.id };

    case 'wise':
      // Finaliza se oponente fraco
      if (oppHpRatio < 0.30 && myHpRatio > 0.40) return { action: 'skill', skillId: byDamage[0].id };
      // Poção se ferido mas não crítico
      if (myHpRatio < 0.55 && hasPotion && potionCd === 0) return { action: 'potion' };
      // Conserva Chi se baixo
      const chiRatio = boss.chi / (boss.maxChi || 50);
      if (chiRatio < 0.25 && myHpRatio > 0.45) return { action: 'defend' };
      // Skill com melhor dano-por-chi
      const efficient = [...available].sort((a, b) => {
        const effA = estimateDamage(a, boss, player) / Math.max(1, a.chiCost);
        const effB = estimateDamage(b, boss, player) / Math.max(1, b.chiCost);
        return effB - effA;
      });
      return { action: 'skill', skillId: efficient[0].id };

    case 'trickster':
      // 30% chance de defender (imprevisível)
      if (Math.random() < 0.30 && myHpRatio > 0.40) return { action: 'defend' };
      // Prefere skills com CC/debuff
      const ccSkill = available.find(s =>
        ['stun', 'freeze', 'silence', 'root', 'blind'].includes(s.passiveEffect)
      );
      if (ccSkill && Math.random() < 0.60) return { action: 'skill', skillId: ccSkill.id };
      // Aleatório
      return { action: 'skill', skillId: available[Math.floor(Math.random() * available.length)].id };

    case 'berserker':
      // Raramente cura (orgulho) — só se quase morto
      if (myHpRatio < 0.15 && hasPotion && potionCd === 0 && Math.random() < 0.40) {
        return { action: 'potion' };
      }
      // Quanto menor o HP, mais agressivo (ignora tudo e vai com o mais forte)
      return { action: 'skill', skillId: byDamage[0].id };

    default:
      return { action: 'skill', skillId: byDamage[0].id };
  }
}

// FUNÇÃO PRINCIPAL — chooseBossAction

/**
 * @param {object} bossSide    - estado atual do boss
 * @param {object} playerSide  - estado atual do jogador
 * @param {string} personality - 'aggressive'|'defensive'|'wise'|'trickster'|'berserker'
 * @param {object} extras      - { hasPotion, potionCdRemaining, playerElo, moveHistory }
 *
 * moveHistory: array dos últimos 4 movimentos do jogador
 *   [{ action: 'skill'|'defend'|'potion', skillId?: string }]
 *
 * @returns {{ action: 'skill'|'defend'|'potion', skillId?: string }}
 */
export function chooseBossAction(bossSide, playerSide, personality, extras = {}) {
  const {
    hasPotion = false,
    potionCdRemaining = 0,
    playerElo = 500,
    moveHistory = [],
  } = extras;

  // Skills disponíveis no momento
  const available = (bossSide.equippedSkillIds || [])
    .map(id => {
      const lvl = bossSide.skillLevels?.[id] || 1;
      return getLeveledSkill(id, lvl);
    })
    .filter(Boolean)
    .filter(s => (bossSide.chi || 0) >= (s.chiCost || 0))
    .filter(s => !((bossSide.cooldowns || {})[s.id] > 0));

  // Sempre tem ataque básico como fallback
  const basicAttack = { ...SKILLS.ataque_basico, level: 1 };
  if (!available.find(s => s.id === 'ataque_basico')) available.push(basicAttack);

  // Determina dificuldade
  const difficulty = getDifficultyLevel(playerElo);
  const optimalChance = OPTIMAL_CHANCE[difficulty];

  // CAP DE ACERTO: decide se age de forma ótima ou aleatória
  const actsOptimally = Math.random() < optimalChance;

  if (!actsOptimally) {
    return randomAction(available, bossSide);
  }

  return optimalAction(available, bossSide, playerSide, personality, {
    hasPotion,
    potionCdRemaining,
    moveHistory,
  }, difficulty);
}

// ─── Helper: escolhe personalidade do boss baseado no elemento ──────────
export function getBossPersonality(element) {
  const map = {
    'Fogo':  'aggressive',
    'Água':  'wise',
    'Terra': 'defensive',
    'Ar':    'trickster',
  };
  return map[element] || 'wise';
}

// ─── Helper: escolhe personalidade para bosses de treino ────────────────
export function getTrainingBossPersonality(bossName) {
  const personalities = {
    'Katara': 'wise',
    'Zuko':   'aggressive',
    'Toph':   'berserker',
    'Aang':   'trickster',
    'Azula':  'aggressive',
    'Iroh':   'defensive',
    'Pakku':  'wise',
    'Bumi':   'berserker',
  };
  return personalities[bossName] || 'wise';
}