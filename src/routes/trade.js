// backend/src/routes/trade.js
// Sistema de trocas de itens e skills entre jogadores

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { validators, validate } from '../middleware/security.js';

const router = express.Router();

// GET /api/trade — Minhas propostas ativas
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [sent, received] = await Promise.all([
      prisma.tradeOffer.findMany({
        where: { fromUserId: req.userId, status: 'pending' },
        include: { toUser: { select: { username: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tradeOffer.findMany({
        where: { toUserId: req.userId, status: 'pending' },
        include: { fromUser: { select: { username: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({ sent, received });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar trocas.' });
  }
});

// GET /api/trade/search-user?q=nome — Buscar usuários para troca
router.get('/search-user', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        id: { not: req.userId }, // não retorna o próprio usuário
      },
      include: {
        character: { select: { level: true, element: true } },
      },
      take: 8,
      orderBy: { username: 'asc' },
    });
    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      level: u.character?.level || 1,
      element: u.character?.element || null,
    })));
  } catch (error) {
    console.error('trade/search-user:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

// POST /api/trade/propose — Propor troca
router.post('/propose', authMiddleware, validators.createTrade, validate, async (req, res) => {
  const { targetUserId, offeredItemName, requestedItemName, message } = req.body;

  if (targetUserId === req.userId) {
    return res.status(400).json({ error: 'Você não pode trocar com você mesmo.' });
  }

  try {
    const [myCharacter, targetUser] = await Promise.all([
      prisma.character.findUnique({
        where: { userId: req.userId },
        include: { inventory: true },
      }),
      prisma.user.findUnique({ where: { id: targetUserId } }),
    ]);

    if (!myCharacter) return res.status(404).json({ error: 'Seu personagem não encontrado.' });
    if (!targetUser) return res.status(404).json({ error: 'Jogador alvo não encontrado.' });

    // Verifica se tem o item oferecido
    const myItem = myCharacter.inventory.find(
      i => i.itemName === offeredItemName && i.quantity > 0
    );
    if (!myItem) {
      return res.status(400).json({ error: `Você não possui "${offeredItemName}" no inventário.` });
    }

    // Verifica se não tem mais de 5 trocas ativas
    const activeTrades = await prisma.tradeOffer.count({
      where: { fromUserId: req.userId, status: 'pending' },
    });
    if (activeTrades >= 5) {
      return res.status(400).json({ error: 'Você já tem 5 trocas pendentes. Cancele uma antes.' });
    }

    // Reserva o item (decrementa temporariamente)
    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: myItem.id },
        data: { quantity: { decrement: 1 } },
      }),
      prisma.tradeOffer.create({
        data: {
          fromUserId: req.userId,
          toUserId: targetUserId,
          offeredItemName,
          offeredItemInventoryId: myItem.id,
          requestedItemName,
          message: message?.substring(0, 200) || '',
          status: 'pending',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
        },
      }),
    ]);

    res.json({ success: true, message: `Proposta de troca enviada para ${targetUser.username}!` });
  } catch (error) {
    console.error('trade/propose:', error);
    res.status(500).json({ error: 'Erro ao criar proposta de troca.' });
  }
});

// POST /api/trade/:id/accept — Aceitar troca
router.post('/:id/accept', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const trade = await prisma.tradeOffer.findUnique({ where: { id } });

    if (!trade) return res.status(404).json({ error: 'Proposta não encontrada.' });
    if (trade.toUserId !== req.userId) return res.status(403).json({ error: 'Acesso negado.' });
    if (trade.status !== 'pending') return res.status(400).json({ error: 'Esta troca não está mais disponível.' });
    if (new Date(trade.expiresAt) < new Date()) {
      await prisma.tradeOffer.update({ where: { id }, data: { status: 'expired' } });
      return res.status(400).json({ error: 'Esta proposta expirou.' });
    }

    // Verifica se tem o item solicitado
    const myCharacter = await prisma.character.findUnique({
      where: { userId: req.userId },
      include: { inventory: true },
    });

    const myItem = myCharacter.inventory.find(
      i => i.itemName === trade.requestedItemName && i.quantity > 0
    );
    if (!myItem) {
      return res.status(400).json({
        error: `Você não possui "${trade.requestedItemName}" para esta troca.`,
      });
    }

    const fromCharacter = await prisma.character.findUnique({ where: { userId: trade.fromUserId } });

    // Executa troca atomicamente
    await prisma.$transaction(async (tx) => {
      // Trava de concorrência: só prossegue se a troca ainda estiver pendente.
      // Dois accepts simultâneos → só um vê count 1; o outro aborta sem duplicar.
      const claimed = await tx.tradeOffer.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'accepted', completedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new Error('TRADE_GONE');
      }

      // Decrementa item do receiver (condicional, evita estoque negativo)
      const dec = await tx.inventoryItem.updateMany({
        where: { id: myItem.id, quantity: { gt: 0 } },
        data: { quantity: { decrement: 1 } },
      });
      if (dec.count !== 1) {
        throw new Error('NO_ITEM');
      }

      // Dá item do sender para receiver
      const existingForReceiver = await tx.inventoryItem.findFirst({
        where: { characterId: myCharacter.id, itemName: trade.offeredItemName },
      });
      if (existingForReceiver) {
        await tx.inventoryItem.update({
          where: { id: existingForReceiver.id },
          data: { quantity: { increment: 1 } },
        });
      } else {
        await tx.inventoryItem.create({
          data: { characterId: myCharacter.id, itemName: trade.offeredItemName, quantity: 1 },
        });
      }

      // Dá item do receiver para sender
      const existingForSender = await tx.inventoryItem.findFirst({
        where: { characterId: fromCharacter.id, itemName: trade.requestedItemName },
      });
      if (existingForSender) {
        await tx.inventoryItem.update({
          where: { id: existingForSender.id },
          data: { quantity: { increment: 1 } },
        });
      } else {
        await tx.inventoryItem.create({
          data: { characterId: fromCharacter.id, itemName: trade.requestedItemName, quantity: 1 },
        });
      }

      // (status já marcado como 'accepted' na trava de concorrência acima)
    });

    res.json({ success: true, message: `Troca concluída! Você recebeu "${trade.offeredItemName}".` });
  } catch (error) {
    if (error.message === 'TRADE_GONE') {
      return res.status(409).json({ error: 'Esta troca não está mais disponível.' });
    }
    if (error.message === 'NO_ITEM') {
      return res.status(400).json({ error: `Você não possui "${trade.requestedItemName}" para esta troca.` });
    }
    console.error('trade/accept:', error);
    res.status(500).json({ error: 'Erro ao aceitar troca.' });
  }
});

// POST /api/trade/:id/reject — Rejeitar/cancelar
router.post('/:id/reject', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const trade = await prisma.tradeOffer.findUnique({ where: { id } });

    if (!trade) return res.status(404).json({ error: 'Proposta não encontrada.' });

    const isParticipant = trade.fromUserId === req.userId || trade.toUserId === req.userId;
    if (!isParticipant) return res.status(403).json({ error: 'Acesso negado.' });
    if (trade.status !== 'pending') return res.status(400).json({ error: 'Troca já finalizada.' });

    // Devolve o item reservado ao sender
    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: trade.offeredItemInventoryId },
        data: { quantity: { increment: 1 } },
      }),
      prisma.tradeOffer.update({
        where: { id },
        data: { status: trade.fromUserId === req.userId ? 'canceled' : 'rejected' },
      }),
    ]);

    res.json({ success: true, message: 'Proposta cancelada. Item devolvido ao inventário.' });
  } catch (error) {
    console.error('trade/reject:', error);
    res.status(500).json({ error: 'Erro ao cancelar troca.' });
  }
});

// GET /api/trade/history — Histórico de trocas
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const trades = await prisma.tradeOffer.findMany({
      where: {
        OR: [{ fromUserId: req.userId }, { toUserId: req.userId }],
        status: { in: ['accepted', 'rejected', 'canceled', 'expired'] },
      },
      include: {
        fromUser: { select: { username: true } },
        toUser: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

export default router;
