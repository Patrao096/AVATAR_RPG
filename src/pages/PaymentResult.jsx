// frontend/src/pages/PaymentResult.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const plan = params.get('plan');
  const item = params.get('item');

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="text-7xl mb-5">🎉</div>
        <h1 className="text-2xl font-bold mb-2 text-teal-400">Pagamento Aprovado!</h1>
        <p className="text-zinc-400 text-sm mb-2">
          {plan ? `Seu plano ${plan === 'premium_user' ? 'Premium Usuário' : 'Premium Servidor'} está ativo!` : ''}
          {item ? 'Seu item foi adicionado ao inventário!' : ''}
        </p>
        <p className="text-zinc-500 text-xs mb-8">
          Em caso de dúvidas, entre em contato pelo Discord do servidor.
        </p>
        <Link to="/profile"
          className="px-8 py-3 bg-gradient-to-r from-teal-400 to-cyan-400 text-zinc-900 font-bold rounded-xl hover:scale-105 transition-all inline-block">
          Ver meu Perfil
        </Link>
      </div>
    </div>
  );
}

export function PaymentFailed() {
  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="text-7xl mb-5">❌</div>
        <h1 className="text-2xl font-bold mb-2 text-red-400">Pagamento Recusado</h1>
        <p className="text-zinc-400 text-sm mb-8">
          O pagamento foi recusado ou cancelado. Nenhum valor foi cobrado.
          Tente novamente ou use outro método de pagamento.
        </p>
        <Link to="/plans"
          className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all inline-block">
          Tentar Novamente
        </Link>
      </div>
    </div>
  );
}

export function PaymentPending() {
  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <div className="text-7xl mb-5 animate-pulse">⏳</div>
        <h1 className="text-2xl font-bold mb-2 text-amber-400">Pagamento Pendente</h1>
        <p className="text-zinc-400 text-sm mb-2">
          Seu pagamento está sendo processado. Geralmente é confirmado em até 24h.
        </p>
        <p className="text-zinc-500 text-xs mb-8">
          Se pagou via boleto, o processamento pode levar até 3 dias úteis.
        </p>
        <Link to="/profile"
          className="px-8 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 text-zinc-900 font-bold rounded-xl hover:scale-105 transition-all inline-block">
          Ir para o Perfil
        </Link>
      </div>
    </div>
  );
}
