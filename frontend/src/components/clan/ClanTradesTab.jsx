// frontend/src/components/clan/ClanTradesTab.jsx
// Tab de Trocas dentro de /clans (escambo múltiplo)

import { useState, useEffect, useCallback } from 'react';
import { authHeaders } from '../../App';

const API = window.__API_URL__ || 'http://localhost:5000';

const ELEM_COLOR = {
  Fogo: 'text-red-400', 'Água': 'text-blue-400', Terra: 'text-amber-500', Ar: 'text-slate-300', Neutro: 'text-zinc-400',
};
const ELEM_ICON = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️', Neutro: '⚪' };

export default function ClanTradesTab({ mine, onReload }) {
  const [view, setView] = useState('active');         // 'active' | 'history' | 'create'
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [actRes, histRes] = await Promise.all([
        fetch(`${API}/api/clan-trade/active`, { headers: authHeaders() }),
        fetch(`${API}/api/clan-trade/history`, { headers: authHeaders() }),
      ]);
      const actData = await actRes.json();
      const histData = await histRes.json();
      setActive(actData.trades || []);
      setHistory(histData.history || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 15_000);
    return () => clearInterval(id);
  }, [loadAll]);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <SubTab active={view === 'active'} onClick={() => setView('active')}
          label={`📋 Ativas${active.length > 0 ? ` (${active.length})` : ''}`} />
        <SubTab active={view === 'create'} onClick={() => setView('create')} label="+ Nova Troca" />
        <SubTab active={view === 'history'} onClick={() => setView('history')} label="📜 Histórico" />
      </div>

      {loading && <p className="text-zinc-500 text-sm py-4 text-center">Carregando...</p>}

      {!loading && view === 'active' && (
        <ActiveTradesList trades={active} onReload={() => { loadAll(); onReload?.(); }} />
      )}
      {!loading && view === 'create' && (
        <CreateTradeForm members={mine.clan.members} myUserId={mine.myUserId}
          onCreated={() => { loadAll(); setView('active'); }} />
      )}
      {!loading && view === 'history' && (
        <HistoryList history={history} />
      )}
    </div>
  );
}

function SubTab({ active, onClick, label }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border
        ${active
          ? 'bg-teal-400/15 text-teal-400 border-teal-400/25'
          : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'}`}>
      {label}
    </button>
  );
}

// LISTA DE TROCAS ATIVAS
function ActiveTradesList({ trades, onReload }) {
  if (trades.length === 0) {
    return (
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">🤝</div>
        <p className="text-zinc-500 text-sm">Nenhuma troca ativa no clã.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 stagger">
      {trades.map(t => <TradeCard key={t.id} trade={t} onReload={onReload} />)}
    </div>
  );
}

function TradeCard({ trade, onReload }) {
  const [busy, setBusy] = useState(false);
  const isMine = trade.isMine;
  const isForMe = trade.isForMe;
  const isOpen = trade.isOpen;

  const canAccept = !isMine && (isForMe || isOpen);
  const canCancel = isMine;
  const canReject = isForMe && !isOpen;

  const action = async (verb) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan-trade/${trade.id}/${verb}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) { if (data.message) alert(data.message); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  const expiresIn = Math.max(0, Math.floor((new Date(trade.expiresAt) - Date.now()) / (1000 * 60 * 60)));

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 lift relative overflow-hidden">
      {isMine && (
        <div className="absolute top-2 right-2 text-[9px] bg-teal-400/15 text-teal-400 border border-teal-400/25 px-1.5 py-0.5 rounded-full font-bold">
          MINHA
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <img src={trade.fromAvatar || 'https://via.placeholder.com/32'}
          className="w-9 h-9 rounded-full border border-white/10" alt="" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{trade.fromUsername}</div>
          <div className="text-[10px] text-zinc-500 font-mono">
            {isOpen ? '→ Aberta pro clã' : `→ Para ${trade.toUsername}`} · {expiresIn}h restantes
          </div>
        </div>
      </div>

      {trade.message && (
        <p className="text-xs italic text-zinc-400 mb-3 bg-zinc-800/50 rounded-lg p-2">"{trade.message}"</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-3">
        <ItemBlock title="🎁 Oferece" items={trade.offerItems} yuan={trade.offerYuan} color="teal" />
        <ItemBlock title="📥 Pede em troca" items={trade.requestItems} yuan={trade.requestYuan} color="amber" />
      </div>

      <div className="flex gap-2">
        {canAccept && (
          <button onClick={() => action('accept')} disabled={busy}
            className="flex-1 py-2 bg-teal-400 text-zinc-900 font-bold rounded-lg hover:bg-teal-300 disabled:opacity-40 text-sm">
            {busy ? '⏳' : '✓ Aceitar'}
          </button>
        )}
        {canReject && (
          <button onClick={() => action('reject')} disabled={busy}
            className="px-4 py-2 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg text-sm font-bold">
            ✕ Recusar
          </button>
        )}
        {canCancel && (
          <button onClick={() => action('cancel')} disabled={busy}
            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
            🗑️ Cancelar
          </button>
        )}
        {!canAccept && !canCancel && !canReject && (
          <div className="text-xs text-zinc-600 py-2 text-center w-full">Aguardando outro membro aceitar...</div>
        )}
      </div>
    </div>
  );
}

function ItemBlock({ title, items, yuan, color }) {
  const colorCls = {
    teal:  'border-teal-500/20 bg-teal-500/5',
    amber: 'border-amber-500/20 bg-amber-500/5',
  }[color];
  const empty = (!items || items.length === 0) && yuan === 0;
  return (
    <div className={`border rounded-xl p-3 ${colorCls}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-2">{title}</div>
      {empty && <div className="text-xs text-zinc-600 italic">Nada</div>}
      {items && items.length > 0 && (
        <div className="space-y-1">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="truncate">{it.itemName}</span>
              <span className="font-mono text-zinc-400 ml-2">×{it.qty}</span>
            </div>
          ))}
        </div>
      )}
      {yuan > 0 && (
        <div className="text-xs text-amber-400 font-mono mt-1">💰 {yuan} Yuan</div>
      )}
    </div>
  );
}

// CRIAR TROCA
function CreateTradeForm({ members, myUserId, onCreated }) {
  const [myInventory, setMyInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [offerItems, setOfferItems] = useState([]);     // [{itemName, qty}]
  const [offerYuan, setOfferYuan] = useState(0);
  const [requestItems, setRequestItems] = useState([]); // editáveis manualmente
  const [requestYuan, setRequestYuan] = useState(0);
  const [toUserId, setToUserId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API}/api/clan-trade/my-inventory`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setMyInventory(Array.isArray(data) ? data : []))
      .catch(() => setMyInventory([]))
      .finally(() => setLoading(false));
  }, []);

  const addOfferItem = (itemName) => {
    if (offerItems.find(o => o.itemName === itemName)) return;
    setOfferItems([...offerItems, { itemName, qty: 1 }]);
  };

  const updateOfferQty = (i, qty) => {
    const copy = [...offerItems];
    copy[i].qty = Math.max(1, parseInt(qty) || 1);
    setOfferItems(copy);
  };

  const removeOfferItem = (i) => setOfferItems(offerItems.filter((_, idx) => idx !== i));

  const addRequestItem = () => setRequestItems([...requestItems, { itemName: '', qty: 1 }]);
  const updateRequestItem = (i, field, val) => {
    const copy = [...requestItems];
    copy[i] = { ...copy[i], [field]: field === 'qty' ? Math.max(1, parseInt(val) || 1) : val };
    setRequestItems(copy);
  };
  const removeRequestItem = (i) => setRequestItems(requestItems.filter((_, idx) => idx !== i));

  const submit = async () => {
    // valida
    const cleanReq = requestItems.filter(r => r.itemName.trim());
    if (offerItems.length === 0 && offerYuan === 0) { alert('Ofereça pelo menos algo'); return; }
    if (cleanReq.length === 0 && requestYuan === 0) { alert('Peça pelo menos algo'); return; }

    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan-trade/create`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          offerItems, offerYuan, requestItems: cleanReq, requestYuan,
          toUserId: toUserId || null, message,
        }),
      });
      const data = await res.json();
      if (res.ok) { alert('🤝 Troca criada!'); onCreated?.(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  if (loading) return <p className="text-zinc-500 text-sm py-4 text-center">Carregando inventário...</p>;

  const otherMembers = members.filter(m => m.userId !== myUserId);

  return (
    <div className="bg-zinc-900 border border-teal-500/20 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-base">+ Nova Troca</h3>

      {/* OFFER */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-teal-300">🎁 O que você OFERECE</label>
        {offerItems.length > 0 && (
          <div className="space-y-1.5">
            {offerItems.map((it, i) => {
              const stock = myInventory.find(inv => inv.itemName === it.itemName);
              return (
                <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2">
                  <span className="text-xs flex-1 truncate">{it.itemName}</span>
                  <span className={`text-[10px] ${ELEM_COLOR[stock?.element || 'Neutro']}`}>
                    {ELEM_ICON[stock?.element || 'Neutro']} {stock?.element || 'Neutro'}
                  </span>
                  <input type="number" min="1" max={stock?.qty || 1} value={it.qty}
                    onChange={e => updateOfferQty(i, e.target.value)}
                    className="w-14 bg-zinc-900 border border-white/5 rounded px-2 py-1 text-xs text-center" />
                  <span className="text-[10px] text-zinc-500">/ {stock?.qty || 0}</span>
                  <button onClick={() => removeOfferItem(i)} className="text-red-400 text-xs px-2">✕</button>
                </div>
              );
            })}
          </div>
        )}
        {myInventory.length > 0 ? (
          <select value="" onChange={e => e.target.value && addOfferItem(e.target.value)}
            className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm">
            <option value="">+ Adicionar item do seu inventário...</option>
            {myInventory.filter(it => !offerItems.find(o => o.itemName === it.itemName)).map(it => (
              <option key={it.itemName} value={it.itemName}>
                {ELEM_ICON[it.element]} {it.itemName} (×{it.qty})
              </option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-zinc-600 italic">Seu inventário está vazio.</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">+ Yuan:</span>
          <input type="number" min="0" value={offerYuan}
            onChange={e => setOfferYuan(Math.max(0, parseInt(e.target.value) || 0))}
            className="flex-1 bg-zinc-800 border border-white/5 rounded-lg px-3 py-1.5 text-sm font-mono" />
        </div>
      </div>

      {/* REQUEST */}
      <div className="space-y-2 pt-3 border-t border-white/5">
        <label className="text-xs font-semibold text-amber-300">📥 O que você PEDE em troca</label>
        {requestItems.map((it, i) => (
          <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2">
            <input value={it.itemName}
              onChange={e => updateRequestItem(i, 'itemName', e.target.value)}
              placeholder="Nome do item..."
              className="flex-1 bg-zinc-900 border border-white/5 rounded px-2 py-1 text-xs" />
            <input type="number" min="1" value={it.qty}
              onChange={e => updateRequestItem(i, 'qty', e.target.value)}
              className="w-14 bg-zinc-900 border border-white/5 rounded px-2 py-1 text-xs text-center" />
            <button onClick={() => removeRequestItem(i)} className="text-red-400 text-xs px-2">✕</button>
          </div>
        ))}
        <button onClick={addRequestItem}
          className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400">
          + Adicionar item desejado
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">+ Yuan:</span>
          <input type="number" min="0" value={requestYuan}
            onChange={e => setRequestYuan(Math.max(0, parseInt(e.target.value) || 0))}
            className="flex-1 bg-zinc-800 border border-white/5 rounded-lg px-3 py-1.5 text-sm font-mono" />
        </div>
      </div>

      {/* DESTINATION + MESSAGE */}
      <div className="space-y-2 pt-3 border-t border-white/5">
        <label className="text-xs font-semibold text-zinc-400">🎯 Destinatário</label>
        <select value={toUserId} onChange={e => setToUserId(e.target.value)}
          className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm">
          <option value="">🌐 Aberta pro clã (qualquer um aceita)</option>
          {otherMembers.map(m => (
            <option key={m.userId} value={m.userId}>
              {ELEM_ICON[m.element || 'Neutro']} {m.username} (Lv {m.level})
            </option>
          ))}
        </select>
        <input value={message} maxLength={200}
          onChange={e => setMessage(e.target.value)}
          placeholder="Mensagem opcional (200 chars)..."
          className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm" />
      </div>

      <button onClick={submit} disabled={busy}
        className="w-full py-2.5 bg-teal-400 text-zinc-900 font-bold rounded-lg hover:bg-teal-300 disabled:opacity-40">
        {busy ? '⏳' : '🤝 Criar Troca'}
      </button>

      <p className="text-[10px] text-zinc-600 text-center">
        ⚠️ Receptor precisa ter o elemento + nível do item para aceitar (itens neutros: livre).
      </p>
    </div>
  );
}

// HISTÓRICO
function HistoryList({ history }) {
  if (history.length === 0) {
    return (
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">📜</div>
        <p className="text-zinc-500 text-sm">Sem histórico ainda.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 stagger">
      {history.map(t => (
        <div key={t.id} className="bg-zinc-900 border border-white/5 rounded-xl p-3 lift">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="font-semibold text-teal-300">{t.from}</span>
            <span className="text-zinc-600">→</span>
            <span className="font-semibold text-amber-300">{t.to}</span>
            <span className="text-zinc-600 ml-auto font-mono">
              {new Date(t.completedAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
            <div className="text-zinc-400">
              {t.offerItems.length > 0 && t.offerItems.map(it => `${it.itemName}×${it.qty}`).join(', ')}
              {t.offerYuan > 0 && (t.offerItems.length > 0 ? ' + ' : '') + `${t.offerYuan} Yuan`}
            </div>
            <div className="text-zinc-400">
              ↔ {t.requestItems.length > 0 && t.requestItems.map(it => `${it.itemName}×${it.qty}`).join(', ')}
              {t.requestYuan > 0 && (t.requestItems.length > 0 ? ' + ' : '') + `${t.requestYuan} Yuan`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
