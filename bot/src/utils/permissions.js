// bot/src/utils/permissions.js
// Helpers de permissão. Lê admin via .env (mesma fonte do backend),
// premium via subscription do user (busca no backend).

import { apiGet } from '../api.js';

export function isAdminDiscord(discordId) {
  const ids = (process.env.ADMIN_DISCORD_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return ids.includes(discordId);
}

/**
 * Verifica se o usuário tem premium ativo. Usa snapshot do backend.
 * Retorna boolean.
 */
export async function hasActivePremium(discordId) {
  try {
    const data = await apiGet(`/api/bot/snapshot/${discordId}?fields=assinatura`);
    const s = data.assinatura;
    if (!s) return false;
    if (s.status !== 'active') return false;
    if (s.expiresAt && new Date(s.expiresAt) < new Date()) return false;
    return true;
  } catch {
    return false;
  }
}
