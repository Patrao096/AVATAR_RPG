// backend/src/routes/realstore.js
// Loja com rotação 24h, estoque limitado (50 por item) e compra com MP

import express from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// compatibilidade com Node 18+ (a sintaxe `with` só é estável a partir do 20.10)
const __dirname = dirname(fileURLToPath(import.meta.url));
const storePool = JSON.parse(
  readFileSync(join(__dirname, '../data/realstore_pool.json'), 'utf8')
);

const router = express.Router();
const ROTATION_HOURS = 24;
const ITEMS_PER_ROTATION = 12; // quantos itens aparecem por vez

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// ─── Pega ou cria rotação ativa ───
async function getActiveRotation() {
  let rotation = await prisma.storeRotation.findFirst({
    where: { expiresAt: { gt: new Date() } },
    include: { items: true },
  });

  if (!rotation) {
    rotation = await createNewRotation();
  }

  return rotation;
}

async function createNewRotation() {
  // Separa por tipo para garantir variedade
  const pool = storePool.pool;
  const legendary = pool.filter(i => i.rarity === 'legendary' && i.type !== 'yuan');
  const epic = pool.filter(i => i.rarity === 'epic' && i.type !== 'yuan');
  const rare = pool.filter(i => i.rarity === 'rare' && i.type !== 'yuan');
  const yuan = pool.filter(i => i.type === 'yuan');
  const cosmetic = pool.filter(i => i.type === 'cosmetic');

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Seleção: 3 lendárias + 3 épicas + 3 raras + yuan packages + 1 cosmético
  const selected = [
    ...shuffle(legendary).slice(0, 3),
    ...shuffle(epic).slice(0, 3),
    ...shuffle(rare).slice(0, 3),
    ...yuan,
    ...shuffle(cosmetic).slice(0, 1),
  ];

  const expiresAt = new Date(Date.now() + ROTATION_HOURS * 60 * 60 * 1000);

  const rotation = await prisma.storeRotation.create({
    data: {
      expiresAt,
      items: {
        create: selected.map(item => ({
          poolItemId: item.id,
          name: item.name,
          type: item.type,
          element: item.element || 'Neutro',
          rarity: item.rarity,
          priceCents: item.priceCents,
          totalStock: item.totalStock,
          soldCount: 0,
          itemId: item.itemId || item.skillId || null,
          rewardYuan: item.rewardYuan || 0,
          minLevel: item.minLevel || 1,
          description: item.description || '',
        })),
      },
    },
    include: { items: true },
  });

  console.log(`🔄 Nova rotação de loja criada. Expira em: ${expiresAt.toISOString()}`);
  return rotation;
}

// GET /api/realstore — Itens da rotação atual
router.get('/', async (req, res) => {
  try {
    const rotation = await getActiveRotation();

    const items = rotation.items.map(item => ({
      id: item.id,
      poolItemId: item.poolItemId,
      name: item.name,
      type: item.type,
      element: item.element,
      rarity: item.rarity,
      priceCents: item.priceCents,
      priceDisplay: `R$ ${(item.priceCents / 100).toFixed(2).replace('.', ',')}`,
      totalStock: item.totalStock,
      remaining: item.totalStock - item.soldCount,
      soldOut: item.soldCount >= item.totalStock,
      minLevel: item.minLevel,
      description: item.description,
      rewardYuan: item.rewardYuan,
    }));

    const timeLeft = Math.max(0, new Date(rotation.expiresAt) - new Date());
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    res.json({
      items,
      rotation: {
        expiresAt: rotation.expiresAt,
        timeLeft: `${hoursLeft}h ${minsLeft}min`,
      },
    });
  } catch (error) {
    console.error('realstore GET:', error);
    res.status(500).json({ error: 'Erro ao carregar loja.' });
  }
});

// POST /api/realstore/checkout — Inicia compra
router.post('/checkout', authMiddleware, async (req, res) => {
  const { storeItemId } = req.body;

  try {
    const rotation = await getActiveRotation();
    const storeItem = rotation.items.find(i => i.id === storeItemId);

    if (!storeItem) {
      return res.status(404).json({ error: 'Item não encontrado na loja atual.' });
    }
    if (storeItem.soldCount >= storeItem.totalStock) {
      return res.status(400).json({ error: 'Item esgotado! Aguarde a próxima rotação.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Verifica se o usuário já comprou este item nesta rotação
    const existingPurchase = await prisma.realStorePurchase.findFirst({
      where: { userId: req.userId, storeItemId: storeItem.id },
    });
    if (existingPurchase) {
      return res.status(400).json({ error: 'Você já comprou este item nesta rotação.' });
    }

    const preference = new Preference(mp);
    const mpResponse = await preference.create({
      body: {
        items: [{
          id: storeItem.poolItemId,
          title: storeItem.name.replace(/[^\w\s-]/g, '').trim() || 'Item Avatar RPG',
          description: storeItem.description,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: storeItem.priceCents / 100,
        }],
        payer: { email: user.email || `${user.discordId}@discord.avatar` },
        payment_methods: { installments: 1 },
        back_urls: {
          success: `${FRONTEND_URL}/payment/success?item=${storeItem.poolItemId}`,
          failure: `${FRONTEND_URL}/payment/failed`,
          pending: `${FRONTEND_URL}/payment/pending`,
        },
        auto_return: 'approved',
        notification_url: `${BACKEND_URL}/api/realstore/webhook`,
        external_reference: JSON.stringify({
          userId: req.userId,
          storeItemId: storeItem.id,
          poolItemId: storeItem.poolItemId,
          rotationId: rotation.id,
          type: 'realstore',
        }),
        statement_descriptor: 'AVATAR RPG',
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min
      },
    });

    res.json({
      checkoutUrl: mpResponse.init_point,
      sandboxUrl: mpResponse.sandbox_init_point,
      preferenceId: mpResponse.id,
      itemName: storeItem.name,
      remaining: storeItem.totalStock - storeItem.soldCount,
    });
  } catch (error) {
    console.error('realstore checkout:', error);
    res.status(500).json({ error: 'Erro ao criar checkout.', detail: error.message });
  }
});

// POST /api/realstore/webhook — Confirmação MP
router.post('/webhook', async (req, res) => {
  const { type, data } = req.body;
  res.sendStatus(200); // Responde imediatamente

  if (type !== 'payment') return;

  try {
    const { Payment } = await import('mercadopago');
    const paymentApi = new Payment(mp);
    const payment = await paymentApi.get({ id: data.id });

    if (payment.status !== 'approved') return;

    const ref = JSON.parse(payment.external_reference || '{}');
    if (ref.type !== 'realstore' || !ref.userId || !ref.storeItemId) return;

    // Usa transação para garantir atomicidade
    await prisma.$transaction(async (tx) => {
      // Idempotência: o MP reenvia webhooks. Se este paymentId já foi processado,
      // não entrega de novo (o @unique em paymentId também protege, mas aqui
      // evitamos o erro ruidoso de violação de constraint a cada retry).
      const already = await tx.realStorePurchase.findUnique({
        where: { paymentId: String(data.id) },
      });
      if (already) return;

      const storeItem = await tx.realStoreItem_rotation.findUnique({
        where: { id: ref.storeItemId },
      });
      if (!storeItem) return;
      if (storeItem.soldCount >= storeItem.totalStock) {
        console.warn(`⚠️ Item ${ref.storeItemId} esgotado mas pagamento aprovado — reembolso necessário`);
        return;
      }

      // Incrementa soldCount atomicamente
      await tx.realStoreItem_rotation.update({
        where: { id: ref.storeItemId },
        data: { soldCount: { increment: 1 } },
      });

      // Registra compra
      await tx.realStorePurchase.create({
        data: { userId: ref.userId, storeItemId: ref.storeItemId, paymentId: String(data.id) },
      });

      // Entrega recompensa
      const character = await tx.character.findUnique({ where: { userId: ref.userId } });
      if (!character) return;

      if (storeItem.rewardYuan > 0) {
        await tx.character.update({
          where: { id: character.id },
          data: { money: { increment: storeItem.rewardYuan } },
        });
      }

      if (storeItem.type === 'skill' || storeItem.type === 'item') {
        const itemName = storeItem.name.replace(/^[^\w\s]+\s*/, '');
        await tx.inventoryItem.create({
          data: { characterId: character.id, itemName, quantity: 1 },
        });
      }

      console.log(`✅ Loja real: ${storeItem.name} entregue para ${ref.userId}`);
    });
  } catch (error) {
    console.error('realstore webhook error:', error);
  }
});

export default router;
