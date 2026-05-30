// backend/src/lib/plans.js
// Fonte única de verdade para planos de assinatura.
// Ambas as rotas (payment.js e subscription.js) importam daqui.

export const PLANS = {
  free: {
    id: 'free',
    name: 'Plano Free',
    priceCents: 0,
    get priceReal() { return 0; },
    get priceDisplay() { return 'R$ 0'; },
    benefits: [
      '8 batalhas por dia',
      '1 missão concluída por dia',
      '5 primeiros capítulos de história',
      '3 slots de skills equipadas',
      '2 slots de poções na arena',
      'Acesso ao Mercado Negro (leitura)',
      'Ranking global',
    ],
  },
  premium_user: {
    id: 'premium_user',
    name: 'Avatar RPG — Premium Usuário',
    priceCents: parseInt(process.env.PLAN_PREMIUM_USER_CENTS || '1990', 10),
    get priceReal() { return this.priceCents / 100; },
    get priceDisplay() {
      return `R$ ${(this.priceCents / 100).toFixed(2).replace('.', ',')}/mês`;
    },
    benefits: [
      'Batalhas ilimitadas',
      'Missões ilimitadas',
      'Até 5 missões ativas (vs 1 no Free)',
      '6 slots de skills equipadas (vs 3)',
      '4 slots de poções na arena (vs 2)',
      'Todos os 10 capítulos da história',
      'Acesso completo ao Mercado Negro',
      'Skills lendárias dos capítulos 6-10',
      'Bônus de +20% EXP e Yuan',
      'Badge Premium no perfil',
      'Suporte prioritário',
    ],
  },
  premium_server: {
    id: 'premium_server',
    name: 'Avatar RPG — Premium Servidor',
    priceCents: parseInt(process.env.PLAN_PREMIUM_SERVER_CENTS || '4990', 10),
    get priceReal() { return this.priceCents / 100; },
    get priceDisplay() {
      return `R$ ${(this.priceCents / 100).toFixed(2).replace('.', ',')}/mês`;
    },
    benefits: [
      'Todos os benefícios Premium para todos do servidor',
      'Canal exclusivo de batalhas no Discord',
      'Eventos especiais de clã semanais',
      'Personagem especial do servidor',
      'Dashboard personalizado para o servidor',
      'Comandos exclusivos de servidor',
      'Suporte VIP 24/7',
    ],
  },
};

export const PAID_PLANS = Object.values(PLANS).filter(p => p.priceCents > 0);

export function isPremium(planType) {
  return planType === 'premium_user' || planType === 'premium_server';
}

export function serializePlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    priceCents: plan.priceCents,
    priceReal: plan.priceReal,
    priceDisplay: plan.priceDisplay,
    benefits: plan.benefits,
  };
}
