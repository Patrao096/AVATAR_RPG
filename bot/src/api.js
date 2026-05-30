// bot/src/api.js
// Cliente HTTP do backend. Centraliza autenticação, headers, retry, etc.
//
// Padrões:
//   - Endpoints PÚBLICOS por discordId (leitura): apiGet('/bot/character/123')
//   - Endpoints AUTENTICADOS (escrita do user): exigem JWT obtido via /bot/token.
//     Use apiGet/apiPost com o opt { jwt }.
//   - Endpoints DE BOT (sensíveis): exigem header X-Bot-Secret.
//     Use apiPost com o opt { botSecret: true }.

import { CONFIG } from './config.js';

class ApiError extends Error {
  constructor(status, body) {
    const msg = body?.detail
      ? `${body.error || 'HTTP ' + status}: ${body.detail}`
      : (body?.error || `HTTP ${status}`);
    super(msg);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, { body, jwt, botSecret } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  if (botSecret) headers['X-Bot-Secret'] = CONFIG.BOT_INTERNAL_SECRET;

  let resp;
  try {
    resp = await fetch(`${CONFIG.API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Mensagem mais clara — esses são os 3 problemas mais comuns
    let hint = '';
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('econnrefused') || msg.includes('fetch failed')) {
      hint = `Backend não respondeu em ${CONFIG.API_URL}. ` +
             `Verifique a variável API_URL no .env (não use localhost se o bot estiver hospedado).`;
    } else if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
      hint = `Domínio não encontrado: ${CONFIG.API_URL}. Verifique a URL do backend no .env.`;
    } else if (msg.includes('timeout')) {
      hint = `Backend demorou demais pra responder em ${CONFIG.API_URL}.`;
    } else {
      hint = `Falha de rede ao falar com ${CONFIG.API_URL}: ${err.message}`;
    }
    throw new ApiError(0, { error: hint });
  }

  let parsed = null;
  try {
    parsed = await resp.json();
  } catch {
    parsed = null;
  }

  if (!resp.ok) throw new ApiError(resp.status, parsed || {});
  return parsed;
}

export const apiGet  = (path, opts) => request('GET',  path, opts);
export const apiPost = (path, body, opts) => request('POST', path, { ...(opts || {}), body });
export const apiPatch = (path, body, opts) => request('PATCH', path, { ...(opts || {}), body });

// ─── Helpers específicos do bot ───

// Garante que existe um User no banco pra esse Discord (cria se necessário)
export async function ensureUser({ discordId, username, avatar, globalName }) {
  return apiPost('/api/bot/ensure-user', {
    discordId,
    username: username || globalName || `user_${discordId}`,
    avatar: avatar || null,
  }, { botSecret: true });
}

// Pega JWT de um user (pra ações em nome dele — comprar, equipar, etc.)
const _jwtCache = new Map(); // discordId → { jwt, expiresAt }

export async function getUserJwt(discordUser) {
  const cached = _jwtCache.get(discordUser.id);
  if (cached && cached.expiresAt > Date.now()) return cached.jwt;

  // Garante que o user existe (cria se primeira vez)
  await ensureUser({
    discordId: discordUser.id,
    username: discordUser.username,
    avatar: discordUser.avatar,
    globalName: discordUser.globalName,
  });

  const data = await apiPost('/api/bot/token', { discordId: discordUser.id }, { botSecret: true });
  const jwt = data.token;
  _jwtCache.set(discordUser.id, { jwt, expiresAt: Date.now() + 55 * 60 * 1000 });
  return jwt;
}

export function invalidateJwt(discordId) {
  _jwtCache.delete(discordId);
}

// Snapshot consolidado — usado pela home do painel
export async function getSnapshot(discordId, fields = ['perfil', 'saldo']) {
  return apiGet(`/api/bot/snapshot/${discordId}?fields=${fields.join(',')}`);
}

// Saldo em tempo real (sem cache)
export async function getSaldo(discordId) {
  return apiGet(`/api/bot/saldo/${discordId}`);
}

export { ApiError };
