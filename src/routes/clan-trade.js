// backend/src/routes/clan-trade.js
// Sistema de Trocas dentro do Clã (escambo múltiplo)
//   POST   /api/clan-trade/create        — criar oferta
//   POST   /api/clan-trade/:id/accept    — aceitar (valida elem/nível)
//   POST   /api/clan-trade/:id/reject    — recusar
//   POST   /api/clan-trade/:id/cancel    — emissor cancela
//   GET    /api/clan-trade/active        — minhas trocas ativas (criadas + recebidas + abertas do clã)
//   GET    /api/clan-trade/history       — últimas 30 concluídas no clã

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { findItemByName } from '../lib/items-lookup.js';

const router = express.Router();

const TRADE_EXPIRY_HOURS = 72;
const MAX_ITEMS_PER_SIDE = 5;
const MAX_HISTORY = 30;

// ─── Helpers ───
async function getMyMembership(userId) {
  return prisma.clanMember.findUnique({ where: { userId } });
}

function validateItemList(list, side) {
  if (!Array.isArray(list)) return `${side}: lista de itens inválida`;
  if (list.length === 0) return null; // OK ter zero itens (só Yuan)
  if (list.length > MAX_ITEMS_PER_SIDE) return `${side}: máximo ${MAX_ITEMS_PER_SIDE} itens`;
  for (const it of list) {
    if (!it.itemName || typeof it.itemName !== 'string') return `${side}: item sem nome`;
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 99) {
      return `${side}: qty deve ser 1-99 para "${it.itemName}"`;
    }
  }
  return null;
}

function canReceiveItem(itemName, character) {
  const lookup = findItemByName(itemName);
  if (!lookup) return { ok: true, reason: null }; // item desconhecido (consumível custom?), libera

  const itemElem = lookup.element || 'Neutro';
  if (itemElem === 'Neutro') return { ok: true, reason: null };

  if (!character.element) {
    return { ok: false, reason: `${itemName}: você ainda não escolheu elemento (faça o Capítulo 1)` };
  }
  if (character.element !== itemElem) {
    return { ok: false, reason: `${itemName} é de ${itemElem}, você é de ${character.element}` };
  }
  if (lookup.minLevel && character.level < lookup.minLevel) {
    return { ok: false, reason: `${itemName}: requer nível ${lookup.minLevel} (você é Lv ${character.level})` };
  }
  return { ok: true, reason: null };
}

async function hasItemsInInventory(characterId, list) {
  if (list.length === 0) return { ok: true, missing: [] };
  const inventory = await prisma.inventoryItem.findMany({
    where: { characterId },
  });
  const stock = {};
  inventory.forEach(it => {
    stock[it.itemName] = (stock[it.itemName] || 0) + it.quantity;
  });
  const missing = [];
  for (const it of list) {
    if ((stock[it.itemName] || 0) < it.qty) {
      missing.push(`${it.itemName} (tem ${stock[it.itemName] || 0}, precisa ${it.qty})`);
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Move N unidades de um item entre characters (deleta de A, soma em B).
 * Trabalha dentro de uma transaction.
 */
async function moveItem(tx, fromCharacterId, toCharacterId, itemName, qty) {
  // Pega entradas do remetente (pode ter empilhadas em múltiplas linhas)
  const sources = await tx.inventoryItem.findMany({
    where: { characterId: fromCharacterId, itemName },
    orderBy: { quantity: 'asc' },
  });
  let needed = qty;
  for (const src of sources) {
    if (needed <= 0) break;
    const take = Math.min(src.quantity, needed);
    const remaining = src.quantity - take;
    if (remaining === 0) {
      await tx.inventoryItem.delete({ where: { id: src.id } });
    } else {
      await tx.inventoryItem.update({
        where: { id: src.id },
        data: { quantity: remaining },
      });
    }
    needed -= take;
  }
  if (needed > 0) {
    throw new Error(`Estoque insuficiente de ${itemName}`);
  }

  // Empilha no destinatário (se já tiver linha do mesmo item, soma)
  const existing = await tx.inventoryItem.findFirst({
    where: { characterId: toCharacterId, itemName },
  });
  if (existing) {
    await tx.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: qty } },
    });
  } else {
    await tx.inventoryItem.create({
      data: { characterId: toCharacterId, itemName, quantity: qty },
    });
  }
}

// CRIAR TROCA
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    if (!member) return res.status(400).json({ error: 'Você não está em um clã' });

    const {
      offerItems = [],
      offerYuan = 0,
      requestItems = [],
      requestYuan = 0,
      toUserId = null,         // null = aberta pro clã
      message = '',
    } = req.body;

    // Validações estruturais
    const e1 = validateItemList(offerItems, 'Oferta');
    if (e1) return res.status(400).json({ error: e1 });
    const e2 = validateItemList(requestItems, 'Pedido');
    if (e2) return res.status(400).json({ error: e2 });

    if (offerItems.length === 0 && offerYuan === 0) {
      return res.status(400).json({ error: 'Você precisa oferecer pelo menos algo (item ou Yuan)' });
    }
    if (requestItems.length === 0 && requestYuan === 0) {
      return res.status(400).json({ error: 'Você precisa pedir pelo menos algo (item ou Yuan)' });
    }
    if (offerYuan < 0 || requestYuan < 0) return res.status(400).json({ error: 'Yuan não pode ser negativo' });

    // Se direcionada, valida que o destino é do mesmo clã
    if (toUserId) {
      if (toUserId === req.userId) return res.status(400).json({ error: 'Não pode trocar consigo mesmo' });
      const toMember = await prisma.clanMember.findUnique({ where: { userId: toUserId } });
      if (!toMember || toMember.clanId !== member.clanId) {
        return res.status(400).json({ error: 'Destinatário não está no seu clã' });
      }
    }

    // Confere que tenho os itens oferecidos no inventário
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const invCheck = await hasItemsInInventory(character.id, offerItems);
    if (!invCheck.ok) {
      return res.status(400).json({ error: `Faltando no inventário: ${invCheck.missing.join(', ')}` });
    }
    if (offerYuan > 0 && character.money < offerYuan) {
      return res.status(400).json({ error: `Yuan insuficiente (você tem ${character.money})` });
    }

    const expiresAt = new Date(Date.now() + TRADE_EXPIRY_HOURS * 60 * 60 * 1000);

    const trade = await prisma.clanTrade.create({
      data: {
        clanId: member.clanId,
        fromUserId: req.userId,
        toUserId: toUserId || null,
        offerItems,
        offerYuan,
        requestItems,
        requestYuan,
        message: message?.slice(0, 200) || null,
        expiresAt,
      },
    });

    res.json({ success: true, trade, message: '🤝 Troca criada!' });
  } catch (error) {
    console.error('clan-trade/create:', error);
    res.status(500).json({ error: 'Erro ao criar troca' });
  }
});

// ACEITAR TROCA
router.post('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const trade = await prisma.clanTrade.findUnique({ where: { id: req.params.id } });
    if (!trade) return res.status(404).json({ error: 'Troca não encontrada' });
    if (trade.status !== 'pending') return res.status(400).json({ error: 'Troca já encerrada' });
    if (trade.expiresAt < new Date()) {
      await prisma.clanTrade.update({ where: { id: trade.id }, data: { status: 'expired' } });
      return res.status(400).json({ error: 'Troca expirada' });
    }
    if (trade.fromUserId === req.userId) return res.status(400).json({ error: 'Você é o emissor' });

    // Sou do mesmo clã?
    const myMember = await getMyMembership(req.userId);
    if (!myMember || myMember.clanId !== trade.clanId) {
      return res.status(403).json({ error: 'Você não é deste clã' });
    }

    // Se direcionada, só o destinatário pode aceitar
    if (trade.toUserId && trade.toUserId !== req.userId) {
      return res.status(403).json({ error: 'Esta troca não é pra você' });
    }

    // Carrega chars de ambos
    const fromChar = await prisma.character.findUnique({ where: { userId: trade.fromUserId } });
    const myChar   = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!fromChar || !myChar) return res.status(404).json({ error: 'Personagem ausente' });

    // ─── Validação de elemento/nível ───
    // Eu (aceitante) vou RECEBER os offerItems → tenho que poder usá-los
    const blockedReceive = [];
    for (const it of trade.offerItems) {
      const check = canReceiveItem(it.itemName, myChar);
      if (!check.ok) blockedReceive.push(check.reason);
    }
    if (blockedReceive.length > 0) {
      return res.status(400).json({ error: `Você não pode receber: ${blockedReceive.join('; ')}` });
    }

    // Emissor vai RECEBER os requestItems → ele também tem que poder usá-los
    const blockedFor = [];
    for (const it of trade.requestItems) {
      const check = canReceiveItem(it.itemName, fromChar);
      if (!check.ok) blockedFor.push(`Emissor não pode receber ${check.reason}`);
    }
    if (blockedFor.length > 0) {
      return res.status(400).json({ error: blockedFor.join('; ') });
    }

    // Eu tenho os requestItems pra entregar?
    const myInvCheck = await hasItemsInInventory(myChar.id, trade.requestItems);
    if (!myInvCheck.ok) {
      return res.status(400).json({ error: `Você não tem: ${myInvCheck.missing.join(', ')}` });
    }
    if (trade.requestYuan > 0 && myChar.money < trade.requestYuan) {
      return res.status(400).json({ error: `Yuan insuficiente (você tem ${myChar.money})` });
    }

    // Emissor ainda tem os offerItems? (pode ter usado/vendido)
    const fromInvCheck = await hasItemsInInventory(fromChar.id, trade.offerItems);
    if (!fromInvCheck.ok) {
      await prisma.clanTrade.update({ where: { id: trade.id }, data: { status: 'cancelled' } });
      return res.status(400).json({ error: 'Emissor não tem mais os itens — troca cancelada' });
    }
    if (trade.offerYuan > 0 && fromChar.money < trade.offerYuan) {
      await prisma.clanTrade.update({ where: { id: trade.id }, data: { status: 'cancelled' } });
      return res.status(400).json({ error: 'Emissor não tem Yuan suficiente — troca cancelada' });
    }

    // ─── Executa transação ───
    await prisma.$transaction(async (tx) => {
      // Trava de concorrência: só prossegue se a troca ainda estiver pendente.
      // Em trocas abertas (toUserId null), dois membros podem clicar juntos;
      // só um vê count 1 e os itens/Yuan se movem uma única vez.
      const claimed = await tx.clanTrade.updateMany({
        where: { id: trade.id, status: 'pending' },
        data: { status: 'accepted', acceptedBy: req.userId, completedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new Error('TRADE_GONE');
      }
      // Move offerItems: from → me
      for (const it of trade.offerItems) {
        await moveItem(tx, fromChar.id, myChar.id, it.itemName, it.qty);
      }
      // Move requestItems: me → from
      for (const it of trade.requestItems) {
        await moveItem(tx, myChar.id, fromChar.id, it.itemName, it.qty);
      }
      // Yuan
      if (trade.offerYuan > 0) {
        await tx.character.update({ where: { id: fromChar.id }, data: { money: { decrement: trade.offerYuan } } });
        await tx.character.update({ where: { id: myChar.id },   data: { money: { increment: trade.offerYuan } } });
      }
      if (trade.requestYuan > 0) {
        await tx.character.update({ where: { id: myChar.id },   data: { money: { decrement: trade.requestYuan } } });
        await tx.character.update({ where: { id: fromChar.id }, data: { money: { increment: trade.requestYuan } } });
      }

      // (status já marcado como 'accepted' na trava de concorrência acima)
    });

    res.json({ success: true, message: '✓ Troca concluída!' });
  } catch (error) {
    if (error.message === 'TRADE_GONE') {
      return res.status(409).json({ error: 'Troca já encerrada' });
    }
    console.error('clan-trade/accept:', error);
    res.status(500).json({ error: error.message || 'Erro ao processar troca' });
  }
});

// REJEITAR / CANCELAR
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const trade = await prisma.clanTrade.findUnique({ where: { id: req.params.id } });
    if (!trade) return res.status(404).json({ error: 'Troca não encontrada' });
    if (trade.status !== 'pending') return res.status(400).json({ error: 'Já encerrada' });

    // Direcionada: só o destino rejeita. Aberta: ninguém "rejeita"
    if (trade.toUserId !== req.userId) return res.status(403).json({ error: 'Sem permissão' });

    await prisma.clanTrade.update({ where: { id: trade.id }, data: { status: 'rejected' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const trade = await prisma.clanTrade.findUnique({ where: { id: req.params.id } });
    if (!trade) return res.status(404).json({ error: 'Troca não encontrada' });
    if (trade.fromUserId !== req.userId) return res.status(403).json({ error: 'Apenas o emissor cancela' });
    if (trade.status !== 'pending') return res.status(400).json({ error: 'Já encerrada' });

    await prisma.clanTrade.update({ where: { id: trade.id }, data: { status: 'cancelled' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

// LISTAR TROCAS ATIVAS
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    if (!member) return res.json({ inClan: false, trades: [] });

    const trades = await prisma.clanTrade.findMany({
      where: {
        clanId: member.clanId,
        status: 'pending',
        expiresAt: { gt: new Date() },
        OR: [
          { fromUserId: req.userId },
          { toUserId: req.userId },
          { toUserId: null },              // abertas
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Hidrata com username dos envolvidos
    const userIds = new Set();
    trades.forEach(t => {
      userIds.add(t.fromUserId);
      if (t.toUserId) userIds.add(t.toUserId);
    });
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      include: { character: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    res.json({
      inClan: true,
      trades: trades.map(t => {
        const fromU = userMap[t.fromUserId];
        const toU = t.toUserId ? userMap[t.toUserId] : null;
        return {
          id: t.id,
          fromUserId: t.fromUserId,
          fromUsername: fromU?.username || '?',
          fromAvatar: fromU?.avatar || null,
          toUserId: t.toUserId,
          toUsername: toU?.username || null,
          isOpen: t.toUserId === null,
          isMine: t.fromUserId === req.userId,
          isForMe: t.toUserId === req.userId,
          offerItems: t.offerItems,
          offerYuan: t.offerYuan,
          requestItems: t.requestItems,
          requestYuan: t.requestYuan,
          message: t.message,
          expiresAt: t.expiresAt,
          createdAt: t.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error('clan-trade/active:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

// HISTÓRICO (últimas 30 concluídas)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    if (!member) return res.json({ inClan: false, history: [] });

    const trades = await prisma.clanTrade.findMany({
      where: {
        clanId: member.clanId,
        status: 'accepted',
      },
      orderBy: { completedAt: 'desc' },
      take: MAX_HISTORY,
    });

    const userIds = new Set();
    trades.forEach(t => {
      userIds.add(t.fromUserId);
      if (t.acceptedBy) userIds.add(t.acceptedBy);
    });
    const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } } });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    res.json({
      inClan: true,
      history: trades.map(t => ({
        id: t.id,
        from: userMap[t.fromUserId]?.username || '?',
        to: userMap[t.acceptedBy]?.username || '?',
        offerItems: t.offerItems,
        offerYuan: t.offerYuan,
        requestItems: t.requestItems,
        requestYuan: t.requestYuan,
        completedAt: t.completedAt,
      })),
    });
  } catch (error) {
    console.error('clan-trade/history:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

// LISTAR ITENS DO MEU INVENTÁRIO (para criar troca)
router.get('/my-inventory', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.json([]);

    const inventory = await prisma.inventoryItem.findMany({
      where: { characterId: character.id },
      orderBy: { itemName: 'asc' },
    });

    // Empilha quantidades por nome (caso esteja em múltiplas linhas)
    const stack = {};
    inventory.forEach(it => {
      stack[it.itemName] = (stack[it.itemName] || 0) + it.quantity;
    });

    res.json(Object.entries(stack).map(([itemName, qty]) => {
      const lookup = findItemByName(itemName);
      return {
        itemName,
        qty,
        element: lookup?.element || 'Neutro',
        minLevel: lookup?.minLevel || 1,
        type: lookup?.type || 'unknown',
        rarity: lookup?.rarity || 'common',
      };
    }));
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

export default router;
