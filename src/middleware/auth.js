import jwt from 'jsonwebtoken';

// IMPORTANTE: este fallback deve ser IDÊNTICO ao usado em server.js,
// senão tokens assinados em dev (sem JWT_SECRET no .env) não validam.
const JWT_SECRET = process.env.JWT_SECRET || 'avatar-rpg-secret-change-in-production';

// Middleware usado nas rotas antigas — alinhado com security.js
export function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

  try {
    // sem issuer/audience — igual ao jwt.sign no server.js
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

export function adminMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

    if (!adminIds.includes(decoded.discordId)) {
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
