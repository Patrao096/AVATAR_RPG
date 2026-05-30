// backend/src/routes/payment.js
// Integração completa com Mercado Pago — Assinaturas + Loja
// Instalar: npm install mercadopago

import express from 'express';
import { MercadoPagoConfig, Preference, PreApproval, Payment } from 'mercadopago';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { PLANS, PAID_PLANS, serializePlan } from '../lib/plans.js';

const router = express.Router();

// ─── Cliente MP ───
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 },
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

export { PLANS };

// ─── Itens da loja real ───
export const STORE_ITEMS = [
  { id: 'yuan_500', name: '💰 500 Yuan', description: 'Pacote de 500 moedas Yuan para o jogo', priceCents: 490, rewardYuan: 500, rewardItem: null },
  { id: 'yuan_1500', name: '💰 1.500 Yuan', description: 'Pacote de 1.500 moedas Yuan (+200 bônus)', priceCents: 990, rewardYuan: 1700, rewardItem: null },
  { id: 'yuan_5000', name: '💎 5.000 Yuan', description: 'Pacote de 5.000 moedas Yuan (+1.000 bônus)', priceCents: 2490, rewardYuan: 6000, rewardItem: null },
  { id: 'skill_rare', name: '🌪️ Skill Rara: Tempestade Suprema', description: 'Skill rara exclusiva — dano 70-90, Chi: 30', priceCents: 990, rewardYuan: 0, rewardItem: 'Skill: Tempestade Suprema' },
  { id: 'skill_epic', name: '⚡ Skill Épica: Avatar State', description: 'A skill mais poderosa do jogo — dano 100-150, Chi: 50', priceCents: 2990, rewardYuan: 0, rewardItem: 'Skill: Avatar State' },
  { id: 'cosmetic_title', name: '🏅 Título: Mestre Dobrador', description: 'Título exclusivo exibido no seu perfil', priceCents: 490, rewardYuan: 0, rewardItem: 'Título: Mestre Dobrador' },
];

// GET /api/payment/plans — listar planos pagos
router.get('/plans', (req, res) => {
  res.json(PAID_PLANS.map(serializePlan));
});

// GET /api/payment/store — listar itens da loja
router.get('/store', (req, res) => {
  const items = STORE_ITEMS.map(i => ({
    ...i,
    priceDisplay: `R$ ${(i.priceCents / 100).toFixed(2).replace('.', ',')}`,
  }));
  res.json(items);
});

// POST /api/payment/subscription/create
// Cria link de assinatura recorrente no MP
router.post('/subscription/create', authMiddleware, async (req, res) => {
  const { planType } = req.body;
  const plan = PLANS[planType];

  if (!plan) return res.status(400).json({ error: 'Plano inválido' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { character: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Cria preapproval (assinatura recorrente) no Mercado Pago
    const preApproval = new PreApproval(mp);
    const response = await preApproval.create({
      body: {
        reason: plan.name,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.priceCents / 100,
          currency_id: 'BRL',
        },
        back_url: `${FRONTEND_URL}/payment/success?plan=${planType}`,
        payer_email: user.email || `${user.discordId}@discord.user`,
        external_reference: JSON.stringify({
          userId: req.userId,
          planType,
          type: 'subscription',
        }),
        status: 'pending',
      },
    });

    // Salva registro pendente no banco
    await prisma.subscription.create({
      data: {
        userId: req.userId,
        planType,
        status: 'pending',
        paymentId: response.id ? String(response.id) : null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      checkoutUrl: response.init_point,
      subscriptionId: response.id,
    });
  } catch (error) {
    console.error('subscription/create error:', error);
    res.status(500).json({ error: 'Erro ao criar assinatura', detail: error.message });
  }
});

// POST /api/payment/store/checkout
// Cria preferência de pagamento para item da loja
router.post('/store/checkout', authMiddleware, async (req, res) => {
  const { itemId } = req.body;
  const item = STORE_ITEMS.find(i => i.id === itemId);

  if (!item) return res.status(400).json({ error: 'Item não encontrado' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const preference = new Preference(mp);
    const response = await preference.create({
      body: {
        items: [
          {
            id: item.id,
            title: item.name,
            description: item.description,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: item.priceCents / 100,
          },
        ],
        payer: {
          email: user.email || `${user.discordId}@discord.user`,
        },
        payment_methods: {
          excluded_payment_types: [],
          installments: 1,
        },
        back_urls: {
          success: `${FRONTEND_URL}/payment/success?item=${itemId}`,
          failure: `${FRONTEND_URL}/payment/failed`,
          pending: `${FRONTEND_URL}/payment/pending`,
        },
        auto_return: 'approved',
        notification_url: `${BACKEND_URL}/api/payment/webhook`,
        external_reference: JSON.stringify({
          userId: req.userId,
          itemId,
          type: 'store',
        }),
        statement_descriptor: 'AVATAR RPG',
      },
    });

    res.json({
      checkoutUrl: response.init_point,
      sandboxUrl: response.sandbox_init_point,
      preferenceId: response.id,
    });
  } catch (error) {
    console.error('store/checkout error:', error);
    res.status(500).json({ error: 'Erro ao criar checkout', detail: error.message });
  }
});

// POST /api/payment/webhook
// Recebe notificações do Mercado Pago
// IMPORTANTE: Configurar no painel MP
router.post('/webhook', async (req, res) => {
  const { type, data, action } = req.body;

  console.log('📩 Webhook MP recebido:', { type, action, id: data?.id });

  // Responde 200 imediatamente para o MP não retentar
  res.sendStatus(200);

  try {
    // ─── Pagamento de loja aprovado ───
    if (type === 'payment') {
      const paymentApi = new Payment(mp);
      const payment = await paymentApi.get({ id: data.id });

      if (payment.status !== 'approved') return;

      const ref = JSON.parse(payment.external_reference || '{}');
      if (ref.type !== 'store' || !ref.userId || !ref.itemId) return;

      const item = STORE_ITEMS.find(i => i.id === ref.itemId);
      if (!item) return;

      const character = await prisma.character.findUnique({ where: { userId: ref.userId } });
      if (!character) return;

      // Concede recompensas em transação (Yuan + Item, se houver)
      const ops = [];
      if (item.rewardYuan > 0) {
        ops.push(prisma.character.update({
          where: { id: character.id },
          data: { money: { increment: item.rewardYuan } },
        }));
      }
      if (item.rewardItem) {
        ops.push(prisma.inventoryItem.create({
          data: {
            characterId: character.id,
            itemName: item.rewardItem,
            quantity: 1,
          },
        }));
      }
      if (ops.length > 0) await prisma.$transaction(ops);

      console.log(`✅ Compra concluída: ${item.name} para usuário ${ref.userId}`);
    }

    // ─── Assinatura criada/aprovada ───
    // Apenas eventos de preapproval. Antes, `action === 'updated'` também
    // disparava aqui e capturava webhooks de pagamento comum (data.id de
    // pagamento, não de preapproval), causando erros e re-extensões indevidas.
    if (type === 'subscription_preapproval') {
      const preApproval = new PreApproval(mp);
      const sub = await preApproval.get({ id: data.id });

      const ref = JSON.parse(sub.external_reference || '{}');
      if (!ref.userId || !ref.planType) return;

      const status = sub.status === 'authorized' ? 'active' : sub.status === 'cancelled' ? 'canceled' : 'pending';

      await prisma.subscription.updateMany({
        where: { paymentId: data.id },
        data: {
          status,
          expiresAt: status === 'active'
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : undefined,
        },
      });

      console.log(`🔄 Assinatura ${data.id} → ${status}`);
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
});

// GET /api/payment/subscription/status
// Status da assinatura do usuário logado
router.get('/subscription/status', authMiddleware, async (req, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) return res.json({ plan: 'free', active: false });

    const plan = PLANS[sub.planType];
    res.json({
      plan: sub.planType,
      active: true,
      expiresAt: sub.expiresAt,
      planName: plan?.name || sub.planType,
      priceDisplay: plan?.priceDisplay,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
});

// POST /api/payment/subscription/cancel
// Cancela assinatura ativa
router.post('/subscription/cancel', authMiddleware, async (req, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.userId, status: 'active' },
    });

    if (!sub) return res.status(404).json({ error: 'Nenhuma assinatura ativa' });

    // Cancela no MP se tiver paymentId
    if (sub.paymentId) {
      try {
        const preApproval = new PreApproval(mp);
        await preApproval.update({
          id: sub.paymentId,
          body: { status: 'cancelled' },
        });
      } catch (e) {
        console.warn('Não foi possível cancelar no MP:', e.message);
      }
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'canceled' },
    });

    res.json({ success: true, message: 'Assinatura cancelada com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar assinatura' });
  }
});

export default router;
