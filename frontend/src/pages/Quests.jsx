// frontend/src/pages/Quests.jsx
//   - Mostra missões disponíveis (nada criado automaticamente)
//   - Usuário ACEITA uma missão; ela vira ativa por X horas
//   - Free: 1 missão ativa, 1 conclusão/dia
//   - Premium: 5 ativas, conclusões ilimitadas
//   - Timer de expiração visível
//   - Pode abandonar missão

import { useState, useEffect } from 'react';
import { authHeaders } from '../App';

const API = window.__API_URL__ || 'http://localhost:5000';

const TYPE_TAG = {
  battle:  ['Batalha',   'bg-orange-500/15 text-orange-400'],
  collect: ['Coletar',   'bg-teal-500/15 text-teal-400'],
  explore: ['Explorar',  'bg-sky-500/15 text-sky-400'],
  craft:   ['Crafting',  'bg-purple-500/15 text-purple-400'],
  story:   ['História',  'bg-amber-500/15 text-amber-400'],
};

function formatTimeRemaining(ms) {
  if (ms == null || ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function Quests() {
  const [tab, setTab] = useState('active');
  const [activeData, setActiveData] = useState({
    quests: [], isPremium: false, dailyLimit: 1, maxActive: 1,
    questsCompletedToday: 0, remainingDaily: 1,
  });
  const [boardData, setBoardData] = useState({
    quests: [], isPremium: false, maxActive: 1, activeCount: 0, slotsRemaining: 1,
  });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`${API}/api/quest/all`,   { headers: authHeaders() }).then(r => r.json()).catch(() => null),
        fetch(`${API}/api/quest/board`, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
      ]);
      if (a && Array.isArray(a.quests)) setActiveData(a);
      if (b && Array.isArray(b.quests)) setBoardData(b);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Atualiza relógio a cada 30s para o countdown rodar
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const complete = async (id) => {
    const res = await fetch(`${API}/api/quest/${id}/complete`, { method: 'POST', headers: authHeaders() });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ +${data.rewardExp} EXP · +${data.rewardYuan} Yuan${data.rewardItem ? ' · 🎁 ' + data.rewardItem : ''}!`);
      load();
    } else alert(data.error);
  };

  const accept = async (adminQuestId) => {
    const res = await fetch(`${API}/api/quest/accept/${adminQuestId}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ Missão aceita! ${data.message || ''}`);
      setTab('active');
      load();
    } else alert(`❌ ${data.error}`);
  };

  const abandon = async (id) => {
    if (!confirm('Tem certeza que quer abandonar esta missão?')) return;
    const res = await fetch(`${API}/api/quest/abandon/${id}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json();
    if (res.ok) load();
    else alert(`❌ ${data.error}`);
  };

  const { quests: active, isPremium, dailyLimit, maxActive, questsCompletedToday, remainingDaily } = activeData;
  const { quests: board, slotsRemaining } = boardData;

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">📜 Missões</h1>
        <p className="text-zinc-500 text-sm mb-4">
          {isPremium
            ? 'Plano Premium · até 5 missões ativas · conclusões ilimitadas'
            : `Plano Free · ${maxActive} missão ativa por vez · ${dailyLimit} conclusão/dia`}
        </p>

        {/* Status diário */}
        {!isPremium && (
          <div className="bg-zinc-900 border border-purple-500/20 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="text-xs text-zinc-300">
              📅 Hoje: <strong>{questsCompletedToday}/{dailyLimit}</strong> concluída(s) ·
              Restam <strong className="text-teal-400">{remainingDaily}</strong>
            </div>
            <a href="/plans" className="text-xs text-purple-300 hover:underline">Vire Premium →</a>
          </div>
        )}

        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab('active')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${tab === 'active' ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
            🎯 Ativas {active.length > 0 && <span className="ml-1 text-xs">({active.length}/{maxActive})</span>}
          </button>
          <button onClick={() => setTab('board')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${tab === 'board' ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
            📌 Mural {slotsRemaining != null && <span className="ml-1 text-xs">({slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''})</span>}
          </button>
        </div>

        {loading && <p className="text-zinc-500 text-center py-8">Carregando...</p>}

        {/* ─── Ativas ─── */}
        {!loading && tab === 'active' && (
          <div>
            {active.length === 0 && (
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-8 text-center">
                <p className="text-zinc-500">Nenhuma missão ativa no momento.</p>
                <p className="text-xs text-zinc-600 mt-2">Vá ao Mural para aceitar novas missões!</p>
                <button onClick={() => setTab('board')}
                  className="mt-4 px-4 py-2 bg-teal-400 text-zinc-900 font-bold rounded-lg text-sm">
                  Ir ao Mural →
                </button>
              </div>
            )}
            <div className="space-y-3 stagger">
              {active.map(q => {
                const [label, cls] = TYPE_TAG[q.type] || ['Missão', 'bg-zinc-700 text-zinc-300'];
                const pct = q.maxProgress > 0 ? Math.min(100, Math.round((q.progress / q.maxProgress) * 100)) : 0;
                const done = q.maxProgress > 0 && q.progress >= q.maxProgress;
                const remainingMs = q.expiresAt ? new Date(q.expiresAt).getTime() - now : null;
                const expired = remainingMs != null && remainingMs <= 0;
                const urgent = remainingMs != null && remainingMs > 0 && remainingMs < 2 * 60 * 60 * 1000;
                return (
                  <div key={q.id} className={`bg-zinc-900 border rounded-2xl p-5 transition-all lift relative overflow-hidden
                    ${done ? 'border-teal-500/30' : urgent ? 'border-amber-500/40' : 'border-white/5'}`}>
                    {urgent && !done && (
                      <div className="absolute -top-12 -right-12 w-32 h-32 pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)' }} />
                    )}
                    <div className="flex items-start justify-between gap-3 mb-3 relative">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold mb-1">{q.title}</div>
                        <div className="text-sm text-zinc-500">{q.description}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${cls}`}>{label}</span>
                    </div>

                    {/* Timer */}
                    {remainingMs != null && (
                      <div className={`text-xs mb-2 ${expired ? 'text-red-400' : urgent ? 'text-amber-300' : 'text-zinc-500'}`}>
                        {expired ? '⏰ Expirada' : `⏰ Restam ${formatTimeRemaining(remainingMs)}`}
                      </div>
                    )}

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1"><span>Progresso</span><span>{q.progress}/{q.maxProgress}</span></div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                        <span>⚡ +{q.rewardExp} EXP</span>
                        <span>💰 +{q.rewardYuan} Yuan</span>
                        {q.rewardItem && <span>🎁 {q.rewardItem}</span>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => abandon(q.id)}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all">
                          Abandonar
                        </button>
                        {done && !expired && (
                          <button onClick={() => complete(q.id)}
                            className="px-4 py-1.5 bg-teal-400 text-zinc-900 rounded-xl text-xs font-bold hover:bg-teal-300 transition-all">
                            Coletar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Mural ─── */}
        {!loading && tab === 'board' && (
          <div>
            {board.length === 0 && (
              <div className="bg-zinc-900 border border-white/5 rounded-xl p-8 text-center">
                <p className="text-zinc-500">Nenhuma missão disponível para o seu nível.</p>
                <p className="text-xs text-zinc-600 mt-2">O admin ainda não criou missões para a sua faixa de nível.</p>
              </div>
            )}
            <div className="space-y-3 stagger">
              {board.map(q => {
                const [label, cls] = TYPE_TAG[q.type] || ['Missão', 'bg-zinc-700 text-zinc-300'];
                const blocked = q.alreadyTaken || q.recentlyCompleted || slotsRemaining === 0;
                return (
                  <div key={q.id} className={`bg-zinc-900 border rounded-2xl p-5 transition-all ${!blocked ? 'lift' : ''}
                    ${q.alreadyTaken ? 'border-teal-500/20 opacity-60' : q.recentlyCompleted ? 'border-zinc-600/20 opacity-50' : 'border-white/5'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold">{q.title}</span>
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                            Lv {q.minLevel}-{q.maxLevel}
                          </span>
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                            ⏰ {q.durationHours}h p/ completar
                          </span>
                        </div>
                        <div className="text-sm text-zinc-500">{q.description}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${cls}`}>{label}</span>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                        <span>🎯 {q.maxProgress}x</span>
                        <span>⚡ +{q.rewardExp} EXP</span>
                        <span>💰 +{q.rewardYuan} Yuan</span>
                        {q.rewardItem && <span>🎁 {q.rewardItem}</span>}
                      </div>
                      {q.alreadyTaken ? (
                        <span className="text-xs bg-teal-500/15 text-teal-400 px-3 py-1.5 rounded-xl">Já aceita</span>
                      ) : q.recentlyCompleted ? (
                        <span className="text-xs bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-xl">Concluída há &lt; 24h</span>
                      ) : slotsRemaining === 0 ? (
                        <span className="text-xs bg-zinc-700 text-zinc-400 px-3 py-1.5 rounded-xl">Sem slots livres</span>
                      ) : (
                        <button onClick={() => accept(q.id)}
                          disabled={blocked}
                          className="px-4 py-1.5 bg-teal-400/15 text-teal-400 border border-teal-400/25 rounded-xl text-xs font-bold hover:bg-teal-400/25 transition-all">
                          Aceitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
