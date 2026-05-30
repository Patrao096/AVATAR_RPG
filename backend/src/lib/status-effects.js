// backend/src/lib/status-effects.js
//
// Cada efeito tem:
//   - id: identificador único
//   - label: nome legível (PT-BR)
//   - icon: emoji para o log/UI
//   - element: elemento associado (Fogo/Água/Terra/Ar)
//   - duration: quantos turnos do alvo persiste (default = 2)
//   - color: usado pelo frontend para badges
//   - onApply, onTick, onTurnStart, onSkillUse: hooks
//
// Status effects são SEPARADOS de buffs: buffs ficam em side.buffs
// (atk/def temporários, ja existem). Status ficam em side.statusEffects.
//
// Aplicação típica:
//   1. Atacante usa skill com `applyStatus: 'burn'`
//   2. battle.js chama applyStatusEffect(state, defenderSide, 'burn')
//   3. No início de cada turno do alvo, tickStatusEffects é chamado
//      e roda os hooks (ex.: burn aplica 8 dano).

export const STATUS_EFFECTS = {
  // ─── 🔥 FOGO ───
  burn: {
    id: 'burn',
    label: 'Queimadura',
    icon: '🔥',
    element: 'Fogo',
    duration: 3,
    color: '#f97316', // orange-500
    description: '8 de dano por turno durante 3 turnos',
    /**
     * Aplica dano no INÍCIO do turno do alvo (antes dele jogar).
     * Retorna { hpDelta, message } pra battle.js logar.
     */
    onTurnStart(target) {
      const damage = 8;
      const dealt = Math.min(damage, target.hp);
      target.hp -= dealt;
      return {
        hpDelta: -dealt,
        message: `🔥 Queimadura causou ${dealt} de dano`,
      };
    },
  },

  // ─── 💧 ÁGUA ───
  freeze: {
    id: 'freeze',
    label: 'Congelamento',
    icon: '❄️',
    element: 'Água',
    duration: 2,
    color: '#22d3ee', // cyan-400
    description: '30% de chance de pular turno por 2 turnos',
    /**
     * No início do turno do alvo, com 30% de chance, pula o turno.
     * Retorna { skipTurn: true, message } se pular, null se passar.
     */
    onTurnStart(target) {
      if (Math.random() < 0.30) {
        return {
          skipTurn: true,
          message: `❄️ Congelado! ${target.name} perdeu o turno`,
        };
      }
      return null;
    },
  },

  // ─── 🪨 TERRA ───
  stun: {
    id: 'stun',
    label: 'Atordoamento',
    icon: '💫',
    element: 'Terra',
    duration: 1,
    color: '#facc15', // yellow-400
    description: 'Pula o próximo turno (garantido)',
    onTurnStart(target) {
      return {
        skipTurn: true,
        message: `💫 ${target.name} está atordoado e perdeu o turno`,
      };
    },
  },

  // ─── 🌪️ AR ───
  slow: {
    id: 'slow',
    label: 'Lentidão',
    icon: '🌪️',
    element: 'Ar',
    duration: 2,
    color: '#a3e635', // lime-400
    description: 'Cooldowns das skills aumentam em 1 turno',
    /**
     * Quando o alvo usa uma skill, o cooldown final é +1 turno.
     * battle.js chama onSkillUse depois de definir o cooldown.
     */
    onSkillUse(target, skill, currentCooldown) {
      // Só aumenta cooldown de skills com CD > 0 (ataques básicos têm 0)
      if (currentCooldown > 0) {
        return { cooldownDelta: 1 };
      }
      return null;
    },
  },
};

/**
 * Tenta aplicar um status effect num lado da batalha.
 *
 * - Não empilha: se o efeito já existe, REINICIA a duração (refresh).
 * - Antídoto remove qualquer status (ver consumables).
 * - duration opcional sobrescreve a default.
 *
 * Retorna o objeto do effect aplicado (com turnsRemaining), ou null.
 */
export function applyStatusEffect(side, statusId, opts = {}) {
  const def = STATUS_EFFECTS[statusId];
  if (!def) return null;

  if (!Array.isArray(side.statusEffects)) side.statusEffects = [];

  const duration = opts.duration ?? def.duration;
  const existing = side.statusEffects.find(s => s.id === statusId);

  if (existing) {
    // Refresh: reseta para a duração nova
    existing.turnsRemaining = duration;
    return existing;
  }

  const inst = {
    id: def.id,
    label: def.label,
    icon: def.icon,
    color: def.color,
    turnsRemaining: duration,
  };
  side.statusEffects.push(inst);
  return inst;
}

export function clearStatusEffects(side) {
  const removed = [...(side.statusEffects || [])];
  side.statusEffects = [];
  return removed;
}

/**
 * Remove UM status effect específico.
 * Retorna o que foi removido, ou null.
 */
export function removeStatusEffect(side, statusId) {
  if (!Array.isArray(side.statusEffects)) return null;
  const idx = side.statusEffects.findIndex(s => s.id === statusId);
  if (idx === -1) return null;
  return side.statusEffects.splice(idx, 1)[0];
}

/**
 * Decrementa duração de cada status no fim do turno do dono.
 * Remove os que chegaram a 0.
 *
 * Chamado em switchTurn (para o lado que acabou de jogar).
 */
export function tickStatusDuration(side) {
  if (!Array.isArray(side.statusEffects)) return;
  side.statusEffects = side.statusEffects
    .map(s => ({ ...s, turnsRemaining: s.turnsRemaining - 1 }))
    .filter(s => s.turnsRemaining > 0);
}

export function runTurnStartHooks(side) {
  const result = { skipTurn: false, logs: [], died: false };
  if (!Array.isArray(side.statusEffects) || side.statusEffects.length === 0) {
    return result;
  }
  for (const status of side.statusEffects) {
    const def = STATUS_EFFECTS[status.id];
    if (!def?.onTurnStart) continue;
    const hookResult = def.onTurnStart(side);
    if (!hookResult) continue;
    if (hookResult.message) {
      result.logs.push({
        message: hookResult.message,
        hpDelta: hookResult.hpDelta || 0,
        statusId: status.id,
      });
    }
    if (hookResult.skipTurn) result.skipTurn = true;
    if (side.hp <= 0) {
      side.hp = 0;
      result.died = true;
      break; // não roda mais hooks se morreu
    }
  }
  return result;
}

/**
 * Aplica modificadores `onSkillUse` (usado pelo Slow para aumentar
 * cooldown). Retorna o cooldown final.
 */
export function applySkillUseModifiers(side, skill, baseCooldown) {
  let cooldown = baseCooldown;
  for (const status of (side.statusEffects || [])) {
    const def = STATUS_EFFECTS[status.id];
    if (!def?.onSkillUse) continue;
    const r = def.onSkillUse(side, skill, cooldown);
    if (r?.cooldownDelta) cooldown += r.cooldownDelta;
  }
  return cooldown;
}

/**
 * Usado pelo serializeStateForSide pra mandar status pro frontend.
 */
export function serializeStatusEffects(side) {
  return (side.statusEffects || []).map(s => ({
    id: s.id,
    label: s.label,
    icon: s.icon,
    color: s.color,
    turnsRemaining: s.turnsRemaining,
  }));
}
