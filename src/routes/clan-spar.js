// backend/src/routes/clan-spar.js
// Batalhas amistosas entre membros do mesmo clã
//   POST  /api/clan-spar/challenge/:userId  — desafia outro membro
//   POST  /api/clan-spar/:id/accept         — aceita desafio (cria battle)
//   POST  /api/clan-spar/:id/reject         — rejeita
//   POST  /api/clan-spar/:id/cancel         — cancela (emissor)
//   GET   /api/clan-spar/pending            — meus desafios pendentes (recebidos)
//   GET   /api/clan-spar/sent               — desafios que enviei

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeEquipBonus, getEquippedConsumables } from './inventory.js';
import { getEffectiveClanBuff } from './loadout.js';
import { getRankFromElo } from '../lib/ranks.js';
import {
  createBattle as createBattleState,
  getActiveBattleForUser,
} from '../lib/battle-state.js';
import { isInBattle, leaveBattle, createBotBattle } from '../lib/matchmaking.js';

const router = express.Router();

const CHALLENGE_EXPIRY_MIN = 10;

// In-memory store de desafios (não precisa persistir, expira rápido)
// { id, fromUserId, toUserId, clanId, expiresAt, status }
const challenges = new Map();
let challengeCounter = 0;
const newChallengeId = () => `chal-${Date.now()}-${++challengeCounter}`;

function purgeExpired() {
  const now = Date.now();
  for (const [id, c] of challenges) {
    if (c.expiresAt < now || c.status !== 'pending') challenges.delete(id);
  }
}

async function loadFullCharacterState(userId) {
  const character = await prisma.character.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!character) return null;

  const equipBonus = await computeEquipBonus(character.id);
  const clanBuff = await getEffectiveClanBuff(character.id, userId);
  const equippedConsumables = await getEquippedConsumables(character.id);
  const equippedSkillIds = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];

  const fullMaxHp = character.maxHp + (equipBonus.hp || 0) + (clanBuff.hp || 0);
  const fullMaxChi = character.maxChi + (equipBonus.chi || 0) + (clanBuff.chi || 0);

  return {
    character,
    sidePayload: {
      userId,
      characterId: character.id,
      name: character.name,
      element: character.element,
      level: character.level,
      elo: character.elo,
      attack: character.attack,
      defense: character.defense,
      maxHp: fullMaxHp, hp: fullMaxHp,
      maxChi: fullMaxChi, chi: fullMaxChi,
      equipBonus,
      clanBuff,
      equippedSkillIds,
      consumables: equippedConsumables.map(c => ({
        inventoryId: c.id,
        itemName: c.itemName,
        quantity: c.quantity,
        effect: c.effect,
      })),
      isBot: false,
      avatar: character.user.avatar,
    },
    equipBonus,
    clanBuff,
    fullMaxHp,
    fullMaxChi,
  };
}

// DESAFIAR
router.post('/challenge/:userId', authMiddleware, async (req, res) => {
  try {
    purgeExpired();

    const targetId = req.params.userId;
    if (targetId === req.userId) return res.status(400).json({ error: 'Não pode se desafiar' });

    const myMember = await prisma.clanMember.findUnique({ where: { userId: req.userId } });
    if (!myMember) return res.status(400).json({ error: 'Você não está em um clã' });

    const targetMember = await prisma.clanMember.findUnique({ where: { userId: targetId } });
    if (!targetMember || targetMember.clanId !== myMember.clanId) {
      return res.status(400).json({ error: 'Alvo não está no seu clã' });
    }

    // Já existe desafio dos dois?
    for (const c of challenges.values()) {
      if (c.status === 'pending' &&
          ((c.fromUserId === req.userId && c.toUserId === targetId) ||
           (c.fromUserId === targetId && c.toUserId === req.userId))) {
        return res.status(400).json({ error: 'Já há um desafio pendente entre vocês' });
      }
    }

    // Não pode estar em batalha
    if (isInBattle(req.userId)) return res.status(400).json({ error: 'Você já está em batalha' });
    if (isInBattle(targetId)) return res.status(400).json({ error: 'O alvo está em batalha' });

    // Personagens existem e completaram cap. 1?
    const me = await prisma.character.findUnique({ where: { userId: req.userId } });
    const target = await prisma.character.findUnique({ where: { userId: targetId } });
    if (!me || !target) return res.status(404).json({ error: 'Personagem não encontrado' });
    if (!me.element || me.element === 'Nenhum') return res.status(400).json({ error: 'Você não tem elemento ainda' });
    if (!target.element || target.element === 'Nenhum') return res.status(400).json({ error: 'Alvo sem elemento' });

    const id = newChallengeId();
    challenges.set(id, {
      id,
      fromUserId: req.userId,
      toUserId: targetId,
      clanId: myMember.clanId,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + CHALLENGE_EXPIRY_MIN * 60 * 1000,
    });

    res.json({ success: true, challengeId: id, message: '⚔️ Desafio enviado!' });
  } catch (error) {
    console.error('clan-spar/challenge:', error);
    res.status(500).json({ error: 'Erro ao desafiar' });
  }
});

// PENDING / SENT
router.get('/pending', authMiddleware, async (req, res) => {
  purgeExpired();
  const mine = [...challenges.values()].filter(c => c.toUserId === req.userId && c.status === 'pending');
  if (mine.length === 0) return res.json([]);

  const userIds = mine.map(c => c.fromUserId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, include: { character: true } });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(mine.map(c => ({
    id: c.id,
    fromUserId: c.fromUserId,
    fromUsername: userMap[c.fromUserId]?.username || '?',
    fromAvatar: userMap[c.fromUserId]?.avatar || null,
    fromLevel: userMap[c.fromUserId]?.character?.level || 1,
    fromElement: userMap[c.fromUserId]?.character?.element || null,
    expiresAt: new Date(c.expiresAt).toISOString(),
  })));
});

router.get('/sent', authMiddleware, async (req, res) => {
  purgeExpired();
  const mine = [...challenges.values()].filter(c => c.fromUserId === req.userId && c.status === 'pending');
  res.json(mine.map(c => ({
    id: c.id,
    toUserId: c.toUserId,
    expiresAt: new Date(c.expiresAt).toISOString(),
  })));
});

// ACEITAR — cria battle state amistoso
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    purgeExpired();
    const challenge = challenges.get(req.params.id);
    if (!challenge || challenge.status !== 'pending') {
      return res.status(404).json({ error: 'Desafio não encontrado ou expirado' });
    }
    if (challenge.toUserId !== req.userId) return res.status(403).json({ error: 'Não é pra você' });
    if (challenge.expiresAt < Date.now()) {
      challenge.status = 'expired';
      return res.status(400).json({ error: 'Desafio expirado' });
    }

    if (isInBattle(req.userId)) {
      const stale = getActiveBattleForUser(req.userId);
      if (!stale) leaveBattle(req.userId);
      else return res.status(400).json({ error: 'Você já está em batalha' });
    }
    if (isInBattle(challenge.fromUserId)) {
      return res.status(400).json({ error: 'Desafiante já está em batalha' });
    }

    // Carrega ambos
    const fromState = await loadFullCharacterState(challenge.fromUserId);
    const toState = await loadFullCharacterState(req.userId);
    if (!fromState || !toState) return res.status(404).json({ error: 'Personagem ausente' });

    // Cria battle: fromUser = side A, toUser = side B
    const battleId = `spar-${Date.now()}-${challenge.id}`;
    createBattleState(
      battleId,
      fromState.sidePayload,
      toState.sidePayload,
      { isPvP: true, isFriendly: true }
    );

    // Registra ambos no matchmaking via createBotBattle (reusa o tracker)
    createBotBattle(challenge.fromUserId, battleId);
    createBotBattle(req.userId, battleId);

    challenge.status = 'accepted';

    res.json({
      success: true,
      battleId,
      mySide: 'B',
      isFriendly: true,
      player: {
        name: toState.character.name,
        element: toState.character.element,
        level: toState.character.level,
        elo: toState.character.elo,
        attack: toState.character.attack,
        defense: toState.character.defense,
        hp: toState.fullMaxHp, maxHp: toState.fullMaxHp,
        chi: toState.fullMaxChi, maxChi: toState.fullMaxChi,
        rank: getRankFromElo(toState.character.elo),
        equipBonus: toState.equipBonus,
        clanBuff: toState.clanBuff,
      },
      opponent: {
        name: fromState.character.name,
        element: fromState.character.element,
        icon: { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' }[fromState.character.element] || '⚔️',
        level: fromState.character.level,
        elo: fromState.character.elo,
        attack: fromState.character.attack,
        defense: fromState.character.defense,
        hp: fromState.fullMaxHp, maxHp: fromState.fullMaxHp,
        rank: getRankFromElo(fromState.character.elo),
        avatar: fromState.character.user.avatar,
        isBot: false,
      },
      message: '🤝 Batalha amistosa iniciada!',
    });
  } catch (error) {
    console.error('clan-spar/accept:', error);
    res.status(500).json({ error: 'Erro ao aceitar' });
  }
});

router.post('/:id/reject', authMiddleware, async (req, res) => {
  const challenge = challenges.get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Não encontrado' });
  if (challenge.toUserId !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
  challenge.status = 'rejected';
  res.json({ success: true });
});

router.post('/:id/cancel', authMiddleware, async (req, res) => {
  const challenge = challenges.get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Não encontrado' });
  if (challenge.fromUserId !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
  challenge.status = 'cancelled';
  res.json({ success: true });
});

export default router;
