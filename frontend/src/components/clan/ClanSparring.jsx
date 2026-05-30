// frontend/src/components/clan/ClanSparring.jsx
// Componentes de batalha amistosa entre membros do clã

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders } from '../../App';

const API = window.__API_URL__ || 'http://localhost:5000';

const ELEM_ICON = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' };

// Botão "⚔️ Desafiar" pra usar dentro do MembersTab
export function ChallengeButton({ memberUserId, memberUsername, onSent }) {
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!confirm(`Desafiar ${memberUsername} para uma batalha amistosa?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan-spar/challenge/${memberUserId}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); onSent?.(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };
  return (
    <button onClick={send} disabled={busy}
      title="Desafiar para batalha amistosa"
      className="px-2 py-1.5 bg-teal-500/15 text-teal-300 border border-teal-500/20 rounded-lg text-xs font-bold hover:bg-teal-500/25">
      {busy ? '⏳' : '⚔️'}
    </button>
  );
}

// Banner de "desafios recebidos" — mostra no topo da página de clã
export function PendingChallengesBanner({ onAccept }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(null);

  const loadPending = async () => {
    try {
      const res = await fetch(`${API}/api/clan-spar/pending`, { headers: authHeaders() });
      if (res.ok) setPending(await res.json());
    } catch {}
  };

  useEffect(() => {
    loadPending();
    const id = setInterval(loadPending, 10_000); // 10s polling
    return () => clearInterval(id);
  }, []);

  const accept = async (challenge) => {
    setBusy(challenge.id);
    try {
      const res = await fetch(`${API}/api/clan-spar/${challenge.id}/accept`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        // Salva os dados da batalha em sessionStorage e redireciona pra arena
        sessionStorage.setItem('pendingFriendlyBattle', JSON.stringify(data));
        onAccept?.();
        navigate('/arena');
      } else {
        alert(`❌ ${data.error}`);
        loadPending();
      }
    } finally { setBusy(null); }
  };

  const reject = async (id) => {
    setBusy(id);
    try {
      await fetch(`${API}/api/clan-spar/${id}/reject`, {
        method: 'POST', headers: authHeaders(),
      });
      loadPending();
    } finally { setBusy(null); }
  };

  if (pending.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-fuchsia-500/5 border border-purple-500/30 rounded-2xl p-4 mb-5 stagger">
      <div className="flex items-center gap-2 mb-3">
        <span className="live-dot" style={{ background: '#a855f7', boxShadow: '0 0 6px #a855f7' }}></span>
        <h3 className="text-sm font-bold text-purple-200">
          ⚔️ Desafio{pending.length > 1 ? 's' : ''} amistoso{pending.length > 1 ? 's' : ''} pendente{pending.length > 1 ? 's' : ''}
        </h3>
      </div>
      <div className="space-y-2">
        {pending.map(c => {
          const expIn = Math.max(0, Math.floor((new Date(c.expiresAt) - Date.now()) / 1000 / 60));
          return (
            <div key={c.id} className="bg-zinc-900 border border-white/5 rounded-xl p-3 flex items-center gap-3 lift">
              <img src={c.fromAvatar || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" alt="" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{c.fromUsername}</div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {ELEM_ICON[c.fromElement] || ''} Lv {c.fromLevel} · expira em {expIn}min
                </div>
              </div>
              <button onClick={() => accept(c)} disabled={busy === c.id}
                className="px-3 py-1.5 bg-teal-400 text-zinc-900 rounded-lg text-xs font-bold hover:bg-teal-300 disabled:opacity-40">
                {busy === c.id ? '⏳' : '⚔️ Aceitar'}
              </button>
              <button onClick={() => reject(c.id)} disabled={busy === c.id}
                className="px-3 py-1.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg text-xs">
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
