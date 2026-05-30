// frontend/src/pages/Store.jsx
import { useState, useEffect } from 'react';
import { authHeaders } from '../App';

const API = window.__API_URL__ || 'http://localhost:5000';

const RARITY = {
  yuan: { label: 'Yuan', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  rare: { label: 'Rara', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  epic: { label: 'Épica', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  cosmetic: { label: 'Cosmético', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
};

function getRarity(item) {
  if (item.rewardYuan > 0) return RARITY.yuan;
  if (item.id.includes('epic')) return RARITY.epic;
  if (item.id.includes('rare') || item.id.includes('skill')) return RARITY.rare;
  return RARITY.cosmetic;
}

export default function Store() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/payment/store`)
      .then(r => r.json()).then(setItems).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const buy = async (item) => {
    setBuying(item.id);
    try {
      const res = await fetch(`${API}/api/payment/store/checkout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`❌ ${data.error}`); return; }

      // Usar sandbox em dev, init_point em produção
      const url = window.__DEV__ ? data.sandboxUrl : data.checkoutUrl;
      window.location.href = url;
    } catch {
      alert('❌ Erro ao conectar com o servidor de pagamento.');
    } finally {
      setBuying(null);
    }
  };

  if (loading) return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 flex items-center justify-center min-h-screen">
      <p className="text-zinc-500">Carregando loja...</p>
    </div>
  );

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🏬 Loja Oficial</h1>
          <p className="text-zinc-400 text-sm">Adquira Yuan, Skills e itens exclusivos com dinheiro real</p>
        </div>

        {/* Pacotes de Yuan */}
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">💰 Pacotes de Yuan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {items.filter(i => i.rewardYuan > 0).map(item => {
            const rarity = getRarity(item);
            const isBonus = item.rewardYuan > item.priceCents / 4.9;
            return (
              <div key={item.id} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 relative">
                {isBonus && (
                  <div className="absolute -top-2 -right-2 bg-teal-400 text-zinc-900 text-xs font-bold px-2 py-0.5 rounded-full">
                    +BÔNUS
                  </div>
                )}
                <div className="text-4xl mb-3">💰</div>
                <div className="font-bold text-lg mb-1">{item.name}</div>
                <div className="text-zinc-400 text-sm mb-4">{item.description}</div>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-2xl text-yellow-400">{item.priceDisplay}</div>
                  <button onClick={() => buy(item)} disabled={buying === item.id}
                    className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-amber-400 text-zinc-900 font-bold rounded-xl text-sm hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100">
                    {buying === item.id ? '⏳' : 'Comprar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Skills e Cosméticos */}
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">⚡ Skills e Cosméticos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.filter(i => i.rewardYuan === 0).map(item => {
            const rarity = getRarity(item);
            return (
              <div key={item.id} className={`bg-zinc-900 border rounded-2xl p-5 ${
                item.id.includes('epic') ? 'border-amber-500/25' :
                item.id.includes('rare') || item.id.includes('skill') ? 'border-purple-500/25' :
                'border-sky-500/20'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold mb-1">{item.name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${rarity.color}`}>
                      {rarity.label}
                    </span>
                  </div>
                  <div className="text-2xl">{
                    item.id.includes('epic') ? '⚡' :
                    item.id.includes('rare') ? '🌪️' : '🏅'
                  }</div>
                </div>
                <p className="text-zinc-400 text-sm mb-4">{item.description}</p>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-xl text-white">{item.priceDisplay}</div>
                  <button onClick={() => buy(item)} disabled={buying === item.id}
                    className={`px-4 py-2 font-bold rounded-xl text-sm hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 ${
                      item.id.includes('epic')
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-zinc-900'
                        : item.id.includes('skill')
                        ? 'bg-gradient-to-r from-purple-500 to-violet-500 text-white'
                        : 'bg-gradient-to-r from-sky-400 to-cyan-400 text-zinc-900'
                    }`}>
                    {buying === item.id ? '⏳' : 'Comprar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer segurança */}
        <div className="mt-10 bg-zinc-900 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-zinc-500 text-sm mb-2">🔒 Pagamento 100% seguro via <strong className="text-[#00b1ea]">Mercado Pago</strong></p>
          <div className="flex items-center justify-center gap-6 text-zinc-600 text-xs">
            <span>💳 Cartão crédito/débito</span>
            <span>🏦 PIX</span>
            <span>📄 Boleto bancário</span>
          </div>
          <p className="text-zinc-600 text-xs mt-2">Itens são entregues automaticamente após confirmação do pagamento</p>
        </div>
      </div>
    </div>
  );
}
