// frontend/src/pages/Market.jsx
import { useState, useEffect } from 'react';
import { authHeaders } from '../App';
import { useToast } from '../components/Toast';

const API = window.__API_URL__ || 'http://localhost:5000';

export default function Market({ user }) {
  const { toast } = useToast();
  const [tab, setTab] = useState('buy');
  const [listings, setListings] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [itemRanges, setItemRanges] = useState({});
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const safeFetch = async (url, opts = {}) => {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [mkt, inv, limits] = await Promise.all([
        safeFetch(`${API}/api/market`),
        safeFetch(`${API}/api/inventory`, { headers: authHeaders() }),
        safeFetch(`${API}/api/battle/limits`, { headers: authHeaders() }),
      ]);
      setListings(Array.isArray(mkt) ? mkt : []);
      setInventory(Array.isArray(inv) ? inv : []);
      setIsPremium(!!limits?.isPremium);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (tab !== 'sell' || inventory.length === 0) return;
    (async () => {
      const ranges = {};
      await Promise.all(inventory.map(async item => {
        if (itemRanges[item.id]) { ranges[item.id] = itemRanges[item.id]; return; }
        const info = await safeFetch(
          `${API}/api/market/item-info/${encodeURIComponent(item.itemName)}`,
          { headers: authHeaders() }
        );
        if (info) ranges[item.id] = info;
      }));
      setItemRanges(prev => ({ ...prev, ...ranges }));
    })();
  }, [tab, inventory]);

  const buy = async (id) => {
    if (!isPremium) {
      toast.warning('Apenas usuários Premium podem comprar no Mercado Negro. Vá em /plans.');
      return;
    }
    const res = await fetch(`${API}/api/market/buy`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ listingId: id }),
    });
    const data = await res.json();
    if (res.ok) { toast.success(data.message); load(); }
    else toast.error(data.error);
  };

  const sell = async (item) => {
    if (!isPremium) {
      toast.warning('Apenas usuários Premium podem vender no Mercado Negro. Vá em /plans.');
      return;
    }
    const price = parseInt(prices[item.id]);
    const range = itemRanges[item.id];
    if (!price || price <= 0) { toast.error('Digite um preço válido!'); return; }
    if (range && (price < range.minPrice || price > range.maxPrice)) {
      toast.error(`Preço fora da faixa: ${range.minPrice}–${range.maxPrice} Yuan`);
      return;
    }
    const res = await fetch(`${API}/api/market/sell`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ itemName: item.itemName, quantity: 1, priceMoney: price }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`${item.itemName} anunciado!`);
      setPrices(p => ({ ...p, [item.id]: '' }));
      load();
    } else {
      toast.error(data.error);
    }
  };

  const TABS = [
    ['buy',   '🛒 Comprar'],
    ['sell',  '📦 Vender'],
    ['trade', '🔄 Trocar'],
    ['yuan',  '🏬 Loja Yuan'],
  ];

  if (loading) return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 flex items-center justify-center min-h-screen">
      <p className="text-zinc-500">Carregando mercado...</p>
    </div>
  );

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">🏪 Mercado Negro</h1>

        {!isPremium && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-5 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">💎</span>
              <div className="flex-1">
                <div className="text-purple-300 font-bold">Modo visualização (Free)</div>
                <p className="text-zinc-400 text-xs mt-1">
                  Você pode ver os anúncios, mas apenas usuários Premium podem <strong>comprar</strong> e <strong>vender</strong>.{' '}
                  <a href="/plans" className="text-teal-300 underline">Ver Planos →</a>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
          {TABS.map(([k, v]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex-shrink-0 transition-all
                ${tab === k ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white'}`}>
              {v}
            </button>
          ))}
        </div>

        {tab === 'buy' && (
          <div className="space-y-2 stagger">
            {listings.length === 0 && <p className="text-zinc-500 text-center py-10">Nenhum item à venda.</p>}
            {listings.map(item => (
              <div key={item.id} className="bg-zinc-900 border border-white/5 rounded-xl p-4 flex items-center gap-3 lift">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-xl flex-shrink-0">📦</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{item.itemName} ×{item.quantity}</div>
                  <div className="text-xs text-zinc-500">@{item.seller?.username}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-amber-400 font-mono">{item.priceMoney} Yuan</div>
                  <button onClick={() => buy(item.id)} disabled={!isPremium}
                    className={`mt-1 px-3 py-1 rounded-lg text-xs font-bold transition-all
                      ${isPremium
                        ? 'bg-teal-400 text-zinc-900 hover:bg-teal-300'
                        : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'}`}>
                    {isPremium ? 'Comprar' : '💎 Premium'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'sell' && <SellTab inventory={inventory} isPremium={isPremium} onSold={load} />}

        {tab === 'trade' && <TradeTab inventory={inventory} isPremium={isPremium} onTraded={load} />}

        {tab === 'yuan' && <YuanStoreSub />}
      </div>
    </div>
  );
}

function SellTab({ inventory, isPremium, onSold }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [price, setPrice] = useState('');
  const [range, setRange] = useState(null);
  const [busy, setBusy] = useState(false);

  const sellable = inventory.filter(i => i.quantity > 0 && !i.isEquipped && !i.isConsumableEquipped);
  const selectedItem = sellable.find(i => i.id === selectedId);

  // Quando muda item, busca a faixa de preço
  useEffect(() => {
    if (!selectedItem) { setRange(null); return; }
    let cancelled = false;
    fetch(`${API}/api/market/item-info/${encodeURIComponent(selectedItem.itemName)}`, {
      headers: authHeaders(),
    })
      .then(r => r.json())
      .then(info => { if (!cancelled) setRange(info); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedItem?.itemName]);

  const sell = async () => {
    if (!isPremium) {
      toast.warning('Apenas Premium pode anunciar no Mercado Negro.');
      return;
    }
    if (!selectedItem) { toast.error('Selecione um item.'); return; }
    const p = parseInt(price);
    if (!p || p <= 0) { toast.error('Digite um preço válido.'); return; }
    if (range && (p < range.minPrice || p > range.maxPrice)) {
      toast.error(`Preço fora da faixa: ${range.minPrice}–${range.maxPrice} Yuan`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/market/sell`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ itemName: selectedItem.itemName, quantity: 1, priceMoney: p }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${selectedItem.itemName} anunciado!`);
        setSelectedId(''); setPrice(''); setRange(null);
        onSold();
      } else toast.error(data.error);
    } finally { setBusy(false); }
  };

  if (sellable.length === 0) {
    return <p className="text-zinc-500 text-center py-10">Nenhum item disponível para venda. Itens equipados não podem ser vendidos.</p>;
  }

  const currentPrice = parseInt(price) || 0;
  const isValidPrice = range
    ? (currentPrice >= range.minPrice && currentPrice <= range.maxPrice)
    : currentPrice > 0;

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-red-500/20 rounded-xl p-4">
        <h3 className="font-bold text-sm text-red-300 mb-3">📦 Anunciar item</h3>

        {/* Dropdown de itens */}
        <label className="block text-xs text-zinc-400 mb-1">Item do inventário</label>
        <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setPrice(''); }}
          className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm mb-3">
          <option value="">— Selecione um item —</option>
          {sellable.map(item => (
            <option key={item.id} value={item.id}>
              {item.itemName} (×{item.quantity}) · {item.rarity || 'common'} · {item.element || 'Neutro'}
            </option>
          ))}
        </select>

        {selectedItem && (
          <>
            {/* Preview do item */}
            <div className="bg-zinc-800/50 rounded-lg p-3 mb-3 flex items-center gap-3">
              <div className="text-2xl">📦</div>
              <div className="flex-1">
                <div className="font-semibold text-sm">{selectedItem.itemName}</div>
                <div className="text-xs text-zinc-500">
                  {selectedItem.type || 'misc'} · {selectedItem.element || 'Neutro'} · ×{selectedItem.quantity} disponível
                </div>
                {selectedItem.stats && Object.keys(selectedItem.stats).length > 0 && (
                  <div className="text-xs text-zinc-400 mt-1">
                    {Object.entries(selectedItem.stats).map(([k, v]) => {
                      const icon = { attack: '⚔️', defense: '🛡️', chi: '💜', hp: '❤️' }[k] || k;
                      return <span key={k} className="mr-2">{icon} +{v}</span>;
                    })}
                  </div>
                )}
              </div>
              {range?.basePrice && (
                <div className="text-right">
                  <div className="text-[10px] text-zinc-500">Ref.</div>
                  <div className="text-amber-400 font-bold text-sm">{range.basePrice}Y</div>
                </div>
              )}
            </div>

            {/* Faixa permitida */}
            {range && (
              <div className="text-xs text-zinc-400 mb-2">
                Preço permitido: <span className="text-teal-400 font-bold">{range.minPrice}</span> a <span className="text-teal-400 font-bold">{range.maxPrice}</span> Yuan
              </div>
            )}

            {/* Input de preço */}
            <label className="block text-xs text-zinc-400 mb-1">Preço (Yuan)</label>
            <div className="flex gap-2">
              <input type="number" placeholder="0"
                min={range?.minPrice || 1} max={range?.maxPrice || 999999}
                value={price}
                onChange={e => setPrice(e.target.value)}
                className={`flex-1 bg-zinc-800 border rounded-lg px-3 py-2 text-sm
                  ${currentPrice > 0 && !isValidPrice ? 'border-red-500/50 text-red-300' : 'border-white/10 focus:border-teal-400 focus:outline-none'}`} />
              <button onClick={sell}
                disabled={!isPremium || !isValidPrice || busy}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all
                  ${isPremium && isValidPrice && !busy
                    ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                    : 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'}`}>
                {busy ? '⏳' : !isPremium ? '💎 Premium' : 'Anunciar'}
              </button>
            </div>
            {currentPrice > 0 && range && !isValidPrice && (
              <p className="text-xs text-red-400 mt-1">
                Fora da faixa permitida ({range.minPrice} - {range.maxPrice}).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TradeTab({ inventory, isPremium, onTraded }) {
  const { toast } = useToast();
  const [subtab, setSubtab] = useState('propose'); // propose | incoming | sent
  const [catalog, setCatalog] = useState([]);
  const [trades, setTrades] = useState({ incoming: [], sent: [] });
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searchingUser, setSearchingUser] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null); // { id, username, level, element }
  const [offeredItemId, setOfferedItemId] = useState('');
  const [requestedItemName, setRequestedItemName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const sellable = inventory.filter(i => i.quantity > 0 && !i.isEquipped && !i.isConsumableEquipped);

  useEffect(() => {
    fetch(`${API}/api/market/items-catalog`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setCatalog(d); })
      .catch(() => {});

    fetch(`${API}/api/trade`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => setTrades(d || { incoming: [], sent: [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTarget) return; // já escolheu, não buscar
    if (userSearch.trim().length < 2) {
      setUserResults([]);
      return;
    }
    setSearchingUser(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/trade/search-user?q=${encodeURIComponent(userSearch.trim())}`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setUserResults(Array.isArray(data) ? data : []);
        }
      } catch {}
      setSearchingUser(false);
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch, selectedTarget]);

  const propose = async () => {
    if (!isPremium) {
      toast.warning('Apenas Premium pode propor trocas no Mercado Negro.');
      return;
    }
    if (!selectedTarget) { toast.error('Busque e selecione o jogador alvo.'); return; }
    const offered = sellable.find(i => i.id === offeredItemId);
    if (!offered) { toast.error('Selecione um item para oferecer.'); return; }
    if (!requestedItemName) { toast.error('Selecione o item desejado em troca.'); return; }

    setBusy(true);
    try {
      const res = await fetch(`${API}/api/trade/propose`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          targetUserId: selectedTarget.id,
          offeredItemName: offered.itemName,
          requestedItemName,
          message,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setOfferedItemId('');
        setRequestedItemName('');
        setMessage('');
        setSelectedTarget(null);
        setUserSearch('');
        setUserResults([]);
        onTraded();
        fetch(`${API}/api/trade`, { headers: authHeaders() })
          .then(r => r.json()).then(d => setTrades(d || { incoming: [], sent: [] }));
      } else toast.error(data.error);
    } finally { setBusy(false); }
  };

  const respondTrade = async (id, action) => {
    const res = await fetch(`${API}/api/trade/${id}/${action}`, {
      method: 'POST', headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(data.message || 'Sucesso!');
      fetch(`${API}/api/trade`, { headers: authHeaders() })
        .then(r => r.json()).then(d => setTrades(d || { incoming: [], sent: [] }));
      onTraded();
    } else toast.error(data.error);
  };

  return (
    <div>
      <div className="bg-zinc-900 border border-purple-500/20 rounded-xl p-3 mb-4 text-xs text-zinc-300">
        🔄 Sistema de troca: você oferece um item do seu inventário e pede outro item específico em troca. O destinatário decide se aceita.
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setSubtab('propose')}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${subtab === 'propose' ? 'bg-purple-400/15 text-purple-300 border border-purple-400/30' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
          ✉️ Propor
        </button>
        <button onClick={() => setSubtab('incoming')}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${subtab === 'incoming' ? 'bg-purple-400/15 text-purple-300 border border-purple-400/30' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
          📥 Recebidas {trades.incoming?.length > 0 && `(${trades.incoming.length})`}
        </button>
        <button onClick={() => setSubtab('sent')}
          className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold ${subtab === 'sent' ? 'bg-purple-400/15 text-purple-300 border border-purple-400/30' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
          📤 Enviadas {trades.sent?.length > 0 && `(${trades.sent.length})`}
        </button>
      </div>

      {/* Propor troca */}
      {subtab === 'propose' && (
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 space-y-3">
          {}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Jogador alvo</label>
            {selectedTarget ? (
              <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  {selectedTarget.avatar && (
                    <img src={selectedTarget.avatar} alt="" className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <div className="text-sm font-bold text-purple-200">{selectedTarget.username}</div>
                    <div className="text-[10px] text-zinc-500">
                      Lv.{selectedTarget.level} {selectedTarget.element ? `· ${selectedTarget.element}` : ''}
                    </div>
                  </div>
                </div>
                <button onClick={() => { setSelectedTarget(null); setUserSearch(''); setUserResults([]); }}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input type="text" placeholder="Digite o nome do jogador (mín. 2 letras)..."
                  value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
                {searchingUser && (
                  <div className="absolute right-3 top-2 text-xs text-zinc-500">⏳</div>
                )}
                {userResults.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded-lg max-h-60 overflow-y-auto shadow-xl">
                    {userResults.map(u => (
                      <button key={u.id} onClick={() => { setSelectedTarget(u); setUserResults([]); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 text-left">
                        {u.avatar && <img src={u.avatar} alt="" className="w-8 h-8 rounded-full" />}
                        <div className="flex-1">
                          <div className="text-sm">{u.username}</div>
                          <div className="text-[10px] text-zinc-500">
                            Lv.{u.level} {u.element ? `· ${u.element}` : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {userSearch.length >= 2 && !searchingUser && userResults.length === 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-500">
                    Nenhum jogador encontrado.
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Item que você oferece</label>
            <select value={offeredItemId} onChange={e => setOfferedItemId(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="">— Selecione do seu inventário —</option>
              {sellable.map(item => (
                <option key={item.id} value={item.id}>
                  {item.itemName} (×{item.quantity}) · {item.rarity || 'common'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Item que você quer em troca</label>
            <select value={requestedItemName} onChange={e => setRequestedItemName(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm">
              <option value="">— Selecione do catálogo —</option>
              {catalog.length === 0 && <option disabled>Carregando catálogo...</option>}
              {catalog.map(item => (
                <option key={item.id} value={item.name}>
                  {item.name} · {item.element} · {item.rarity}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Mensagem (opcional)</label>
            <textarea placeholder="Olá! Tenho interesse..." rows="2" maxLength={200}
              value={message} onChange={e => setMessage(e.target.value)}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </div>

          <button onClick={propose} disabled={!isPremium || busy}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all
              ${isPremium && !busy
                ? 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}>
            {busy ? '⏳ Enviando...' : !isPremium ? '💎 Apenas Premium pode propor trocas' : '✉️ Enviar Proposta'}
          </button>
        </div>
      )}

      {/* Recebidas */}
      {subtab === 'incoming' && (
        <div className="space-y-2">
          {(!trades.incoming || trades.incoming.length === 0) && (
            <p className="text-zinc-500 text-center py-10">Nenhuma proposta recebida.</p>
          )}
          {trades.incoming?.map(t => (
            <div key={t.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
              <div className="text-xs text-zinc-500 mb-1">De: @{t.fromUser?.username || '?'}</div>
              <div className="text-sm flex items-center gap-2 flex-wrap">
                <span className="text-purple-300">📦 {t.offeredItemName}</span>
                <span className="text-zinc-500">↔</span>
                <span className="text-amber-300">🎯 {t.requestedItemName}</span>
              </div>
              {t.message && <div className="text-xs text-zinc-400 mt-2 italic">"{t.message}"</div>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => respondTrade(t.id, 'accept')}
                  className="flex-1 py-2 bg-teal-400/15 hover:bg-teal-400/25 text-teal-300 border border-teal-400/30 rounded-lg text-xs font-bold">
                  ✓ Aceitar
                </button>
                <button onClick={() => respondTrade(t.id, 'reject')}
                  className="flex-1 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-lg text-xs font-bold">
                  ✕ Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Enviadas */}
      {subtab === 'sent' && (
        <div className="space-y-2">
          {(!trades.sent || trades.sent.length === 0) && (
            <p className="text-zinc-500 text-center py-10">Nenhuma proposta enviada.</p>
          )}
          {trades.sent?.map(t => (
            <div key={t.id} className="bg-zinc-900 border border-white/10 rounded-xl p-4">
              <div className="text-xs text-zinc-500 mb-1">Para: @{t.toUser?.username || '?'}</div>
              <div className="text-sm flex items-center gap-2 flex-wrap">
                <span className="text-purple-300">📦 {t.offeredItemName}</span>
                <span className="text-zinc-500">↔</span>
                <span className="text-amber-300">🎯 {t.requestedItemName}</span>
              </div>
              <div className="text-xs mt-2">
                Status: <span className={t.status === 'pending' ? 'text-amber-300' : t.status === 'accepted' ? 'text-teal-400' : 'text-red-400'}>
                  {t.status === 'pending' ? '⏳ Aguardando' : t.status === 'accepted' ? '✓ Aceita' : '✕ Recusada'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function YuanStoreSub() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [quantities, setQuantities] = useState({});  // { dailyId: número }
  const [now, setNow] = useState(Date.now());

  // Tick do countdown a cada segundo
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/yuanstore/today`, { headers: authHeaders() });
      if (!res.ok) {
        setData({ error: true, products: [] });
        return;
      }
      const d = await res.json();
      setData(d);
    } catch {
      setData({ error: true, products: [] });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Auto-refresh quando o countdown chega a 0
  useEffect(() => {
    if (!data?.nextRefreshAt) return;
    const ms = new Date(data.nextRefreshAt).getTime() - now;
    if (ms <= 0) {
      // Pequeno delay para o backend processar a virada do dia
      setTimeout(load, 2000);
    }
  }, [data?.nextRefreshAt, now]);

  const setQty = (id, val) => {
    const v = Math.max(1, Math.min(10, parseInt(val, 10) || 1));
    setQuantities(prev => ({ ...prev, [id]: v }));
  };

  const buy = async (product) => {
    const qty = product.type === 'skill' ? 1 : (quantities[product.dailyId] || 1);
    const totalPrice = product.priceYuan * qty;
    if (!confirm(`Comprar ${qty}x ${product.name} por ${totalPrice} Yuan?`)) return;
    setBuying(product.dailyId);
    try {
      const res = await fetch(`${API}/api/yuanstore/buy-daily`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          dailyId: product.dailyId,
          type: product.type === 'skill' ? 'skill' : 'item',
          quantity: qty,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        load();
      } else {
        toast.error(result.error);
      }
    } finally { setBuying(null); }
  };

  // Formata countdown legível
  const formatCountdown = (ms) => {
    if (ms <= 0) return 'renovando…';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const RARITY_COLOR = {
    common: 'border-zinc-600/30 text-zinc-400',
    uncommon: 'border-teal-500/30 text-teal-400',
    rare: 'border-purple-500/30 text-purple-400',
    epic: 'border-amber-500/40 text-amber-400',
    legendary: 'border-yellow-400/60 text-yellow-300',
  };

  if (loading) return <p className="text-zinc-500 text-center py-10">Carregando loja diária...</p>;
  if (!data || data.error) return <p className="text-zinc-500 text-center py-10">Erro ao carregar loja diária. Tente novamente.</p>;

  const countdownMs = data.nextRefreshAt ? new Date(data.nextRefreshAt).getTime() - now : 0;
  const products = data.products || [];

  // Agrupa por categoria
  const skills    = products.filter(p => p.type === 'skill');
  const items     = products.filter(p => p.type !== 'skill' && p.type !== 'consumable');
  const potions   = products.filter(p => p.type === 'consumable');

  return (
    <div>
      {/* Header com data + countdown */}
      <div className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-amber-500/20 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              🏬 Loja Diária do Yuan
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                {data.date}
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              1 skill · 3 itens · 2 poções — sorteados todo dia à meia-noite UTC
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Próxima rotação</div>
            <div className="text-lg font-bold text-amber-300 font-mono">⏳ {formatCountdown(countdownMs)}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="text-xs text-zinc-500">Seu nível: <strong className="text-white">{data.characterLevel}</strong></div>
          <div className="text-base font-bold text-amber-400">💰 {data.characterMoney} Yuan</div>
        </div>
      </div>

      {products.length === 0 && (
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-8 text-center">
          <p className="text-zinc-500">Nenhum produto disponível hoje.</p>
        </div>
      )}

      {/* SKILL DO DIA */}
      {skills.length > 0 && (
        <>
          <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 mt-4">🎯 Skill do dia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {skills.map(p => <ProductCard key={p.dailyId} product={p} buying={buying} buy={buy} qty={1} setQty={setQty} rarityClass={RARITY_COLOR[p.rarity] || RARITY_COLOR.common} />)}
          </div>
        </>
      )}

      {/* ITENS DO DIA */}
      {items.length > 0 && (
        <>
          <h3 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2 mt-4">⚔️ Itens do dia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {items.map(p => <ProductCard key={p.dailyId} product={p} buying={buying} buy={buy} qty={quantities[p.dailyId] || 1} setQty={setQty} rarityClass={RARITY_COLOR[p.rarity] || RARITY_COLOR.common} />)}
          </div>
        </>
      )}

      {/* POÇÕES DO DIA */}
      {potions.length > 0 && (
        <>
          <h3 className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-2 mt-4">🧪 Poções do dia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {potions.map(p => <ProductCard key={p.dailyId} product={p} buying={buying} buy={buy} qty={quantities[p.dailyId] || 1} setQty={setQty} rarityClass={RARITY_COLOR[p.rarity] || RARITY_COLOR.common} />)}
          </div>
        </>
      )}
    </div>
  );
}

function ProductCard({ product, buying, buy, qty, setQty, rarityClass }) {
  const isSkill = product.type === 'skill';
  const isPotion = product.type === 'consumable';
  const totalPrice = product.priceYuan * (isSkill ? 1 : qty);
  const affordable = product.canAfford && totalPrice <= (product.canAfford ? Infinity : 0);
  const owned = isSkill && product.alreadyOwned;
  const meetsLevel = product.meetsLevel;
  const disabled = buying === product.dailyId || !meetsLevel || owned;

  return (
    <div className={`bg-zinc-900 border-2 rounded-xl p-4 transition-all ${rarityClass} ${owned ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="text-4xl">{product.icon || '📦'}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate flex items-center gap-2">
            {product.name}
            {isSkill && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">SKILL</span>}
            {isPotion && <span className="text-[9px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded">POÇÃO</span>}
            {owned && <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">JÁ TENHO</span>}
          </div>
          <div className="text-xs text-zinc-500 line-clamp-2 mt-1">{product.description}</div>
        </div>
      </div>

      {/* Skill info detalhada */}
      {isSkill && product.skillInfo && (
        <div className="bg-zinc-800/50 rounded-lg p-2 mb-3 text-xs">
          <div className="flex flex-wrap gap-3 text-zinc-400">
            <span>🎯 Dmg: <strong className="text-orange-400">{product.skillInfo.damage[0]}-{product.skillInfo.damage[1]}</strong></span>
            <span>💜 Chi: <strong className="text-purple-400">{product.skillInfo.chiCost}</strong></span>
            <span>⏱️ CD: <strong className="text-sky-400">{product.skillInfo.cooldown}t</strong></span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            💡 Após comprar, equipe em <strong>Perfil → Loadout</strong>
          </div>
        </div>
      )}

      {/* Stats de equipamento */}
      {!isSkill && product.stats && Object.keys(product.stats).length > 0 && (
        <div className="bg-zinc-800/50 rounded-lg p-2 mb-3 text-xs">
          <div className="flex flex-wrap gap-2 text-zinc-400">
            {Object.entries(product.stats).map(([k, v]) => {
              const icon = { attack: '⚔️', defense: '🛡️', chi: '💜', hp: '❤️' }[k] || k;
              return <span key={k}>{icon} +{v}</span>;
            })}
          </div>
          {isPotion && (
            <div className="mt-1 text-[10px] text-pink-300">
              🧪 Equipe em <strong>Perfil → Arena</strong> p/ usar em batalha
            </div>
          )}
        </div>
      )}

      {/* Efeito de poção */}
      {isPotion && product.effect && (
        <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-2 mb-3 text-xs text-pink-200">
          <strong>Efeito:</strong>{' '}
          {product.effect.type === 'heal' && `+${product.effect.value} HP`}
          {product.effect.type === 'restore_chi' && `+${product.effect.value} Chi`}
          {product.effect.type === 'heal_and_chi' && `+${product.effect.hp} HP, +${product.effect.chi} Chi`}
          {product.effect.type === 'buff_attack' && `+${product.effect.value} Atk por ${product.effect.duration} turnos`}
          {product.effect.type === 'buff_defense' && `+${product.effect.value} Def por ${product.effect.duration} turnos`}
        </div>
      )}

      {/* Quantidade (só para itens/poções) */}
      {!isSkill && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs text-zinc-500">Qtd:</label>
          <input type="number" min="1" max="10" value={qty}
            onChange={e => setQty(product.dailyId, e.target.value)}
            className="w-16 px-2 py-1 bg-zinc-800 border border-white/10 rounded text-xs"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-amber-400">💰 {totalPrice}</div>
          {!isSkill && qty > 1 && (
            <div className="text-[10px] text-zinc-500">{product.priceYuan} cada</div>
          )}
        </div>
        <button onClick={() => buy(product)}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all
            ${!disabled
              ? 'bg-teal-400 text-zinc-900 hover:bg-teal-300'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}>
          {buying === product.dailyId ? '⏳' :
           owned ? 'Já possuo' :
           !meetsLevel ? `Lv. ${product.minLevel}` :
           'Comprar'}
        </button>
      </div>
    </div>
  );
}