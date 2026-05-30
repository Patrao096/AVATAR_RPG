import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { hasPremium } from '../lib/subscription-helper.js';
import { getPriceRange, findItemByName, getAllItems } from '../lib/items-lookup.js';

const router = express.Router();

// Usado por:
//   - TradeTab (selecionar item desejado em troca)
//   - Outras telas que precisam mostrar dropdown de itens
// Filtros opcionais:
//   ?element=Fogo   → apenas itens do elemento (mais Neutro)
//   ?type=weapon    → apenas itens do tipo
router.get('/items-catalog', async (req, res) => {
  try {
    const { element, type } = req.query;
    let items = getAllItems();
    if (element && element !== 'any') {
      items = items.filter(it => it.element === element || it.element === 'Neutro' || !it.element);
    }
    if (type) {
      items = items.filter(it => it.type === type);
    }
    const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    items.sort((a, b) => {
      if (a.element !== b.element) return (a.element || '').localeCompare(b.element || '');
      const ar = RARITY_RANK[a.rarity] || 0;
      const br = RARITY_RANK[b.rarity] || 0;
      if (ar !== br) return ar - br;
      return a.name.localeCompare(b.name);
    });
    res.json(items.map(it => ({
      id: it.id,
      name: it.name,
      type: it.type,
      element: it.element || 'Neutro',
      rarity: it.rarity || 'common',
      minLevel: it.minLevel || 1,
      stats: it.stats || {},
      price: it.price || 0,
    })));
  } catch (error) {
    console.error('market/items-catalog:', error);
    res.status(500).json({ error: 'Erro ao buscar catálogo' });
  }
});

router.get('/', async (req, res) => {
  try {
    const listings = await prisma.marketListing.findMany({
      include: { seller: { select: { username: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar mercado' });
  }
});

// GET /api/market/item-info/:name - info do item (preço base e faixa permitida)
// Usada pela UI para mostrar ao vendedor a faixa de preço permitida.
router.get('/item-info/:name', authMiddleware, async (req, res) => {
  const name = decodeURIComponent(req.params.name || '');
  const range = getPriceRange(name);
  const item  = findItemByName(name);
  res.json({
    name,
    basePrice: range.basePrice,
    minPrice: range.min,
    maxPrice: range.max,
    unknown: range.unknown,
    rarity: item?.rarity || null,
    type: item?.type || null,
  });
});

// POST /api/market/sell - anunciar item
router.post('/sell', authMiddleware, async (req, res) => {
  const { itemName, quantity, priceMoney } = req.body;

  if (!itemName || !quantity || !priceMoney || priceMoney <= 0) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  try {
    // ─── Bloqueio: plano free não vende ───
    const isPremium = await hasPremium(req.userId);
    if (!isPremium) {
      return res.status(403).json({
        error: 'Apenas usuários Premium podem vender no Mercado Negro.',
        requiresPremium: true,
      });
    }

    // ─── Validação de preço: entre 50% e 150% do preço-referência ───
    const range = getPriceRange(itemName);
    const price = parseInt(priceMoney);
    if (price < range.min || price > range.max) {
      return res.status(400).json({
        error: range.basePrice
          ? `Preço fora da faixa permitida para este item. Entre ${range.min} e ${range.max} Yuan (referência: ${range.basePrice}).`
          : `Preço fora da faixa permitida (${range.min}-${range.max} Yuan).`,
        minPrice: range.min,
        maxPrice: range.max,
        basePrice: range.basePrice,
      });
    }

    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const invItem = await prisma.inventoryItem.findFirst({
      where: { characterId: character.id, itemName },
    });

    if (!invItem || invItem.quantity < quantity) {
      return res.status(400).json({ error: 'Quantidade insuficiente no inventário' });
    }

    const [listing] = await prisma.$transaction([
      prisma.marketListing.create({
        data: {
          sellerId: req.userId,
          itemName,
          quantity: parseInt(quantity),
          priceMoney: price,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: invItem.id },
        data: { quantity: { decrement: parseInt(quantity) } },
      }),
    ]);

    res.json({ success: true, listing });
  } catch (error) {
    console.error('market/sell:', error);
    res.status(500).json({ error: 'Erro ao anunciar item' });
  }
});

// POST /api/market/buy - comprar item
router.post('/buy', authMiddleware, async (req, res) => {
  const { listingId } = req.body;

  try {
    // ─── Bloqueio: plano free não compra ───
    const isPremium = await hasPremium(req.userId);
    if (!isPremium) {
      return res.status(403).json({
        error: 'Apenas usuários Premium podem comprar no Mercado Negro.',
        requiresPremium: true,
      });
    }

    const listing = await prisma.marketListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) return res.status(404).json({ error: 'Anúncio não encontrado' });
    if (listing.sellerId === req.userId) {
      return res.status(400).json({ error: 'Você não pode comprar seu próprio item' });
    }

    const buyer = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!buyer) return res.status(404).json({ error: 'Personagem não encontrado' });

    if (buyer.money < listing.priceMoney) {
      return res.status(400).json({ error: 'Yuan insuficiente' });
    }

    const seller = await prisma.character.findUnique({ where: { userId: listing.sellerId } });

    await prisma.$transaction(async (tx) => {
      // O delete do anúncio é a trava de concorrência: se dois compram ao mesmo
      // tempo, só um remove a linha; o outro vê count 0 e aborta (sem dupe).
      const removed = await tx.marketListing.deleteMany({ where: { id: listingId } });
      if (removed.count !== 1) {
        throw new Error('LISTING_GONE');
      }

      // Débito condicional: só desconta se o saldo cobrir o preço (evita negativo).
      const debited = await tx.character.updateMany({
        where: { id: buyer.id, money: { gte: listing.priceMoney } },
        data: { money: { decrement: listing.priceMoney } },
      });
      if (debited.count !== 1) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      // Credita vendedor
      await tx.character.update({
        where: { id: seller.id },
        data: { money: { increment: listing.priceMoney } },
      });

      // Adiciona item ao inventário do comprador
      await tx.inventoryItem.create({
        data: {
          characterId: buyer.id,
          itemName: listing.itemName,
          quantity: listing.quantity,
        },
      });
    });

    res.json({ success: true, message: `Comprou ${listing.itemName} por ${listing.priceMoney} Yuan!` });
  } catch (error) {
    if (error.message === 'LISTING_GONE') {
      return res.status(409).json({ error: 'Este item acabou de ser vendido.' });
    }
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({ error: 'Yuan insuficiente' });
    }
    console.error('market/buy:', error);
    res.status(500).json({ error: 'Erro ao comprar item' });
  }
});

export default router;
