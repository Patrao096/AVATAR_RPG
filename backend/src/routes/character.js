import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { getRankFromElo } from '../lib/ranks.js';

const router = express.Router();

// Helper — verifica se um discordId é admin via .env
function isAdminDiscord(discordId) {
  const ids = (process.env.ADMIN_DISCORD_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return ids.includes(discordId);
}

// GET /api/character/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    let character = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { user: true, inventory: true, quests: true, storyProgress: true },
    });

    if (!character) {
      return res.status(404).json({ error: 'Personagem não encontrado' });
    }

    // ─── Bloqueia usuários banidos ───
    if (character.user.role === 'banned') {
      return res.status(403).json({
        error: 'Sua conta foi banida. Entre em contato com o suporte.',
        banned: true,
      });
    }

    // ─── userRole dinâmico: admin se discordId estiver em ADMIN_DISCORD_IDS ───
    const isAdmin = isAdminDiscord(character.user.discordId);
    const userRole = isAdmin ? 'admin' : (character.user.role || 'user');

    res.json({
      ...character,
      discordUsername: character.user.username,
      discordAvatar: character.user.avatar,
      userRole,
      isAdmin,
      needsStoryCompletion: !character.element || character.element === 'Nenhum',
      rank: getRankFromElo(character.elo || 500),
    });
  } catch (error) {
    console.error('character/me error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/character/ranking
router.get('/ranking', async (req, res) => {
  try {
    const characters = await prisma.character.findMany({
      orderBy: [{ elo: 'desc' }, { wins: 'desc' }],
      take: 50,
      include: { user: true },
    });

    const ranking = characters.map((c, i) => ({
      position: i + 1,
      name: c.name,
      discordId: c.user.discordId,
      discordUsername: c.user.username,
      discordAvatar: c.user.avatar,
      element: c.element,
      level: c.level,
      wins: c.wins,
      losses: c.losses,
      exp: c.exp,
      elo: c.elo,
      rank: getRankFromElo(c.elo || 500),
    }));

    res.json(ranking);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar ranking' });
  }
});

// PATCH /api/character/me
router.patch('/me', authMiddleware, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 3 || name.length > 24) {
    return res.status(400).json({ error: 'Nome inválido (3 a 24 caracteres)' });
  }
  if (!/^[a-zA-ZÀ-ÿ0-9 _-]+$/.test(name)) {
    return res.status(400).json({ error: 'Nome contém caracteres inválidos' });
  }
  try {
    const character = await prisma.character.update({
      where: { userId: req.userId },
      data: { name },
    });
    res.json(character);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar personagem' });
  }
});

export default router;
