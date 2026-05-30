// frontend/src/pages/Plans.jsx
import { useState, useEffect } from 'react';
import { authHeaders } from '../App';

const API = window.__API_URL__ || 'http://localhost:5000';

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/payment/plans`).then(r => r.json()),
      fetch(`${API}/api/payment/subscription/status`, { headers: authHeaders() }).then(r => r.json()),
    ]).then(([p, s]) => {
      setPlans(p);
      setCurrentSub(s);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const subscribe = async (planId) => {
    setCheckingOut(planId);
    try {
      const res = await fetch(`${API}/api/payment/subscription/create`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planType: planId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`❌ ${data.error}`); return; }
      // Redireciona para o checkout do Mercado Pago
      window.location.href = data.checkoutUrl;
    } catch (e) {
      alert('❌ Erro ao conectar com o servidor de pagamento.');
    } finally {
      setCheckingOut(null);
    }
  };

  const cancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura?')) return;
    const res = await fetch(`${API}/api/payment/subscription/cancel`, {
      method: 'POST', headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok) { alert('✅ Assinatura cancelada.'); setCurrentSub({ plan: 'free', active: false }); }
    else alert(`❌ ${data.error}`);
  };

  if (loading) return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 flex items-center justify-center min-h-screen">
      <p className="text-zinc-500">Carregando planos...</p>
    </div>
  );

  const isActive = (planId) => currentSub?.active && currentSub?.plan === planId;

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">🌍 Planos Avatar RPG</h1>
          <p className="text-zinc-400">Escolha o plano ideal e domine o mundo dos Dobradores</p>
        </div>

        {/* Status atual */}
        {currentSub?.active && (
          <div className="bg-teal-500/10 border border-teal-500/25 rounded-2xl p-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <div>
                <span className="font-semibold text-teal-400">Plano ativo: {currentSub.planName}</span>
                {currentSub.expiresAt && (
                  <p className="text-xs text-zinc-500">Renova em {new Date(currentSub.expiresAt).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
            </div>
            <button onClick={cancel} className="text-xs text-red-400 hover:text-red-300 underline">Cancelar</button>
          </div>
        )}

        {/* Plano Free */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6">
            <div className="mb-4">
              <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded-full font-semibold">FREE</span>
            </div>
            <div className="text-3xl font-bold mb-1">R$ 0</div>
            <div className="text-zinc-500 text-sm mb-5">Para sempre</div>
            <ul className="space-y-2 mb-6">
              {[
                '8 batalhas por dia',
                '1 missão concluída por dia',
                '5 primeiros capítulos da história',
                '3 slots de skills equipadas',
                '2 slots de poções na arena',
                'Ranking global',
                'Mercado Negro (leitura)',
              ].map(b => (
                <li key={b} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-zinc-500 mt-0.5">✓</span>{b}
                </li>
              ))}
            </ul>
            <button disabled className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-xl font-semibold cursor-not-allowed text-sm">
              Plano Atual
            </button>
          </div>

          {/* Planos pagos */}
          {plans.map((plan, i) => (
            <div key={plan.id}
              className={`relative bg-zinc-900 border rounded-2xl p-6 ${i === 0 ? 'border-teal-500/40 shadow-lg shadow-teal-500/10' : 'border-amber-500/30 shadow-lg shadow-amber-500/10'}`}>

              {i === 0 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-teal-400 to-cyan-400 text-zinc-900 text-xs font-bold px-3 py-1 rounded-full">MAIS POPULAR</span>
                </div>
              )}

              <div className="mb-4">
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${i === 0 ? 'bg-teal-500/15 text-teal-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {i === 0 ? 'PREMIUM USUÁRIO' : 'PREMIUM SERVIDOR'}
                </span>
              </div>

              <div className="text-3xl font-bold mb-1">{plan.priceDisplay?.replace('/mês', '')}</div>
              <div className="text-zinc-500 text-sm mb-5">por mês • PIX ou cartão</div>

              <ul className="space-y-2 mb-6">
                {plan.benefits?.map(b => (
                  <li key={b} className={`flex items-start gap-2 text-sm ${i === 0 ? 'text-teal-100' : 'text-amber-100'}`}>
                    <span className={`mt-0.5 ${i === 0 ? 'text-teal-400' : 'text-amber-400'}`}>✓</span>{b}
                  </li>
                ))}
              </ul>

              {isActive(plan.id) ? (
                <div className="w-full py-3 text-center rounded-xl font-semibold text-sm border border-teal-500/30 text-teal-400 bg-teal-500/10">
                  ✓ Plano Ativo
                </div>
              ) : (
                <button
                  onClick={() => subscribe(plan.id)}
                  disabled={checkingOut === plan.id}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100
                    ${i === 0
                      ? 'bg-gradient-to-r from-teal-400 to-cyan-400 text-zinc-900 shadow-lg shadow-teal-500/25'
                      : 'bg-gradient-to-r from-amber-400 to-yellow-400 text-zinc-900 shadow-lg shadow-amber-500/25'}`}>
                  {checkingOut === plan.id ? '⏳ Redirecionando...' : `Assinar por ${plan.priceDisplay}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Seção MP */}
        <div className="mt-10 text-center">
          <div className="flex items-center justify-center gap-4 flex-wrap text-zinc-500 text-sm">
            <span>🔒 Pagamento seguro</span>
            <span>•</span>
            <span>💳 Cartão, PIX e boleto</span>
            <span>•</span>
            <span>🔄 Cancele quando quiser</span>
          </div>
          <p className="text-xs text-zinc-600 mt-3">Processado por <strong className="text-[#00b1ea]">Mercado Pago</strong> • Seus dados estão seguros</p>
        </div>
      </div>
    </div>
  );
}
