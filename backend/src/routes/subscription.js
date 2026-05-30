import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { PLANS, serializePlan, isPremium } from '../lib/plans.js';

const router = express.Router();

// Re-export para compatibilidade (se algo importar daqui)
export { PLANS };

router.get('/plans', (req, res) => {
  res.json(Object.values(PLANS).map(serializePlan));
});

// GET /api/subscription/mine
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: 'active',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    res.json(sub || { planType: 'free', status: 'active' });
  } catch (error) {
    console.error('subscription/mine:', error);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
});

// POST /api/subscription/activate — ativa plano (modo dev/simulado).
// Em produção, o fluxo real usa /api/payment/subscription/create com Mercado Pago.
router.post('/activate', authMiddleware, async (req, res) => {
  const { planType } = req.body;

  if (!PLANS[planType] || planType === 'free') {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  try {
    await prisma.subscription.updateMany({
      where: { userId: req.userId, status: 'active' },
      data: { status: 'canceled' },
    });

    const sub = await prisma.subscription.create({
      data: {
        userId: req.userId,
        planType,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ success: true, subscription: sub });
  } catch (error) {
    console.error('subscription/activate:', error);
    res.status(500).json({ error: 'Erro ao ativar assinatura' });
  }
});

// GET /api/subscription/check/:feature — verifica acesso a feature
router.get('/check/:feature', authMiddleware, async (req, res) => {
  const { feature } = req.params;

  try {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId: req.userId,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const plan = sub ? sub.planType : 'free';
    const premiumFeatures = ['unlimited_battles', 'all_chapters', 'black_market_sell', 'extra_quests'];
    const hasPremium = isPremium(plan);

    res.json({
      hasAccess: hasPremium || !premiumFeatures.includes(feature),
      plan,
    });
  } catch (error) {
    console.error('subscription/check:', error);
    res.status(500).json({ error: 'Erro ao verificar acesso' });
  }
});

export default router;
