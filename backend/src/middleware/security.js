import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';

// IMPORTANTE: precisa ser IDÊNTICO ao fallback de auth.js e server.js,
// senão tokens assinados sem JWT_SECRET no .env não validam aqui.
const JWT_SECRET = process.env.JWT_SECRET || 'avatar-rpg-secret-change-in-production';

// ─── Helmet sem CSP bloqueante para OAuth redirect ───
export const helmetConfig = helmet({
  contentSecurityPolicy: false, // Desabilitado em dev — habilite em produção com cuidado
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
});

// ─── Rate limiters ───
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde 1 minuto.' },
  skip: (req) => req.path === '/health',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Aumentado de 10 para 20 — 10 era muito restritivo em dev
  message: { error: 'Muitas tentativas de login. Tente em 15 minutos.' },
  keyGenerator: (req) => req.ip || 'unknown',
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.userId || req.ip || 'unknown',
  message: { error: 'Limite de requisições atingido.' },
});

export const battleLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60, // Aumentado de 30 para 60
  keyGenerator: (req) => req.userId || req.ip || 'unknown',
  message: { error: 'Limite de batalhas atingido (60/hora).' },
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.userId || req.ip || 'unknown',
  message: { error: 'Limite de tentativas de pagamento atingido.' },
});

export const marketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.userId || req.ip || 'unknown',
  message: { error: 'Limite de operações no mercado atingido.' },
});

// ─── Auth middleware — CORRIGIDO (sem issuer/audience) ───
export function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

  try {
    // verify sem issuer/audience — igual ao sign em server.js
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.discordId = decoded.discordId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }
    return res.status(403).json({ error: 'Token inválido.' });
  }
}

// ─── Admin middleware — exclusivo pelo Discord ID do .env ───
export async function adminMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

    if (!adminIds.includes(decoded.discordId)) {
      console.warn(`⚠️ Acesso admin negado — DiscordID: ${decoded.discordId} — IP: ${req.ip}`);
      return res.status(403).json({ error: 'Acesso negado. Área restrita.' });
    }

    req.userId = decoded.userId;
    req.discordId = decoded.discordId;
    req.userRole = 'admin';
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido.' });
  }
}

// ─── Validação de inputs ───
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos.',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

export const validators = {
  sellItem: [
    body('itemName').trim().isLength({ min: 2, max: 60 }),
    body('quantity').isInt({ min: 1, max: 999 }),
    body('priceMoney').isInt({ min: 1, max: 999999 }),
  ],
  createClan: [
    body('name').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-ZÀ-ÿ0-9 _-]+$/),
    body('element').isIn(['Fogo', 'Água', 'Terra', 'Ar']),
    body('description').optional().trim().isLength({ max: 200 }),
  ],
  battleEnd: [
    body('result').isIn(['win', 'lose', 'draw']),
    body('opponentName').trim().isLength({ min: 1, max: 60 }),
    body('opponentElement').trim().isLength({ min: 1, max: 20 }),
  ],
  createTrade: [
    body('targetUserId').isString().isLength({ min: 5, max: 50 }),
    body('offeredItemName').isString().isLength({ min: 1, max: 100 }),
    body('requestedItemName').isString().isLength({ min: 1, max: 100 }),
  ],
};

export function sanitizeResponse(data) {
  if (!data) return data;
  const sensitive = ['password', 'hash', 'secret', 'token', 'paymentId'];
  if (Array.isArray(data)) return data.map(sanitizeResponse);
  if (typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([key]) => !sensitive.includes(key.toLowerCase()))
        .map(([k, v]) => [k, sanitizeResponse(v)])
    );
  }
  return data;
}

export function verifyMPWebhook(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  next();
}
