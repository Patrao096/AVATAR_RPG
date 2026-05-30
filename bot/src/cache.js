// bot/src/cache.js
// Cache em memória + throttle por usuário.
//
// Uso típico:
//   import { cached, throttle } from './cache.js';
//   const dados = await cached(`perfil:${userId}`, () => apiGet(`/...`));
//   if (throttle(userId)) return ephemeral('Calma aí, tá rápido demais.');

import { CONFIG } from './config.js';

// Cache TTL

const _cache = new Map(); // key → { value, expiresAt }

/**
 * Busca do cache OU executa o fetcher e guarda. TTL configurável.
 * Se o fetcher lança erro, NÃO cacheia (próxima chamada tenta de novo).
 */
export async function cached(key, fetcher, ttlMs = CONFIG.CACHE_TTL_MS) {
  const hit = _cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await fetcher();
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidate(keyOrPrefix) {
  // Se termina com `:*`, invalida tudo que começa com o prefixo
  if (keyOrPrefix.endsWith(':*')) {
    const prefix = keyOrPrefix.slice(0, -1); // remove só o '*'
    for (const k of _cache.keys()) {
      if (k.startsWith(prefix)) _cache.delete(k);
    }
  } else {
    _cache.delete(keyOrPrefix);
  }
}

export function invalidateUser(discordId) {
  for (const k of _cache.keys()) {
    if (k.includes(discordId)) _cache.delete(k);
  }
}

// Limpeza periódica de entradas expiradas (não trava JS, leve)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _cache.entries()) {
    if (v.expiresAt <= now) _cache.delete(k);
  }
}, 60_000).unref();

// Throttle (anti-clique-spam)

const _clicks = new Map(); // discordId → array de timestamps recentes

/**
 * Retorna `true` se o usuário deve ser bloqueado (clicou demais).
 * Janela: 1 segundo. Limite: CONFIG.CLICK_THROTTLE_PER_SEC.
 */
export function throttle(discordId) {
  const now = Date.now();
  const cutoff = now - 1_000;
  const arr = (_clicks.get(discordId) || []).filter(t => t > cutoff);
  arr.push(now);
  _clicks.set(discordId, arr);
  return arr.length > CONFIG.CLICK_THROTTLE_PER_SEC;
}

// Limpa estados antigos a cada 5 min
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [id, arr] of _clicks.entries()) {
    if (arr.length === 0 || arr[arr.length - 1] < cutoff) _clicks.delete(id);
  }
}, 300_000).unref();
