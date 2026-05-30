// backend/src/lib/ranks.js
// Sistema de rank estilo Valorant — Ferro → Bronze → Prata → Ouro → Diamante

export const RANK_TIERS = [
  { id: 'ferro',     name: 'Ferro',     minElo: 0,    maxElo: 799,   color: '#8B6F47', icon: '🔩', badge: '#a0826d' },
  { id: 'bronze',    name: 'Bronze',    minElo: 800,  maxElo: 1499,  color: '#CD7F32', icon: '🥉', badge: '#cd7f32' },
  { id: 'prata',     name: 'Prata',     minElo: 1500, maxElo: 2299,  color: '#C0C0C0', icon: '🥈', badge: '#c0c0c0' },
  { id: 'ouro',      name: 'Ouro',      minElo: 2300, maxElo: 3099,  color: '#FFD700', icon: '🥇', badge: '#ffd700' },
  { id: 'diamante',  name: 'Diamante',  minElo: 3100, maxElo: 99999, color: '#67E8F9', icon: '💎', badge: '#67e8f9' },
];

/**
 * Retorna o tier do ELO informado.
 */
export function getRankFromElo(elo) {
  const tier = RANK_TIERS.find(t => elo >= t.minElo && elo <= t.maxElo);
  return tier || RANK_TIERS[0];
}

/**
 * Calcula progresso (0-100%) dentro do tier atual.
 */
export function getRankProgress(elo) {
  const tier = getRankFromElo(elo);
  if (tier.id === 'diamante') {
    // Diamante é o topo — progresso infinito, mas cap visual em 100%
    return 100;
  }
  const range = tier.maxElo - tier.minElo;
  return Math.round(((elo - tier.minElo) / range) * 100);
}

/**
 * Retorna o próximo tier e quantos pontos faltam.
 */
export function getNextTier(elo) {
  const current = getRankFromElo(elo);
  const currentIdx = RANK_TIERS.findIndex(t => t.id === current.id);
  if (currentIdx >= RANK_TIERS.length - 1) return null;
  const next = RANK_TIERS[currentIdx + 1];
  return { ...next, pointsNeeded: next.minElo - elo };
}

/**
 * Calcula mudança de ELO numa batalha.
 * Vencedor ganha mais se o oponente for mais forte.
 * Perdedor perde menos se o oponente era mais forte.
 *
 * @param {number} playerElo       ELO do jogador
 * @param {number} opponentElo     ELO do oponente
 * @param {boolean} won            Se o jogador venceu
 * @returns {number}               Mudança de ELO (+/-)
 */
export function calculateEloChange(playerElo, opponentElo, won) {
  const K = 32;                               // fator de sensibilidade (clássico Elo)
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actual   = won ? 1 : 0;
  const change   = Math.round(K * (actual - expected));

  // Garante valores sensatos (mínimo 10, máximo 50)
  if (won) return Math.max(10, Math.min(50, change));
  return Math.max(-40, Math.min(-8, change));
}

/**
 * Calcula nível aproximado de poder (stat score) para matchmaking.
 */
export function calculatePowerScore(character) {
  const { level = 1, attack = 25, defense = 20, elo = 500 } = character;
  // Combinação: ELO pesa 60%, stats pesam 40%
  return Math.round(elo * 0.6 + (level * 50 + attack * 5 + defense * 5) * 0.4);
}

/**
 * Verifica se dois jogadores podem se enfrentar (balanceamento).
 * Quanto mais esperamos na fila, mais ampla a janela.
 *
 * @param {number} playerElo
 * @param {number} candidateElo
 * @param {number} waitSeconds   segundos que o jogador está na fila
 */
export function canMatch(playerElo, candidateElo, waitSeconds = 0) {
  // Janela inicial de 300 ELO; amplia 50 pontos a cada 2s de espera
  const baseWindow = 300;
  const window = baseWindow + Math.floor(waitSeconds / 2) * 50;
  return Math.abs(playerElo - candidateElo) <= window;
}
