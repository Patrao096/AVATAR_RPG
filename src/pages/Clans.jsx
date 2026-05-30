// frontend/src/pages/Clans.jsx
// Estrutura:
//   - Sem clã: Overview (lista de clãs + criar) + meus convites
//   - Com clã: Tabs (Visão/Membros/Chat/Baú/Convites/Configurações)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { authHeaders } from '../App';
import { useToast } from '../components/Toast';
import ClanTradesTab from '../components/clan/ClanTradesTab';
import { ChallengeButton, PendingChallengesBanner } from '../components/clan/ClanSparring';
import TrainingEmbed from './Training';

const API = window.__API_URL__ || 'http://localhost:5000';

const ELEMENTS = [
  { id: 'Fogo',  icon: '🔥', color: 'from-red-500/30 to-orange-500/30',     border: 'border-red-500/40',    text: 'text-red-400',    glow: 'rgba(239,68,68,0.25)' },
  { id: 'Água',  icon: '💧', color: 'from-blue-500/30 to-cyan-500/30',      border: 'border-blue-500/40',   text: 'text-blue-400',   glow: 'rgba(59,130,246,0.25)' },
  { id: 'Terra', icon: '🪨', color: 'from-amber-700/30 to-yellow-700/30',   border: 'border-amber-700/40',  text: 'text-amber-500',  glow: 'rgba(180,83,9,0.25)' },
  { id: 'Ar',    icon: '🌬️', color: 'from-slate-300/20 to-zinc-400/20',     border: 'border-slate-400/40',  text: 'text-slate-300',  glow: 'rgba(148,163,184,0.25)' },
];
const elemBy = (e) => ELEMENTS.find(x => x.id === e) || ELEMENTS[0];

const ROLE_BADGE = {
  owner:   { label: '👑 Dono',     cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  officer: { label: '⚔️ Officer',  cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  member:  { label: 'Membro',      cls: 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40' },
};

export default function Clans({ user }) {
  const navigate = useNavigate();
  const { id: routeClanId } = useParams();   // /clans/:id

  const [mine, setMine] = useState(null);
  const [allClans, setAllClans] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const loadAll = useCallback(async () => {
    try {
      const [mineRes, listRes, invRes] = await Promise.all([
        fetch(`${API}/api/clan/mine`, { headers: authHeaders() }),
        fetch(`${API}/api/clan`, { headers: authHeaders() }),
        fetch(`${API}/api/clan/invites`, { headers: authHeaders() }),
      ]);

      // /mine pode retornar { inClan: false } ou { inClan: true, clan: {...}, ... }
      // Se a chamada falhar, assumimos sem clã (em vez de quebrar a UI).
      let mineData = { inClan: false };
      if (mineRes.ok) {
        const parsed = await mineRes.json();
        if (parsed && typeof parsed === 'object' && !parsed.error) {
          mineData = parsed;
        }
      }
      setMine(mineData);

      const listData = listRes.ok ? await listRes.json() : [];
      setAllClans(Array.isArray(listData) ? listData : []);

      const invData = invRes.ok ? await invRes.json() : [];
      setInvites(Array.isArray(invData) ? invData : []);
    } catch (e) {
      console.error('clan loadAll:', e);
      // Defaults seguros para não quebrar a página
      setMine({ inClan: false });
      setAllClans([]);
      setInvites([]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) {
    return (
      <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 flex items-center justify-center min-h-screen">
        <div className="text-zinc-500">Carregando clãs...</div>
      </div>
    );
  }

  const inClan = mine?.inClan;
  const myClanId = inClan ? mine.clan.id : null;

  // ─── ROTA /clans/:id ───
  // Página detalhada do clã (com tabs: Visão, Chat, Trocas, Treino, Batalha, Gerenciar)
  if (routeClanId) {
    // Se o clã visualizado NÃO é o seu, redireciona pra lista
    if (!inClan || String(myClanId) !== String(routeClanId)) {
      return (
        <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
          <div className="max-w-3xl mx-auto px-4 py-6">
            <button onClick={() => navigate('/clans')}
              className="text-sm text-zinc-400 hover:text-white mb-3 flex items-center gap-1">
              ← Voltar à lista
            </button>
            <div className="bg-zinc-900 border border-amber-500/25 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-2">🚫</div>
              <h2 className="font-bold text-amber-300 mb-1">Acesso restrito</h2>
              <p className="text-sm text-zinc-400">
                {inClan
                  ? 'Este não é o seu clã. Apenas membros podem acessar a área interna.'
                  : 'Você precisa estar em um clã para acessar a página interna.'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // É o meu clã: mostra a página interna com as tabs
    const isOwner = mine.myRole === 'owner';

    return (
      <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 lg:py-6">

          <button onClick={() => navigate('/clans')}
            className="text-sm text-zinc-400 hover:text-white mb-3 flex items-center gap-1">
            ← Voltar à lista
          </button>

          <MyClanHero clan={mine.clan} myRole={mine.myRole} />

          {/* Tabs do clã */}
          <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
            {[
              ['overview', '🏛️ Visão'],
              ['chat',     '💬 Chat'],
              ['trades',   '🤝 Trocas'],
              ['treasury', '💰 Baú'],
              ['training', '🗺️ Treino'],
              ['war',      '⚔️ Batalha de Clãs'],
              ['manage',   isOwner ? '⚙️ Gerenciar' : null],
            ].filter(t => t[1]).map(([k, v]) => (
              <button key={k} onClick={() => setActiveTab(k)}
                className={`px-3 lg:px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0
                  ${activeTab === k
                    ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25'
                    : 'bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white'}`}>
                {v}
              </button>
            ))}
          </div>

          {/* Banner de desafios amistosos */}
          <PendingChallengesBanner onAccept={loadAll} />

          {/* Conteúdo das tabs */}
          {activeTab === 'overview' && (
            <>
              <OverviewTab mine={mine} onReload={loadAll} />
              <div className="mt-5">
                <MembersTab mine={{ ...mine, myUserId: user?.id }} onReload={loadAll} />
              </div>
            </>
          )}
          {activeTab === 'chat'     && <ChatTab clanId={mine.clan.id} userId={user?.id} />}
          {activeTab === 'trades'   && <ClanTradesTab mine={{ ...mine, myUserId: user?.id }} onReload={loadAll} />}
          {activeTab === 'treasury' && <TreasuryTab mine={mine} onReload={loadAll} />}
          {activeTab === 'training' && <TrainingEmbed user={user} embedded />}
          {activeTab === 'war'      && <ClanWarPlaceholder myClanId={myClanId} />}
          {activeTab === 'manage'   && isOwner && (
            <ManageTab mine={mine} onReload={loadAll} />
          )}
        </div>
      </div>
    );
  }

  // ─── ROTA /clans (LISTA) ───
  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 lg:py-6">

        {/* Hero / banner de "meu clã" */}
        {inClan ? (
          <MyClanShortcut clan={mine.clan} myRole={mine.myRole}
            onView={() => navigate(`/clans/${mine.clan.id}`)} />
        ) : (
          <NoClanHero invites={invites} />
        )}

        {/* Lista de clãs */}
        <ClanList clans={allClans} invites={invites} onReload={loadAll}
          myCharElement={mine.myCharacter?.element}
          myLevel={mine.myCharacter?.level}
          myMoney={mine.myCharacter?.money}
          clanCreation={mine.clanCreation}
          myClanId={myClanId} />
      </div>
    </div>
  );
}

// ATALHO PARA O MEU CLÃ (renderizado no topo da lista)
function MyClanShortcut({ clan, myRole, onView }) {
  const elem = elemBy(clan.element);
  const color = clan.bannerColor || '#2dd4bf';
  return (
    <div className="rounded-2xl p-5 mb-5 relative overflow-hidden border border-teal-500/30 lift cursor-pointer"
         style={{ background: `linear-gradient(135deg, ${color}26, ${color}08)` }}
         onClick={onView}>
      <div className="absolute -top-12 -right-12 w-48 h-48 pointer-events-none rounded-full"
           style={{ background: `radial-gradient(circle, ${elem.glow}, transparent 70%)` }} />
      <div className="relative flex items-center gap-4 flex-wrap">
        <div className="text-4xl">{elem.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] uppercase tracking-widest text-teal-300 font-bold">Seu clã</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ROLE_BADGE[myRole]?.cls}`}>
              {ROLE_BADGE[myRole]?.label}
            </span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight">{clan.name}</h2>
          {clan.motto && <p className="text-xs italic text-zinc-300">"{clan.motto}"</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400 font-mono">
            <span>⚡ Lv {clan.level}</span>
            <span>·</span>
            <span>👥 {clan.memberCount}/{clan.maxMembers}</span>
            <span>·</span>
            <span>💰 {clan.treasury.toLocaleString()}</span>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onView(); }}
          className="px-4 py-2.5 bg-teal-400 hover:bg-teal-300 text-zinc-900 font-bold rounded-xl text-sm">
          🏛️ Ver Clã →
        </button>
      </div>
    </div>
  );
}

// ABA "GERENCIAR" — junta Convites + Pedidos + Settings + Capacidade + Excluir
function ManageTab({ mine, onReload }) {
  const [section, setSection] = useState('settings');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {[
          ['settings', '⚙️ Geral'],
          ['invites',  '✉️ Convites & Pedidos'],
          ['expand',   '🏗️ Capacidade'],
          ['danger',   '🗑️ Excluir'],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setSection(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border
              ${section === k
                ? 'bg-amber-400/15 text-amber-300 border-amber-400/25'
                : 'bg-zinc-900 text-zinc-400 border-white/5 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {section === 'settings' && <SettingsTabGeneralOnly mine={mine} onReload={onReload} />}
      {section === 'invites'  && <InvitesTab onReload={onReload} />}
      {section === 'expand'   && <SettingsTabExpandOnly mine={mine} onReload={onReload} />}
      {section === 'danger'   && <SettingsTabDangerOnly mine={mine} onReload={onReload} />}
    </div>
  );
}

function ClanWarPlaceholder({ myClanId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [activeRes, histRes] = await Promise.all([
        fetch(`${API}/api/clan/war/active`),
        fetch(`${API}/api/clan/war/history`),
      ]);
      if (activeRes.ok) setData(await activeRes.json());
      if (histRes.ok) setHistory(await histRes.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  if (loading) {
    return <div className="bg-zinc-900 border border-white/5 rounded-2xl p-10 text-center text-zinc-500">Carregando evento...</div>;
  }

  const event = data?.active ? data.event : null;
  const lb = data?.leaderboard || [];
  const myRank = myClanId ? lb.findIndex(c => c.id === myClanId) : -1;
  const formatTimeLeft = (endsAt) => {
    if (!endsAt) return '';
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return 'encerrando…';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h >= 1)  return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (!event) {
    return (
      <div>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">⚔️</div>
          <h2 className="text-xl font-bold mb-2">Sem evento ativo</h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto">
            Quando o admin lançar um evento de Batalha de Clãs, ele aparece aqui com leaderboard ao vivo.
          </p>
        </div>
        {history.length > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">🏆 Eventos passados</h3>
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="bg-zinc-900 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{h.name}</div>
                    <div className="text-xs text-zinc-500">{new Date(h.endsAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Campeão</div>
                    <div className="text-sm font-bold text-amber-300">🏆 {h.championClanName || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header do evento */}
      <div className="bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-amber-400/30 rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full font-bold animate-pulse">
                ● AO VIVO
              </span>
              <span className="text-xs text-zinc-400">termina em {formatTimeLeft(event.endsAt)}</span>
            </div>
            <h2 className="text-xl font-bold">⚔️ {event.name}</h2>
            {event.description && <p className="text-xs text-zinc-300 mt-1 max-w-xl">{event.description}</p>}
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-3 gap-3 text-center text-xs">
          <div>
            <div className="text-zinc-500">Vitória</div>
            <div className="text-teal-300 font-bold">+10 pts</div>
          </div>
          <div>
            <div className="text-zinc-500">Derrota</div>
            <div className="text-amber-300 font-bold">+3 pts</div>
          </div>
          <div>
            <div className="text-zinc-500">Prêmio</div>
            <div className="text-purple-300 font-bold">50k Yuan + buff</div>
          </div>
        </div>
      </div>

      {/* Como participa */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 mb-4 text-xs text-zinc-400">
        <strong className="text-teal-300">Como participar:</strong> Vá pra Arena. Toda batalha PvP contra um membro de outro clã pontua automaticamente para o seu clã.
      </div>

      {/* Leaderboard */}
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">📊 Leaderboard</h3>
      {lb.length === 0 ? (
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-6 text-center text-zinc-500 text-sm">
          Nenhuma batalha entre clãs ainda. Seja o primeiro!
        </div>
      ) : (
        <div className="space-y-2">
          {lb.map((c, i) => {
            const isMe = c.id === myClanId;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
            return (
              <div key={c.id}
                className={`bg-zinc-900 rounded-xl p-3 flex items-center gap-3 transition-all
                  ${isMe ? 'border-2 border-teal-400/50 shadow-lg shadow-teal-500/10' : 'border border-white/5'}`}>
                <div className="text-xl w-8 text-center font-mono">
                  {medal || `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="truncate">{c.name}</strong>
                    {isMe && <span className="text-[10px] bg-teal-400/20 text-teal-300 px-2 py-0.5 rounded-full">SEU CLÃ</span>}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {c.element} · {c.wins || 0}V {c.losses || 0}D
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-amber-300">{c.points} pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {myRank >= 0 && lb.length > 3 && (
        <div className="mt-3 text-xs text-zinc-500 text-center">
          Você está em <strong className="text-teal-300">#{myRank + 1}</strong> de {lb.length}
        </div>
      )}
    </div>
  );
}

// HERO: SEM CLÃ
function NoClanHero({ invites }) {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 lg:p-6 mb-5 relative overflow-hidden lift">
      <div className="absolute -top-20 -right-20 w-60 h-60 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.18), transparent 70%)' }} />
      <div className="relative">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-4xl">🏛️</div>
          <h1 className="text-2xl font-bold">Clãs do Reino</h1>
        </div>
        <p className="text-zinc-400 text-sm">
          Junte-se a uma irmandade ou crie a sua. Compartilhem baús, mensagens e batalhas.
        </p>
        {invites.length > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2">
            <span className="live-dot" style={{ background: '#a855f7', boxShadow: '0 0 6px #a855f7' }}></span>
            <span className="text-sm text-purple-200">Você tem <strong>{invites.length}</strong> convite{invites.length > 1 ? 's' : ''} pendente{invites.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// HERO: COM CLÃ — banner com cor + estandarte elemental
function MyClanHero({ clan, myRole }) {
  const elem = elemBy(clan.element);
  const color = clan.bannerColor || '#2dd4bf';

  return (
    <div className="rounded-2xl p-5 lg:p-7 mb-5 relative overflow-hidden border border-white/5 lift"
         style={{ background: `linear-gradient(135deg, ${color}26, ${color}08)` }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 40% at 100% 0%, ${elem.glow}, transparent 70%)` }} />
      {/* Estandarte SVG */}
      <div className="absolute top-0 right-4 lg:right-8 w-12 h-20 lg:w-16 lg:h-24 pointer-events-none">
        <svg viewBox="0 0 60 90" className="w-full h-full">
          <defs>
            <linearGradient id="banner" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={color} stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <path d="M5 0 L55 0 L55 70 L30 85 L5 70 Z" fill="url(#banner)" stroke={color} strokeWidth="1" />
          <text x="30" y="42" fontSize="22" textAnchor="middle" fill="white">{elem.icon}</text>
        </svg>
      </div>

      <div className="relative pr-16 lg:pr-20">
        <div className="flex items-center gap-3 flex-wrap mb-2">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{clan.name}</h1>
          <span className={`text-xs ${ROLE_BADGE[myRole]?.cls} px-2 py-0.5 rounded-full border font-bold`}>
            {ROLE_BADGE[myRole]?.label}
          </span>
          {}
          {Array.isArray(clan.championBadges) && clan.championBadges.length > 0 && (
            <span className="text-xs bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full border border-amber-400/40 font-bold"
                  title={clan.championBadges.map(b => b.eventName).join(', ')}>
              🏆 ×{clan.championBadges.length}
            </span>
          )}
        </div>
        {clan.motto && <p className="text-sm italic text-zinc-300 mb-3">"{clan.motto}"</p>}
        {clan.description && <p className="text-sm text-zinc-400 mb-4">{clan.description}</p>}

        {}
        {clan.activeBuff && (
          <div className="mb-3 inline-flex items-center gap-2 bg-purple-500/15 border border-purple-400/30 text-purple-200 text-xs px-3 py-1.5 rounded-full">
            <span>✨</span>
            <span>+{Math.round((clan.activeBuff.value || 0) * 100)}% EXP/Yuan</span>
            <span className="text-zinc-400">
              · termina em {(() => {
                const ms = new Date(clan.activeBuff.expiresAt).getTime() - Date.now();
                if (ms <= 0) return 'já';
                const d = Math.floor(ms / 86400000);
                const h = Math.floor((ms % 86400000) / 3600000);
                return d > 0 ? `${d}d ${h}h` : `${h}h`;
              })()}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon="⚡" value={clan.level} label="Nível" />
          <Stat icon="🏆" value={clan.wins} label="Vitórias" />
          <Stat icon="💰" value={clan.treasury.toLocaleString()} label="Baú" mono />
          <Stat icon="👥" value={`${clan.memberCount}/${clan.maxMembers}`} label="Membros" mono />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, mono }) {
  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-xl px-3 py-2 backdrop-blur-sm">
      <div className="flex items-baseline gap-1.5">
        <span className="text-base">{icon}</span>
        <span className={`text-lg font-bold ${mono ? 'font-mono' : ''}`}>{value}</span>
      </div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

// LISTA DE CLÃS (sem clã)
function ClanList({ clans, invites, onReload, myCharElement, myClanId, myLevel, myMoney, clanCreation }) {
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('level');

  const filtered = clans
    .filter(c => filter === 'all' || c.element === filter)
    .sort((a, b) => sortBy === 'level' ? b.level - a.level : b.memberCount - a.memberCount);

  return (
    <>
      {invites.length > 0 && (
        <div className="bg-purple-500/8 border border-purple-500/25 rounded-2xl p-4 mb-5 stagger">
          <h3 className="text-sm font-bold text-purple-200 mb-3 flex items-center gap-2">
            <span className="live-dot" style={{ background: '#a855f7', boxShadow: '0 0 6px #a855f7' }}></span>
            Convites pendentes
          </h3>
          <div className="space-y-2">
            {invites.map(inv => <InviteCard key={inv.id} invite={inv} onReload={onReload} />)}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition
              ${filter === 'all' ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
            Todos
          </button>
          {ELEMENTS.map(e => (
            <button key={e.id} onClick={() => setFilter(e.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border
                ${filter === e.id ? `${e.text} bg-zinc-800` : 'bg-zinc-900 text-zinc-400 border-white/5'}`}>
              {e.icon} {e.id}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-teal-400 text-zinc-900 font-bold rounded-xl hover:bg-teal-300 transition lift">
          + Criar Clã
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-10 text-center">
          <div className="text-4xl mb-2">🏛️</div>
          <p className="text-zinc-500">Nenhum clã encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
          {filtered.map(c => (
            <ClanCard 
              key={c.id} 
              clan={c} 
              onReload={onReload} 
              myCharElement={myCharElement} 
              isMine={String(c.id) === String(myClanId)} 
            />
          ))}
        </div>
      )}

      {showCreate && <CreateClanModal onClose={() => setShowCreate(false)} onReload={onReload}
        myElement={myCharElement} myLevel={myLevel} myMoney={myMoney} clanCreation={clanCreation} />}
    </>
  );
}

function ClanCard({ clan, onReload, myCharElement, isMine = false }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const elem = elemBy(clan.element);
  const color = clan.bannerColor || '#2dd4bf';
  const elementMatch = !myCharElement || myCharElement === clan.element;

  const join = async () => {
    setBusy(true);
    try {
      const isPrivate = clan.visibility === 'private';
      const message = isPrivate ? prompt('Mensagem ao dono (opcional):') : '';
      if (isPrivate && message === null) return;
      const res = await fetch(`${API}/api/clan/join`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ clanId: clan.id, message }),
      });
      const data = await res.json();
      if (res.ok) { alert(data.message || 'OK!'); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  return (
    <div className={`rounded-2xl p-4 border relative overflow-hidden lift bg-zinc-900
      ${isMine ? 'border-teal-500/40' : 'border-white/5'}`}>
      <div className="absolute -top-12 -right-12 w-32 h-32 pointer-events-none rounded-full"
        style={{ background: `radial-gradient(circle, ${color}40, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="text-2xl">{elem.icon}</div>
            <div>
              <div className="flex items-center gap-2">
                <div className="font-bold text-lg leading-tight">{clan.name}</div>
                {isMine && (
                  <span className="text-[9px] bg-teal-400/15 text-teal-300 border border-teal-400/25 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    Seu clã
                  </span>
                )}
              </div>
              {clan.motto && <div className="text-xs italic text-zinc-500">"{clan.motto}"</div>}
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
            ${clan.visibility === 'public'
              ? 'bg-teal-500/10 text-teal-300 border-teal-500/25'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/25'}`}>
            {clan.visibility === 'public' ? '🌐 Público' : '🔒 Privado'}
          </span>
        </div>
        {clan.description && <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{clan.description}</p>}
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-3 font-mono">
          <span>⚡ Nv {clan.level}</span>
          <span>🏆 {clan.wins} vit.</span>
          <span className={clan.isFull ? 'text-red-400' : ''}>👥 {clan.memberCount}/{clan.maxMembers}</span>
        </div>
        {!isMine && !elementMatch && (
          <p className="text-[10px] text-amber-300/80 mb-2">⚠️ Clã de {clan.element}, você é de {myCharElement}</p>
        )}
        {isMine ? (
          <button onClick={() => navigate(`/clans/${clan.id}`)}
            className="w-full py-2 rounded-xl text-sm font-bold bg-teal-400 text-zinc-900 hover:bg-teal-300 transition">
            🏛️ Ver Clã →
          </button>
        ) : (
          <button onClick={join} disabled={busy || clan.isFull}
            className={`w-full py-2 rounded-xl text-sm font-bold transition
              ${clan.isFull
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : clan.visibility === 'private'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25'
                  : 'bg-teal-400 text-zinc-900 hover:bg-teal-300'}`}>
            {busy ? '⏳' : clan.isFull ? 'Lotado' : clan.visibility === 'private' ? '🔒 Pedir entrada' : '➕ Entrar'}
          </button>
        )}
      </div>
    </div>
  );
}

function InviteCard({ invite, onReload }) {
  const [busy, setBusy] = useState(false);
  const elem = elemBy(invite.clan.element);

  const respond = async (accept) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan/invite/${invite.id}/${accept ? 'accept' : 'reject'}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) { if (accept) alert(data.message); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  const expSoon = new Date(invite.expiresAt) - Date.now() < 6 * 60 * 60 * 1000;

return (
    <div className="bg-zinc-900 border border-white/5 rounded-xl p-3 flex items-center gap-3 lift">
      <div className="text-2xl">{elem.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate">{invite.clan.name}</div>
        <div className="text-xs text-zinc-500">
          {invite.clan.memberCount}/{invite.clan.maxMembers} membros · {expSoon && <span className="text-amber-400">expira em breve</span>}
        </div>
      </div>
      <button onClick={() => respond(true)} disabled={busy}
        className="px-3 py-1.5 bg-teal-400 text-zinc-900 rounded-lg text-xs font-bold hover:bg-teal-300">
        ✓
      </button>
      <button onClick={() => respond(false)} disabled={busy}
        className="px-3 py-1.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold">
        ✕
      </button>
    </div>
  );
}

// MODAL: CRIAR CLÃ
function CreateClanModal({ onClose, onReload, myElement, myLevel, myMoney, clanCreation }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '', element: myElement || 'Fogo', description: '', motto: '',
    visibility: 'public', bannerColor: '#2dd4bf',
  });
  const [busy, setBusy] = useState(false);

  const FREE_LEVEL = clanCreation?.freeLevelThreshold ?? 50;
  const COST_BELOW = clanCreation?.costBelowThreshold ?? 150000;
  const isFree = (myLevel || 1) >= FREE_LEVEL;
  const cost = isFree ? 0 : COST_BELOW;
  const canAfford = isFree || (myMoney || 0) >= cost;

  const submit = async () => {
    if (!form.name) { toast.error('Nome obrigatório'); return; }
    if (!canAfford) {
      toast.warning(`Você precisa de ${cost.toLocaleString('pt-BR')} Yuan ou alcançar nível ${FREE_LEVEL} para criar um clã.`);
      return;
    }
    if (!isFree) {
      const ok = confirm(`Criar clã custará ${cost.toLocaleString('pt-BR')} Yuan. Confirmar?`);
      if (!ok) return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan/create`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); onReload(); onClose(); }
      else toast.error(data.error);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end lg:items-center justify-center p-0 lg:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-900 border border-teal-500/30 rounded-t-2xl lg:rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">🏛️ Criar Clã</h2>
        {isFree ? (
          <div className="text-xs bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-2 mb-4">
            <span className="text-teal-300 font-semibold">✨ Grátis</span>
            <span className="text-zinc-400"> · Você está no nível {myLevel} (≥{FREE_LEVEL})</span>
          </div>
        ) : (
          <div className="text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-amber-300 font-semibold">💰 {COST_BELOW.toLocaleString('pt-BR')} Yuan</span>
              <span className="text-zinc-500">Lvl {myLevel}/{FREE_LEVEL}</span>
            </div>
            <div className="text-zinc-400 mt-1">
              Atinja o nível {FREE_LEVEL} para criar grátis. Você tem{' '}
              <strong className={canAfford ? 'text-amber-300' : 'text-red-400'}>
                {(myMoney || 0).toLocaleString('pt-BR')} Yuan
              </strong>.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Field label="Nome do clã *">
            <input value={form.name} maxLength={24}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="3 a 24 caracteres"
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </Field>

          <Field label="Elemento *">
            <div className="grid grid-cols-4 gap-2">
              {ELEMENTS.map(e => (
                <button key={e.id} onClick={() => setForm({ ...form, element: e.id })}
                  className={`py-2 rounded-lg text-xs font-semibold transition border
                    ${form.element === e.id ? `${e.text} bg-zinc-800 border-current` : 'bg-zinc-800 text-zinc-500 border-white/5'}`}>
                  <div className="text-lg">{e.icon}</div>{e.id}
                </button>
              ))}
            </div>
            {myElement && form.element !== myElement && (
              <p className="text-xs text-amber-300 mt-1">⚠️ Você é de {myElement} — só pode criar clã do seu elemento.</p>
            )}
          </Field>

          <Field label="Lema (opcional)">
            <input value={form.motto} maxLength={60}
              onChange={e => setForm({ ...form, motto: e.target.value })}
              placeholder='"Honra acima de tudo"'
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm" />
          </Field>

          <Field label="Descrição (opcional)">
            <textarea value={form.description} rows={2} maxLength={200}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Visibilidade">
              <select value={form.visibility}
                onChange={e => setForm({ ...form, visibility: e.target.value })}
                className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm">
                <option value="public">🌐 Público (entrada livre)</option>
                <option value="private">🔒 Privado (com aprovação)</option>
              </select>
            </Field>
            <Field label="Cor do estandarte">
              <input type="color" value={form.bannerColor}
                onChange={e => setForm({ ...form, bannerColor: e.target.value })}
                className="w-full h-10 bg-zinc-800 border border-white/5 rounded-lg cursor-pointer" />
            </Field>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={busy}
              className="flex-1 py-2.5 bg-teal-400 text-zinc-900 font-bold rounded-lg hover:bg-teal-300 disabled:opacity-50">
              {busy ? '⏳ Criando...' : '✨ Criar (500 Yuan)'}
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><label className="text-xs text-zinc-500 mb-1 block">{label}</label>{children}</div>;
}

// TAB: VISÃO GERAL
function OverviewTab({ mine, onReload }) {
  const [busy, setBusy] = useState(false);
  const isOwner = mine.myRole === 'owner';

  const leave = async () => {
    if (!confirm('Sair do clã?')) return;
    setBusy(true);
    const res = await fetch(`${API}/api/clan/leave`, { method: 'POST', headers: authHeaders() });
    const data = await res.json();
    if (res.ok) { alert(data.message); onReload(); }
    else alert(`❌ ${data.error}`);
    setBusy(false);
  };

  const topContributors = [...mine.clan.members]
    .sort((a, b) => b.contributedYuan - a.contributedYuan)
    .slice(0, 3);

  return (
    <div className="space-y-4 stagger">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 lift">
          <h3 className="text-sm font-bold text-zinc-400 mb-3">🏆 Top Contribuidores</h3>
          {topContributors.length === 0 ? (
            <p className="text-xs text-zinc-600">Nenhum depósito ainda.</p>
          ) : (
            <div className="space-y-2">
              {topContributors.map((m, i) => (
                <div key={m.userId} className="flex items-center gap-3 text-sm">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                  <img src={m.avatar || 'https://via.placeholder.com/24'} className="w-6 h-6 rounded-full" alt="" />
                  <span className="flex-1 truncate">{m.username}</span>
                  <span className="text-amber-400 font-mono text-xs">{m.contributedYuan} Yuan</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 lift">
          <h3 className="text-sm font-bold text-zinc-400 mb-3">📊 Sua participação</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Função:</span><span className="font-semibold">{ROLE_BADGE[mine.myRole]?.label}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Você contribuiu:</span><span className="font-mono text-amber-400">{mine.myContribution} Yuan</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Seu nível:</span><span className="font-mono">{mine.myCharacter?.level || 1}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Seu Yuan:</span><span className="font-mono text-amber-400">{mine.myCharacter?.money || 0}</span></div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        {!isOwner && (
          <button onClick={leave} disabled={busy}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold">
            ← Sair do clã
          </button>
        )}
      </div>
    </div>
  );
}

// TAB: MEMBROS
function MembersTab({ mine, onReload }) {
  const [busy, setBusy] = useState(null);
  const myRole = mine.myRole;
  const canModerate = myRole === 'owner' || myRole === 'officer';

  const action = async (endpoint, msg, userId) => {
    if (!confirm(msg)) return;
    setBusy(userId);
    try {
      const res = await fetch(`${API}/api/clan/${endpoint}/${userId}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) { alert(data.message || '✓'); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2 stagger">
      {mine.clan.members.map(m => {
        const elem = elemBy(m.element);
        const isMe = m.userId === mine.myUserId;
        const canActOn = canModerate && m.role !== 'owner' && !isMe && (myRole === 'owner' || m.role === 'member');
        const canChallenge = !isMe; // qualquer membro pode desafiar qualquer outro

        return (
          <div key={m.userId} className="bg-zinc-900 border border-white/5 rounded-xl p-3 flex items-center gap-3 flex-wrap lift">
            <img src={m.avatar || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-xl" alt="" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm truncate">{m.username}</span>
                {isMe && <span className="text-[9px] bg-teal-400/15 text-teal-300 border border-teal-400/25 px-1.5 py-0.5 rounded-full">VOCÊ</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ROLE_BADGE[m.role].cls}`}>
                  {ROLE_BADGE[m.role].label}
                </span>
              </div>
              <div className="text-xs text-zinc-500 flex gap-2 mt-0.5 font-mono">
                <span>{elem.icon} {m.element || '—'}</span>
                <span>· Lv {m.level}</span>
                {m.contributedYuan > 0 && <span>· 💰 {m.contributedYuan}</span>}
              </div>
            </div>
            <div className="flex gap-1">
              {canChallenge && (
                <ChallengeButton memberUserId={m.userId} memberUsername={m.username} />
              )}
              {canActOn && (
                <>
                  {myRole === 'owner' && m.role === 'member' && (
                    <button onClick={() => action('promote', `Promover ${m.username} a officer?`, m.userId)} disabled={busy === m.userId}
                      title="Promover" className="px-2 py-1.5 bg-purple-500/15 text-purple-300 border border-purple-500/20 rounded-lg text-xs">
                      ⬆️
                    </button>
                  )}
                  {myRole === 'owner' && m.role === 'officer' && (
                    <button onClick={() => action('demote', `Rebaixar ${m.username}?`, m.userId)} disabled={busy === m.userId}
                      title="Rebaixar" className="px-2 py-1.5 bg-zinc-700 text-zinc-300 rounded-lg text-xs">
                      ⬇️
                    </button>
                  )}
                  <button onClick={() => action('kick', `Expulsar ${m.username}?`, m.userId)} disabled={busy === m.userId}
                    title="Expulsar" className="px-2 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/20 rounded-lg text-xs">
                    👢
                  </button>
                  {myRole === 'owner' && (
                    <button onClick={() => action('ban', `BANIR ${m.username}? (impede de voltar)`, m.userId)} disabled={busy === m.userId}
                      title="Banir" className="px-2 py-1.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg text-xs">
                      🔨
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// TAB: CHAT (polling 5s)
function ChatTab({ clanId, userId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const lastSinceRef = useRef(null);
  const scrollRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const url = lastSinceRef.current
        ? `${API}/api/clan/messages?since=${encodeURIComponent(lastSinceRef.current)}`
        : `${API}/api/clan/messages`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) return;
      const newMsgs = await res.json();
      if (newMsgs.length > 0) {
        setMessages(prev => {
          // Filtra duplicatas (caso a msg recém-enviada já tenha entrado)
          const ids = new Set(prev.map(m => m.id));
          const fresh = newMsgs.filter(m => !ids.has(m.id));
          if (fresh.length === 0) return prev;
          return [...prev, ...fresh];
        });
        lastSinceRef.current = newMsgs[newMsgs.length - 1].createdAt;
      }
    } catch (e) { /* silencioso */ }
  }, []);

  useEffect(() => {
    loadMessages();
    const id = setInterval(loadMessages, 5000);
    return () => clearInterval(id);
  }, [loadMessages]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/api/clan/messages`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        setText('');
        // Optimistic: add a mensagem direto e atualiza cursor
        setMessages(prev => [...prev, data]);
        lastSinceRef.current = data.createdAt;
      } else {
        alert(`❌ ${data.error}`);
      }
    } finally { setSending(false); }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl flex flex-col" style={{ height: 'min(70vh, 600px)' }}>
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <span className="live-dot"></span>
        <span className="text-xs font-semibold text-zinc-400">Chat ao vivo · atualiza a cada 5s</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-zinc-600 text-sm py-10">
            Nenhuma mensagem ainda. Comece a conversa! 💬
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const sameSender = prev && prev.userId === m.userId;
          return (
            <div key={m.id} className={`flex gap-2 ${m.isMine ? 'flex-row-reverse' : ''}`}>
              {!sameSender ? (
                <img src={m.avatar || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full flex-shrink-0" alt="" />
              ) : (
                <div className="w-8 flex-shrink-0" />
              )}
              <div className={`max-w-[75%] ${m.isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!sameSender && (
                  <div className={`text-xs mb-0.5 ${m.isMine ? 'text-teal-400 self-end' : 'text-zinc-400'}`}>
                    {m.isMine ? 'Você' : m.username}
                    <span className="text-zinc-600 ml-2 font-mono">{formatTime(m.createdAt)}</span>
                  </div>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm break-words
                  ${m.isMine
                    ? 'bg-teal-400/15 text-teal-100 border border-teal-400/20 rounded-br-md'
                    : 'bg-zinc-800 text-zinc-100 border border-white/5 rounded-bl-md'}`}>
                  {m.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-white/5">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            maxLength={500}
            placeholder="Digite uma mensagem..."
            className="flex-1 bg-zinc-800 border border-white/5 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-teal-400" />
          <button onClick={send} disabled={sending || !text.trim()}
            className="px-4 py-2 bg-teal-400 text-zinc-900 font-bold rounded-xl hover:bg-teal-300 disabled:opacity-40">
            {sending ? '⏳' : 'Enviar'}
          </button>
        </div>
        <div className="text-[10px] text-zinc-600 mt-1 text-right font-mono">{text.length}/500</div>
      </div>
    </div>
  );
}

// TAB: BAÚ DO TESOURO
function TreasuryTab({ mine, onReload }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('deposit');
  const isOwner = mine.myRole === 'owner';
  const myMoney = mine.myCharacter?.money || 0;
  const treasury = mine.clan.treasury;

  const submit = async () => {
    const n = parseInt(amount);
    if (!n || n <= 0) { alert('Valor inválido'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan/treasury/${tab}`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ amount: n }),
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); setAmount(''); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4 stagger">
      <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/25 rounded-2xl p-6 text-center relative overflow-hidden lift">
        <div className="absolute -top-10 -right-10 w-40 h-40 pointer-events-none rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.3), transparent 70%)' }} />
        <div className="text-5xl mb-2 relative">💰</div>
        <div className="text-4xl font-bold text-amber-400 font-mono relative">{treasury.toLocaleString()}</div>
        <div className="text-xs text-zinc-500 mt-1 relative">Yuan no baú do clã</div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('deposit')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition
              ${tab === 'deposit' ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-800 text-zinc-400'}`}>
            💎 Depositar
          </button>
          {isOwner && (
            <button onClick={() => setTab('withdraw')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition
                ${tab === 'withdraw' ? 'bg-amber-400/15 text-amber-400 border border-amber-400/25' : 'bg-zinc-800 text-zinc-400'}`}>
              🪙 Sacar
            </button>
          )}
        </div>

        <div className="text-xs text-zinc-500 mb-3">
          {tab === 'deposit'
            ? `Sua bolsa: ${myMoney.toLocaleString()} Yuan · O depósito conta para suas estatísticas.`
            : `Apenas o dono pode sacar. Disponível no baú: ${treasury.toLocaleString()} Yuan.`}
        </div>

        <div className="flex gap-2 mb-3">
          <input type="number" min="1" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-lg font-mono focus:outline-none focus:border-teal-400" />
          <button onClick={() => setAmount(String(tab === 'deposit' ? myMoney : treasury))}
            className="px-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs">
            Max
          </button>
        </div>

        <button onClick={submit} disabled={busy || !amount}
          className={`w-full py-3 rounded-xl font-bold text-sm transition disabled:opacity-40
            ${tab === 'deposit' ? 'bg-teal-400 text-zinc-900 hover:bg-teal-300' : 'bg-amber-400 text-zinc-900 hover:bg-amber-300'}`}>
          {busy ? '⏳ Processando...' : tab === 'deposit' ? '💎 Depositar' : '🪙 Sacar'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════���
// TAB: CONVITES (officer/owner)
function InvitesTab({ onReload }) {
  const [requests, setRequests] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [busy, setBusy] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/clan/requests`, { headers: authHeaders() });
      if (res.ok) setRequests(await res.json());
    } catch (e) {}
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  useEffect(() => {
    if (searchQ.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`${API}/api/clan/search-user?q=${encodeURIComponent(searchQ)}`, { headers: authHeaders() });
      if (res.ok) setSearchResults(await res.json());
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  const invite = async (userId, username) => {
    setBusy(userId);
    try {
      const res = await fetch(`${API}/api/clan/invite/${userId}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); setSearchQ(''); setSearchResults([]); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(null); }
  };

  const respondReq = async (id, approve) => {
    setBusy(id);
    try {
      const res = await fetch(`${API}/api/clan/request/${id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) { loadRequests(); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5 stagger">
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 lift">
        <h3 className="font-bold mb-2">🔍 Convidar usuário</h3>
        <p className="text-xs text-zinc-500 mb-3">Busque por username ou Discord ID. Convite expira em 48h.</p>
        <input value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Digite o nome ou ID..."
          className="w-full bg-zinc-800 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 mb-3" />
        {searchResults.length > 0 && (
          <div className="space-y-1.5">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-2.5">
                <img src={u.avatar || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{u.username}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    Lv {u.level} · {u.element || '—'} {u.inClan && '· já em clã'}
                  </div>
                </div>
                <button onClick={() => invite(u.id, u.username)} disabled={busy === u.id || u.inClan}
                  className="px-3 py-1.5 bg-teal-400 text-zinc-900 rounded-lg text-xs font-bold disabled:opacity-40">
                  {busy === u.id ? '⏳' : '✉️'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 lift">
        <h3 className="font-bold mb-3">📥 Pedidos pendentes ({requests.length})</h3>
        {requests.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum pedido. Clãs públicos não recebem pedidos.</p>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <div key={r.id} className="bg-zinc-800 rounded-xl p-3 flex items-start gap-3">
                <img src={r.avatar || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full flex-shrink-0" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{r.username}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">Lv {r.level} · {r.element || '—'}</div>
                  {r.message && <p className="text-xs text-zinc-400 mt-1 italic">"{r.message}"</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => respondReq(r.id, true)} disabled={busy === r.id}
                    className="px-3 py-1 bg-teal-400 text-zinc-900 rounded text-xs font-bold">✓</button>
                  <button onClick={() => respondReq(r.id, false)} disabled={busy === r.id}
                    className="px-3 py-1 bg-red-500/15 text-red-400 border border-red-500/20 rounded text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// TAB: CONFIGURAÇÕES (owner)
// SETTINGS — split em 3 sub-componentes para a aba "Gerenciar"

// Hook compartilhado de save/expand/delete
function useSettingsActions(mine, onReload) {
  const c = mine.clan;
  const [busy, setBusy] = useState(false);

  const saveSettings = async (form) => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan/settings`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { alert('✓ Configurações salvas'); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  const expandTo = async (tierIndex) => {
    const tier = mine.capacityTiers[tierIndex];
    if (!confirm(`Expandir capacidade para ${tier.max} membros? Custo: ${tier.cost.toLocaleString()} Yuan do baú.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan/expand`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ tierIndex }),
      });
      const data = await res.json();
      if (res.ok) { alert(data.message); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  const deleteClan = async () => {
    const name = prompt(`Para excluir o clã, digite o nome exato: "${c.name}"`);
    if (name !== c.name) { if (name !== null) alert('Nome incorreto'); return; }
    if (!confirm(`⚠️ EXCLUIR PERMANENTEMENTE o clã "${c.name}"?\n\nTodos os membros serão removidos. Baú perdido. Não pode desfazer.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/clan`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) { alert(data.message); onReload(); }
      else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  return { busy, saveSettings, expandTo, deleteClan };
}

function SettingsTabGeneralOnly({ mine, onReload }) {
  const c = mine.clan;
  const [form, setForm] = useState({
    description: c.description || '',
    motto: c.motto || '',
    visibility: c.visibility,
    bannerColor: c.bannerColor || '#2dd4bf',
  });
  const { busy, saveSettings } = useSettingsActions(mine, onReload);

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 lift">
      <h3 className="font-bold mb-3">⚙️ Geral</h3>
      <div className="space-y-3">
        <Field label="Lema (60 caracteres)">
          <input value={form.motto} maxLength={60}
            onChange={e => setForm({ ...form, motto: e.target.value })}
            className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
        </Field>
        <Field label="Descrição (200 caracteres)">
          <textarea value={form.description} rows={2} maxLength={200}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Visibilidade">
            <select value={form.visibility}
              onChange={e => setForm({ ...form, visibility: e.target.value })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm">
              <option value="public">🌐 Público</option>
              <option value="private">🔒 Privado</option>
            </select>
          </Field>
          <Field label="Cor do estandarte">
            <input type="color" value={form.bannerColor}
              onChange={e => setForm({ ...form, bannerColor: e.target.value })}
              className="w-full h-10 bg-zinc-800 border border-white/5 rounded-lg cursor-pointer" />
          </Field>
        </div>
        <button onClick={() => saveSettings(form)} disabled={busy}
          className="w-full py-2.5 bg-teal-400 text-zinc-900 font-bold rounded-lg hover:bg-teal-300 disabled:opacity-40">
          {busy ? '⏳' : '💾 Salvar'}
        </button>
      </div>
    </div>
  );
}

function SettingsTabExpandOnly({ mine, onReload }) {
  const c = mine.clan;
  const { busy, expandTo } = useSettingsActions(mine, onReload);

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 lift">
      <h3 className="font-bold mb-3">🏗️ Expandir capacidade</h3>
      <p className="text-xs text-zinc-500 mb-3">
        Capacidade atual: <strong>{c.maxMembers} membros</strong> · Baú: {c.treasury.toLocaleString()} Yuan
      </p>
      <div className="space-y-2">
        {mine.capacityTiers.map((tier, i) => {
          const reached = c.maxMembers >= tier.max;
          const canAfford = c.treasury >= tier.cost;
          return (
            <div key={tier.max}
              className={`flex items-center gap-3 p-3 rounded-xl border
                ${reached ? 'bg-teal-500/5 border-teal-500/20 opacity-70'
                  : canAfford ? 'bg-zinc-800 border-white/5'
                  : 'bg-zinc-800/40 border-white/5 opacity-50'}`}>
              <div className="flex-1">
                <div className="font-bold text-sm">{tier.label} · {tier.max} membros</div>
                <div className="text-xs text-zinc-500 font-mono">
                  {tier.cost === 0 ? 'Grátis (padrão)' : `${tier.cost.toLocaleString()} Yuan`}
                </div>
              </div>
              {reached ? (
                <span className="text-xs text-teal-400 font-bold">✓ Ativo</span>
              ) : (
                <button onClick={() => expandTo(i)} disabled={busy || !canAfford}
                  className="px-3 py-1.5 bg-teal-400 text-zinc-900 rounded-lg text-xs font-bold disabled:opacity-40">
                  Expandir
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsTabDangerOnly({ mine, onReload }) {
  const { busy, deleteClan } = useSettingsActions(mine, onReload);
  return (
    <div className="bg-zinc-900 border border-red-500/25 rounded-2xl p-5">
      <h3 className="font-bold text-red-400 mb-2">⚠️ Zona de perigo</h3>
      <p className="text-xs text-zinc-500 mb-3">
        Excluir o clã é permanente. Membros perdem acesso, baú é zerado.
      </p>
      <button onClick={deleteClan} disabled={busy}
        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-xl text-sm font-bold">
        🗑️ Excluir clã
      </button>
    </div>
  );
}

// (deprecated) — mantido por compatibilidade caso algo chame ainda
function SettingsTab({ mine, onReload }) {
  return (
    <div className="space-y-4 stagger">
      <SettingsTabGeneralOnly mine={mine} onReload={onReload} />
      <SettingsTabExpandOnly  mine={mine} onReload={onReload} />
      <SettingsTabDangerOnly  mine={mine} onReload={onReload} />
    </div>
  );
}
