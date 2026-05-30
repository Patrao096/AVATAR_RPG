// backend/src/lib/subscription-helper.js
// Helper para verificar se um userId tem assinatura premium ativa.
// Usado pra gatear features: história completa, mercado, batalhas ilimitadas.

import prisma from './prisma.js';

/**
 * Retorna true se o usuário tem uma assinatura ativa de premium.
 * Considera premium_user e premium_server como premium.
 */
export async function hasPremium(userId) {
  if (!userId) return false;
  try {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        planType: { in: ['premium_user', 'premium_server'] },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    return !!sub;
  } catch (e) {
    console.error('hasPremium error:', e);
    return false;
  }
}

/**
 * Retorna o tipo de plano ativo ('free', 'premium_user', 'premium_server').
 */
export async function getPlanType(userId) {
  if (!userId) return 'free';
  try {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return sub ? sub.planType : 'free';
  } catch (e) {
    return 'free';
  }
}
