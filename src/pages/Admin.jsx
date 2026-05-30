// frontend/src/pages/Admin.jsx
import { useState, useEffect } from 'react';
import { authHeaders } from '../App';

const API = window.__API_URL__ || 'http://localhost:5000';

export default function Admin() {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [botStats, setBotStats] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/admin/stats`, { headers: authHeaders() })
      .then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${API}/api/admin/stats-bot`)
      .then(r => r.json()).then(setBotStats).catch(() => {});
  }, []);

  const TABS = [
    ['stats',   '📊', 'Stats'],
    ['players', '👥', 'Jogadores'],
    ['premium', '💎', 'Premium'],
    ['quests',  '📜', 'Mural de Missões'],
    ['store',   '🏬', 'Loja Yuan'],
    ['actions', '🔧', 'Ações'],
    ['clanwar', '⚔️', 'Batalha de Clãs'],
    ['notes',   '📝', 'Futuras Atualizações'],
  ];

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold">⚙️ Painel Admin</h1>
          <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 px-3 py-1 rounded-full font-bold">Admin Only</span>
        </div>

        {/* Tabs — grid 2 colunas no mobile, flex wrap no desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-6">
          {TABS.map(([k, icon, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`py-2 px-3 rounded-xl text-sm font-semibold transition-all text-center
                ${tab === k ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-900 text-zinc-400 border border-white/5 hover:bg-zinc-800 hover:text-white'}`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'stats'   && <StatsPanel stats={stats} botStats={botStats} />}
        {tab === 'players' && <PlayersPanel />}
        {tab === 'premium' && <PremiumPanel />}
        {tab === 'quests'  && <QuestsPanel />}
        {tab === 'store'   && <YuanStorePanel />}
        {tab === 'actions' && <ActionsPanel />}
        {tab === 'clanwar' && <ClanWarPanel />}
        {tab === 'notes'   && <FutureUpdatesPanel />}
      </div>
    </div>
  );
}

// PAINEL DE STATS
function StatsPanel({ stats, botStats }) {
  // separados. Preferimos os dois quando vierem; senão caímos no storeItems.
  const fixedItems = stats?.fixedStoreItems ?? stats?.storeItems ?? 0;
  const dailyItems = stats?.dailyStoreItems ?? 0;
  const totalStoreItems = fixedItems + dailyItems;

  const activeWar = stats?.activeClanWarEvent;
  const warTimeLeft = activeWar ? (() => {
    const ms = new Date(activeWar.endsAt).getTime() - Date.now();
    if (ms <= 0) return 'encerrando…';
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60000);
    if (h >= 24) return `${Math.floor(h/24)}d ${h%24}h`;
    if (h >= 1) return `${h}h ${m}m`;
    return `${m}m`;
  })() : null;

  return (
    <div>
      {}
      {activeWar && (
        <div className="bg-gradient-to-br from-amber-500/15 to-purple-500/15 border border-amber-400/30 rounded-2xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚔️</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded-full font-bold animate-pulse">● AO VIVO</span>
                <span className="font-bold">{activeWar.name}</span>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">Evento de Batalha de Clãs · termina em {warTimeLeft}</div>
            </div>
          </div>
          <a href="#" onClick={(e) => { e.preventDefault();
            // Estes triggers só funcionam dentro do Admin pq o botão "Batalha de Clãs"
            // está na barra de tabs do componente pai. Aqui apenas damos hint visual.
          }}
            className="text-xs px-3 py-1.5 bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-lg font-bold">
            Vá para a aba ⚔️ Batalha de Clãs
          </a>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6 stagger">
        {[
          ['👥', stats?.users || 0, 'Usuários'],
          ['💳', stats?.activeSubs || 0, 'Assinaturas'],
          ['⚔️', stats?.battles || 0, 'Batalhas'],
          ['🛡️', stats?.clans || 0, 'Clãs'],
          ['📜', stats?.adminQuests || 0, 'Missões Admin'],
          ['🏬', totalStoreItems, 'Itens na Loja'],
        ].map(([icon, val, label]) => (
          <div key={label} className="bg-zinc-900 border border-white/5 rounded-xl p-4 text-center lift">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-2xl font-bold text-teal-400 font-mono">{val.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">{label}</div>
            {/* Mostra a quebra fixa+diária só no card "Itens na Loja" */}
            {label === 'Itens na Loja' && (
              <div className="text-[10px] text-zinc-600 mt-1">
                Fixa: <span className="text-zinc-400">{fixedItems}</span>
                {' · '}
                Diária: <span className="text-zinc-400">{dailyItems}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
        <h2 className="font-semibold mb-3">🤖 Status do Bot Discord</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
          <div className="bg-zinc-800 rounded-xl p-3">
            <div className="w-2 h-2 rounded-full bg-teal-400 mx-auto mb-1 animate-pulse" />
            <div className="text-sm font-bold">Online</div>
            <div className="text-xs text-zinc-500">Bot</div>
          </div>
          {[
            [botStats?.battles?.toLocaleString() ?? '—', 'Batalhas'],
            [botStats?.users?.toLocaleString() ?? '—', 'Usuários'],
            [botStats?.clans?.toLocaleString() ?? '—', 'Clãs ativos'],
          ].map(([v, l]) => (
            <div key={l} className="bg-zinc-800 rounded-xl p-3">
              <div className="text-xl font-bold text-teal-400 mb-1">{v}</div>
              <div className="text-sm font-bold">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// PAINEL DE JOGADORES
// Grids:
//   1. Reset Geral do Banco (alto risco, dupla confirmação)
//   2. Reset Jogador Único
//   3. Lista de Jogadores com Ban/Unban
function PlayersPanel() {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Estados dos modais/formulários
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [resetAllConfirm, setResetAllConfirm] = useState('');
  const [resetAllWorking, setResetAllWorking] = useState(false);
  const [dailyAfterReset, setDailyAfterReset] = useState(null);

  const [resetPlayerId, setResetPlayerId] = useState('');
  const [resetPlayerWorking, setResetPlayerWorking] = useState(false);

  const [actioningId, setActioningId] = useState(null);

  const [cleanupTarget, setCleanupTarget] = useState(''); // username, discordId ou characterId
  const [cleanupWorking, setCleanupWorking] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [forceRefreshWorking, setForceRefreshWorking] = useState(false);
  const [forceRefreshResult, setForceRefreshResult] = useState(null);

  const load = async (searchTerm = '') => {
    setLoading(true);
    try {
      const url = searchTerm
        ? `${API}/api/admin/players?search=${encodeURIComponent(searchTerm)}`
        : `${API}/api/admin/players`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setPlayers(Array.isArray(data.players) ? data.players : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doSearch = () => load(search.trim());

  // ─── RESET GERAL ───
  const doResetAll = async () => {
    if (resetAllConfirm !== 'RESETAR TUDO') {
      alert('❌ Digite exatamente "RESETAR TUDO" para confirmar.');
      return;
    }
    setResetAllWorking(true);
    try {
      const res = await fetch(`${API}/api/admin/reset-all`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ confirm: 'RESETAR TUDO' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setShowResetAllModal(false);
        setResetAllConfirm('');
        if (data.dailyStore) setDailyAfterReset(data.dailyStore);
        load();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (e) {
      alert('❌ Erro de conexão');
    } finally {
      setResetAllWorking(false);
    }
  };

  const doCleanupSkills = async () => {
    const target = cleanupTarget.trim();
    if (!target) { alert('Informe Discord ID ou username do jogador'); return; }
    setCleanupWorking(true);
    setCleanupResult(null);
    try {
      // Detecta se é discordId numérico (17-20 dígitos) ou username
      const body = /^\d{17,20}$/.test(target)
        ? { discordId: target }
        : { username: target };
      const res = await fetch(`${API}/api/admin/cleanup-character-skills`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setCleanupResult(data.character);
      } else {
        alert(`❌ ${data.error || 'Erro'}${data.detail ? ': ' + data.detail : ''}`);
      }
    } catch (e) {
      alert('❌ Erro de conexão');
    } finally {
      setCleanupWorking(false);
    }
  };

  const doForceDailyRefresh = async () => {
    if (!confirm('Re-rolar a Loja Yuan de hoje? Os 6 produtos atuais serão substituídos.')) return;
    setForceRefreshWorking(true);
    setForceRefreshResult(null);
    try {
      const res = await fetch(`${API}/api/admin/force-daily-refresh`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        setForceRefreshResult(data);
      } else {
        alert(`❌ ${data.error || 'Erro'}${data.detail ? ': ' + data.detail : ''}`);
      }
    } catch (e) {
      alert('❌ Erro de conexão');
    } finally {
      setForceRefreshWorking(false);
    }
  };

  // ─── RESET JOGADOR ÚNICO ───
  const doResetPlayer = async (discordId) => {
    const target = discordId || resetPlayerId.trim();
    if (!target) { alert('Digite o Discord ID ou selecione um jogador.'); return; }
    if (!confirm(`Resetar o personagem de "${target}"?\n\nIsso apaga:\n- Todo progresso (level, exp, money, elo)\n- Elemento (terá que refazer o Cap. 1)\n- Inventário, skills, missões, histórico\n\nAção irreversível.`)) return;
    setResetPlayerWorking(true);
    try {
      const res = await fetch(`${API}/api/admin/reset`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ discordId: target }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setResetPlayerId('');
        load();
      } else {
        alert(`❌ ${data.error}`);
      }
    } finally {
      setResetPlayerWorking(false);
    }
  };

  // ─── BAN ───
  const doBan = async (player) => {
    const motivo = prompt(`Motivo do banimento de ${player.username}?`);
    if (motivo === null) return;
    setActioningId(player.id);
    try {
      const res = await fetch(`${API}/api/admin/ban`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ discordId: player.discordId, motivo: motivo || 'Sem motivo' }),
      });
      const data = await res.json();
      if (res.ok) { alert(`🔨 ${data.message}`); load(search); }
      else alert(`❌ ${data.error}`);
    } finally {
      setActioningId(null);
    }
  };

  // ─── UNBAN ───
  const doUnban = async (player) => {
    if (!confirm(`Desbanir ${player.username}?`)) return;
    setActioningId(player.id);
    try {
      const res = await fetch(`${API}/api/admin/unban`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ discordId: player.discordId }),
      });
      const data = await res.json();
      if (res.ok) { alert(`✅ ${data.message}`); load(search); }
      else alert(`❌ ${data.error}`);
    } finally {
      setActioningId(null);
    }
  };

  const ELEM_ICON = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️', Nenhum: '❓' };
  const RANK_COLOR = {
    ferro: '#8B6F47', bronze: '#CD7F32', prata: '#C0C0C0',
    ouro: '#FFD700', diamante: '#67E8F9',
  };

  return (
    <div className="space-y-5">
      {}
      <div className="bg-gradient-to-br from-teal-500/5 to-purple-500/5 border border-teal-500/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🛠️</div>
          <div>
            <h3 className="font-bold text-teal-300 mb-1">Ferramentas de faxina</h3>
            <p className="text-xs text-zinc-400">Resolve casos pontuais — não destrutivas, podem ser usadas a qualquer hora.</p>
          </div>
        </div>

        {}
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
          <h4 className="text-sm font-bold text-white mb-1">🧹 Limpar skills incompatíveis</h4>
          <p className="text-xs text-zinc-400 mb-3">
            Remove skills do <code className="bg-zinc-800 px-1 rounded">unlockedSkills</code> que não combinam
            com o elemento do personagem. Útil pra contas pré-v6.4 que ficaram com skills "fantasma".
          </p>
          <div className="flex gap-2 mb-2">
            <input value={cleanupTarget}
              onChange={e => setCleanupTarget(e.target.value)}
              placeholder="Discord ID ou username"
              className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            <button onClick={doCleanupSkills} disabled={cleanupWorking}
              className="px-4 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
              {cleanupWorking ? '⏳' : 'Limpar'}
            </button>
          </div>
          {cleanupResult && (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 text-xs space-y-2">
              <div className="font-bold text-teal-300">✅ Faxina concluída</div>
              <div>Elemento: <strong>{cleanupResult.element}</strong></div>
              <div>
                Skills antes: <strong>{cleanupResult.before.unlockedSkills.length}</strong> · 
                depois: <strong>{cleanupResult.after.unlockedSkills.length}</strong>
              </div>
              {cleanupResult.removed.unlockedSkills.length > 0 && (
                <div className="text-red-300">
                  Removidas: {cleanupResult.removed.unlockedSkills.join(', ')}
                </div>
              )}
              {cleanupResult.removed.equippedSkills.length > 0 && (
                <div className="text-amber-300">
                  Desequipadas: {cleanupResult.removed.equippedSkills.join(', ')}
                </div>
              )}
              <button onClick={() => setCleanupResult(null)}
                className="text-zinc-500 hover:text-white text-xs">Fechar</button>
            </div>
          )}
        </div>

        {/* Force daily refresh */}
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
          <h4 className="text-sm font-bold text-white mb-1">🏬 Re-rolar Loja Yuan agora</h4>
          <p className="text-xs text-zinc-400 mb-3">
            Substitui os 6 produtos do dia atual. A loja normalmente renova à meia-noite UTC
            (21h em Brasília). Use isto pra forçar troca antes do horário automático.
          </p>
          <button onClick={doForceDailyRefresh} disabled={forceRefreshWorking}
            className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
            {forceRefreshWorking ? '⏳ Re-rolando...' : '🎲 Re-rolar agora'}
          </button>
          {forceRefreshResult && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
              <div className="font-bold text-amber-300 mb-2">✅ Re-rolada · {forceRefreshResult.date}</div>
              <div className="grid grid-cols-2 gap-1">
                {forceRefreshResult.products.map((p, i) => (
                  <div key={i} className="bg-zinc-900/50 rounded px-2 py-1">
                    {p.icon} {p.name} <span className="text-zinc-500">({p.element})</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setForceRefreshResult(null)}
                className="mt-2 text-zinc-500 hover:text-white text-xs">Fechar</button>
            </div>
          )}
        </div>
      </div>

      {/* ══════ GRID 1: RESET GERAL ══════ */}
      <div className="bg-zinc-900 border-2 border-red-500/30 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl">🚨</div>
          <div className="flex-1">
            <h3 className="font-bold text-red-400 mb-1">Reset Geral do Banco</h3>
            <p className="text-xs text-zinc-400">
              Zera <strong>TODOS os personagens</strong> (progresso, elemento, stats), apaga batalhas,
              missões, inventários, histórico da história, trades e anúncios.
              Usuários e configurações admin (missões do mural, loja yuan) são preservados.
            </p>
          </div>
        </div>

        {!showResetAllModal ? (
          <button onClick={() => setShowResetAllModal(true)}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-sm font-bold transition-all">
            🔥 Iniciar Reset Geral
          </button>
        ) : (
          <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-4 space-y-3">
            <p className="text-sm text-red-200 font-semibold">⚠️ Atenção: ação irreversível!</p>
            <p className="text-xs text-zinc-400">
              Digite exatamente <code className="bg-zinc-800 px-2 py-0.5 rounded text-red-300">RESETAR TUDO</code> para confirmar:
            </p>
            <input value={resetAllConfirm}
              onChange={e => setResetAllConfirm(e.target.value)}
              placeholder='Digite "RESETAR TUDO"'
              className="w-full bg-zinc-900 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-200 font-mono focus:outline-none focus:border-red-500" />
            <div className="flex gap-2">
              <button onClick={doResetAll}
                disabled={resetAllWorking || resetAllConfirm !== 'RESETAR TUDO'}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all
                  ${resetAllConfirm === 'RESETAR TUDO' && !resetAllWorking
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}>
                {resetAllWorking ? '⏳ Resetando...' : '💥 CONFIRMAR RESET GERAL'}
              </button>
              <button onClick={() => { setShowResetAllModal(false); setResetAllConfirm(''); }}
                disabled={resetAllWorking}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {}
      {dailyAfterReset && (
        <div className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="font-bold text-amber-300 mb-1 flex items-center gap-2">
                🏬 Loja Yuan re-rolada
              </h3>
              <p className="text-xs text-zinc-400">
                Os produtos da Loja Yuan diária para hoje ({dailyAfterReset.date}). 1 skill + 3 itens + 2 poções.
              </p>
            </div>
            <button onClick={() => setDailyAfterReset(null)}
              className="text-zinc-500 hover:text-white text-sm px-2">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {dailyAfterReset.products.map((p, i) => (
              <div key={i} className="bg-zinc-900/60 border border-white/5 rounded-lg p-2 text-xs">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base">{p.icon}</span>
                  <span className="font-bold truncate flex-1">{p.name}</span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  <span className={
                    p.type === 'skill' ? 'text-amber-400' :
                    p.type === 'consumable' ? 'text-pink-300' : 'text-teal-300'
                  }>
                    {p.type === 'skill' ? '🎯 SKILL' : p.type === 'consumable' ? '🧪 POÇÃO' : '⚔️ ITEM'}
                  </span>
                  {' · '}{p.element || '—'}{' · '}{p.rarity}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ GRID 2: RESET JOGADOR ÚNICO ══════ */}
      <div className="bg-zinc-900 border border-purple-500/30 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl">♻️</div>
          <div className="flex-1">
            <h3 className="font-bold text-purple-400 mb-1">Resetar Jogador Específico</h3>
            <p className="text-xs text-zinc-400">
              Zera o progresso de um jogador individual. Digite o Discord ID abaixo, ou clique em
              "Reset" direto no card do jogador na lista.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={resetPlayerId}
            onChange={e => setResetPlayerId(e.target.value)}
            placeholder="Discord ID do jogador"
            className="flex-1 bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400" />
          <button onClick={() => doResetPlayer()}
            disabled={resetPlayerWorking || !resetPlayerId.trim()}
            className="px-4 py-2 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-bold disabled:opacity-50">
            {resetPlayerWorking ? '⏳' : '♻️ Resetar'}
          </button>
        </div>
      </div>

      {/* ══════ GRID 3: LISTA DE JOGADORES ══════ */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">👥 Jogadores</h3>
            <p className="text-xs text-zinc-500">
              {players.length} jogador{players.length !== 1 ? 'es' : ''} · últimos cadastros
            </p>
          </div>
          <button onClick={() => load(search)}
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg">
            🔄 Recarregar
          </button>
        </div>

        {/* Busca */}
        <div className="flex gap-2 mb-4">
          <input value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Buscar por username ou Discord ID..."
            className="flex-1 bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          <button onClick={doSearch}
            className="px-4 py-2 bg-teal-400/15 hover:bg-teal-400/25 text-teal-400 border border-teal-400/25 rounded-lg text-sm font-bold">
            🔍 Buscar
          </button>
          {search && (
            <button onClick={() => { setSearch(''); load(); }}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
              ✕
            </button>
          )}
        </div>

        {loading && <p className="text-zinc-500 text-center py-8">Carregando jogadores...</p>}

        {!loading && players.length === 0 && (
          <p className="text-zinc-500 text-center py-8">Nenhum jogador encontrado.</p>
        )}

        <div className="space-y-2">
          {players.map(p => {
            const ch = p.character;
            const rankColor = RANK_COLOR[ch?.rankTier] || '#888';
            const elemIcon = ELEM_ICON[ch?.element] || '❓';
            return (
              <div key={p.id}
                className={`bg-zinc-800 border rounded-xl p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap lift
                  ${p.isBanned ? 'border-red-500/30 opacity-80' : 'border-white/5'}`}>
                {/* Avatar + Nome */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img src={p.avatar || 'https://via.placeholder.com/36'}
                    alt="" className="w-10 h-10 rounded-xl flex-shrink-0"
                    onError={e => { e.target.src = 'https://via.placeholder.com/36'; }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{p.username}</span>
                      {p.isBanned && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">
                          🔨 BANIDO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono truncate">ID: {p.discordId}</div>
                  </div>
                </div>

                {/* Stats do personagem */}
                {ch ? (
                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-base">{elemIcon}</span>
                      <span className="text-zinc-400">{ch.element}</span>
                    </div>
                    <div className="bg-zinc-900 px-2 py-1 rounded-lg">
                      <span className="text-zinc-500">Lv</span>{' '}
                      <span className="font-bold text-white">{ch.level}</span>
                    </div>
                    <div className="bg-zinc-900 px-2 py-1 rounded-lg" style={{ color: rankColor }}>
                      <span className="font-bold">{ch.elo}</span>
                      <span className="text-xs ml-1 opacity-75">ELO</span>
                    </div>
                    <div className="bg-zinc-900 px-2 py-1 rounded-lg text-amber-400">
                      💰 {ch.money}
                    </div>
                    <div className="text-zinc-500">
                      {ch.wins}V / {ch.losses}D
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-600 italic">Sem personagem</div>
                )}

                {/* Ações */}
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => doResetPlayer(p.discordId)}
                    disabled={actioningId === p.id}
                    title="Resetar personagem"
                    className="px-2 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/20 rounded-lg text-xs font-bold">
                    ♻️
                  </button>
                  {p.isBanned ? (
                    <button onClick={() => doUnban(p)}
                      disabled={actioningId === p.id}
                      className="px-3 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 border border-teal-500/20 rounded-lg text-xs font-bold">
                      {actioningId === p.id ? '⏳' : '✅ Unban'}
                    </button>
                  ) : (
                    <button onClick={() => doBan(p)}
                      disabled={actioningId === p.id}
                      className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold">
                      {actioningId === p.id ? '⏳' : '🔨 Ban'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// PAINEL DE MISSÕES (MURAL)
function QuestsPanel() {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/quests`, { headers: authHeaders() });
      const data = await res.json();
      setQuests(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (data) => {
    const isEdit = !!editing?.id;
    const url = isEdit ? `${API}/api/admin/quests/${editing.id}` : `${API}/api/admin/quests`;
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) { alert(`❌ ${result.error}`); return; }
    alert(`✅ Missão ${isEdit ? 'atualizada' : 'criada'}!`);
    setShowForm(false);
    setEditing(null);
    load();
  };

  const del = async (id) => {
    if (!confirm('Deletar esta missão? Esta ação não pode ser desfeita.')) return;
    const res = await fetch(`${API}/api/admin/quests/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) { alert('✅ Deletada!'); load(); }
    else alert('❌ Erro ao deletar');
  };

  const toggle = async (q) => {
    await fetch(`${API}/api/admin/quests/${q.id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ isActive: !q.isActive }),
    });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold">📜 Mural de Missões</h2>
          <p className="text-xs text-zinc-500">Só você pode criar missões. Elas aparecem no jogo para usuários no intervalo de nível definido.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="px-4 py-2 bg-teal-400 text-zinc-900 font-bold rounded-xl hover:bg-teal-300 transition-all">
          + Nova Missão
        </button>
      </div>

      {showForm && (
        <QuestForm
          initial={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={save}
        />
      )}

      {loading && <p className="text-zinc-500 text-center py-8">Carregando...</p>}
      {!loading && quests.length === 0 && (
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-8 text-center">
          <p className="text-zinc-500">Nenhuma missão criada ainda.</p>
          <p className="text-xs text-zinc-600 mt-2">Clique em "+ Nova Missão" acima para começar.</p>
        </div>
      )}

      <div className="space-y-2 stagger">
        {quests.map(q => (
          <div key={q.id} className={`bg-zinc-900 border rounded-xl p-4 lift ${q.isActive ? 'border-white/5' : 'border-red-500/20 opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{q.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    q.type === 'battle'  ? 'bg-orange-500/15 text-orange-400' :
                    q.type === 'collect' ? 'bg-teal-500/15 text-teal-400' :
                    q.type === 'craft'   ? 'bg-purple-500/15 text-purple-400' :
                    q.type === 'story'   ? 'bg-amber-500/15 text-amber-400' :
                                           'bg-sky-500/15 text-sky-400'
                  }`}>{q.type}</span>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                    Lv {q.minLevel}-{q.maxLevel}
                  </span>
                  {!q.isActive && <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">Inativa</span>}
                </div>
                <p className="text-sm text-zinc-400 mb-2">{q.description}</p>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                  <span>🎯 Prog: {q.maxProgress}</span>
                  <span>⚡ +{q.rewardExp} EXP</span>
                  <span>💰 +{q.rewardYuan} Yuan</span>
                  {q.rewardItem && <span>🎁 {q.rewardItem}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button onClick={() => { setEditing(q); setShowForm(true); }}
                  className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg">✏️</button>
                <button onClick={() => toggle(q)}
                  className={`text-xs px-3 py-1 rounded-lg ${q.isActive ? 'bg-yellow-500/15 text-yellow-400' : 'bg-teal-500/15 text-teal-400'}`}>
                  {q.isActive ? '⏸️' : '▶️'}
                </button>
                <button onClick={() => del(q.id)}
                  className="text-xs px-3 py-1 bg-red-500/15 text-red-400 rounded-lg">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState({
    title:         initial?.title || '',
    description:   initial?.description || '',
    type:          initial?.type || 'battle',
    element:       initial?.element || 'any',
    minLevel:      initial?.minLevel ?? 1,
    maxLevel:      initial?.maxLevel ?? 100,
    maxProgress:   initial?.maxProgress ?? 5,
    rewardExp:     initial?.rewardExp ?? 100,
    rewardYuan:    initial?.rewardYuan ?? 30,
    rewardItem:    initial?.rewardItem || '',
    durationHours: initial?.durationHours ?? 24,
  });

  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Carrega catálogo filtrado por elemento
  useEffect(() => {
    setLoadingCatalog(true);
    const url = form.element === 'any'
      ? `${API}/api/admin/items-catalog`
      : `${API}/api/admin/items-catalog?element=${encodeURIComponent(form.element)}`;
    fetch(url, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setCatalog(Array.isArray(d) ? d : []))
      .catch(() => setCatalog([]))
      .finally(() => setLoadingCatalog(false));
  }, [form.element]);

  // Quando troca o elemento, valida se o item atual ainda combina
  useEffect(() => {
    if (!form.rewardItem || form.element === 'any') return;
    const item = catalog.find(c => c.name === form.rewardItem);
    if (item && item.element !== form.element && item.element !== 'Neutro') {
      setForm(f => ({ ...f, rewardItem: '' }));
    }
  }, [form.element, catalog]);

  const submit = () => {
    if (!form.title || !form.description) { alert('Preencha título e descrição'); return; }
    onSave({ ...form, rewardItem: form.rewardItem || null });
  };

  const ELEMENT_ICON = { any: '🌍', Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' };

  return (
    <div className="bg-zinc-900 border border-teal-500/30 rounded-2xl p-5 mb-5">
      <h3 className="font-bold mb-4">{initial?.id ? 'Editar Missão' : 'Nova Missão'}</h3>
      <div className="space-y-3">
        <Field label="Título *">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
        </Field>
        <Field label="Descrição *">
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
            className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo *">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
              <option value="battle">Batalha</option>
              <option value="collect">Coletar</option>
              <option value="craft">Crafting</option>
              <option value="explore">Explorar</option>
              <option value="story">História</option>
            </select>
          </Field>
          <Field label="Elemento *">
            <select value={form.element} onChange={e => setForm({ ...form, element: e.target.value })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
              <option value="any">{ELEMENT_ICON.any} Todos</option>
              <option value="Fogo">{ELEMENT_ICON.Fogo} Fogo</option>
              <option value="Água">{ELEMENT_ICON['Água']} Água</option>
              <option value="Terra">{ELEMENT_ICON.Terra} Terra</option>
              <option value="Ar">{ELEMENT_ICON.Ar} Ar</option>
            </select>
          </Field>
        </div>
        {form.element !== 'any' && (
          <p className="text-xs text-amber-300 -mt-2">
            ⚠️ Esta missão só aparecerá para dobradores de <strong>{form.element}</strong>.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Progresso máximo *">
            <input type="number" min="1" value={form.maxProgress}
              onChange={e => setForm({ ...form, maxProgress: parseInt(e.target.value) || 1 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </Field>
          <Field label="Duração (horas)">
            <input type="number" min="1" max="720" value={form.durationHours}
              onChange={e => setForm({ ...form, durationHours: parseInt(e.target.value) || 24 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nível mínimo">
            <input type="number" min="1" max="100" value={form.minLevel}
              onChange={e => setForm({ ...form, minLevel: parseInt(e.target.value) || 1 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </Field>
          <Field label="Nível máximo">
            <input type="number" min="1" max="100" value={form.maxLevel}
              onChange={e => setForm({ ...form, maxLevel: parseInt(e.target.value) || 100 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recompensa EXP">
            <input type="number" min="0" value={form.rewardExp}
              onChange={e => setForm({ ...form, rewardExp: parseInt(e.target.value) || 0 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </Field>
          <Field label="Recompensa Yuan">
            <input type="number" min="0" value={form.rewardYuan}
              onChange={e => setForm({ ...form, rewardYuan: parseInt(e.target.value) || 0 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          </Field>
        </div>

        <Field label={`Recompensa Item (${form.element === 'any' ? 'todos os elementos' : 'filtrado por ' + form.element})`}>
          <select value={form.rewardItem}
            onChange={e => setForm({ ...form, rewardItem: e.target.value })}
            className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
            <option value="">— Sem item / Apenas EXP+Yuan —</option>
            {loadingCatalog && <option disabled>Carregando catálogo...</option>}
            {catalog.map(it => (
              <option key={it.id} value={it.name}>
                {it.name} · {it.element} · {it.rarity} · Lv {it.minLevel}+
              </option>
            ))}
          </select>
          {!loadingCatalog && catalog.length === 0 && (
            <p className="text-xs text-amber-300 mt-1">
              Nenhum item disponível para esse elemento.
            </p>
          )}
        </Field>

        <div className="flex gap-2 pt-2">
          <button onClick={submit}
            className="flex-1 py-2 bg-teal-400 text-zinc-900 font-bold rounded-lg hover:bg-teal-300">
            {initial?.id ? 'Salvar' : 'Criar'}
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// PAINEL DE LOJA YUAN
// ════════���══════════════════════════════════════
function YuanStorePanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  // Sub-aba: 'daily' (loja diária rotativa) | 'fixed' (itens cadastrados manualmente)
  const [subTab, setSubTab] = useState('daily');
  const [daily, setDaily] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDaily = async () => {
    setDailyLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/stats`, { headers: authHeaders() });
      // Busca produtos do dia via yuanstore/today (precisa de user auth)
      // Como o admin também é user, podemos chamar o endpoint normal
      const r2 = await fetch(`${API}/api/yuanstore/today`, { headers: authHeaders() });
      if (r2.ok) setDaily(await r2.json());
    } finally { setDailyLoading(false); }
  };

  const forceRefresh = async () => {
    if (!confirm('Renovar os 6 produtos da Loja Diária agora?')) return;
    setRefreshing(true);
    try {
      const res = await fetch(`${API}/api/admin/force-daily-refresh`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) { alert('✅ Loja diária renovada!'); loadDaily(); }
      else alert(`❌ ${data.error}`);
    } finally { setRefreshing(false); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/yuan-store`, { headers: authHeaders() });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); loadDaily(); }, []);

  const save = async (data) => {
    const isEdit = !!editing?.id;
    const url = isEdit ? `${API}/api/admin/yuan-store/${editing.id}` : `${API}/api/admin/yuan-store`;
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) { alert(`❌ ${result.error}`); return; }
    alert(`✅ Item ${isEdit ? 'atualizado' : 'criado'}!`);
    setShowForm(false);
    setEditing(null);
    load();
  };
  const del = async (id) => {
    if (!confirm('Deletar este item da loja?')) return;
    const res = await fetch(`${API}/api/admin/yuan-store/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) { alert('✅ Deletado!'); load(); }
    else alert('❌ Erro ao deletar');
  };
  const toggle = async (it) => {
    await fetch(`${API}/api/admin/yuan-store/${it.id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ isActive: !it.isActive }),
    });
    load();
  };

  const RARITY_COLOR = {
    common:   'text-zinc-400',
    uncommon: 'text-teal-400',
    rare:     'text-purple-400',
  };

  const RARITY_C = {
    common: 'text-zinc-400', uncommon: 'text-teal-400',
    rare: 'text-purple-400', epic: 'text-amber-400', legendary: 'text-yellow-300',
  };

  return (
    <div>
      {/* Sub-tabs: Loja Diária | Loja Fixa */}
      <div className="flex gap-2 mb-5">
        {[['daily','🗓️','Loja Diária (automática)'],['fixed','🏬','Loja Fixa (manual)']].map(([k,ic,lb]) => (
          <button key={k} onClick={() => setSubTab(k)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-all
              ${subTab===k ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
            {ic} {lb}
          </button>
        ))}
      </div>

      {/* LOJA DIÁRIA */}
      {subTab === 'daily' && (
        <div>
          <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold">🗓️ Produtos de Hoje</h2>
                <p className="text-xs text-zinc-500">6 produtos sorteados automaticamente. Renova à meia-noite UTC.</p>
              </div>
              <button onClick={forceRefresh} disabled={refreshing}
                className="px-3 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/30 disabled:opacity-50">
                {refreshing ? '⏳' : '🎲 Re-rolar'}
              </button>
            </div>
            {dailyLoading ? (
              <p className="text-zinc-500 text-center py-6">Carregando...</p>
            ) : daily?.products ? (
              <div className="space-y-2">
                {daily.products.map((p, i) => (
                  <div key={p.dailyId} className="bg-zinc-800/60 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl">{p.icon || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{p.name}</div>
                      <div className={`text-xs ${RARITY_C[p.rarity] || 'text-zinc-400'}`}>
                        {p.rarity} · {p.type} · Lv {p.minLevel}+
                      </div>
                    </div>
                    <div className="text-amber-400 font-bold text-sm whitespace-nowrap">
                      💰 {p.priceYuan?.toLocaleString('pt-BR')} Yuan
                    </div>
                  </div>
                ))}
                {daily.nextRefreshAt && (
                  <p className="text-xs text-zinc-500 text-center pt-2">
                    ⏰ Renova em {(() => {
                      const ms = new Date(daily.nextRefreshAt) - Date.now();
                      const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
                      return `${h}h ${m}m`;
                    })()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-6">Erro ao carregar loja diária.</p>
            )}
          </div>
        </div>
      )}

      {/* LOJA FIXA */}
      {subTab === 'fixed' && (
      <div>
      {}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-5 text-sm">
        <p className="font-bold text-amber-400 mb-1">⚠️ Dois sistemas de loja</p>
        <p className="text-zinc-400">
          <strong className="text-white">Loja Diária (bot/site)</strong> — 6 produtos sorteados automaticamente todo dia (1 skill + 3 itens + 2 poções). Os jogadores a veem em <em>Mercado → Loja Yuan</em> e no painel do bot.
        </p>
        <p className="text-zinc-400 mt-1">
          <strong className="text-white">Loja Fixa (abaixo)</strong> — itens cadastrados manualmente aqui. Só aparecem se você os adicionar. Se está vazia, é porque nenhum foi cadastrado ainda.
        </p>
        <button onClick={async () => {
          if (!confirm('Forçar nova rotação da Loja Diária?')) return;
          const r = await fetch(`${API}/api/admin/force-daily-refresh`, { method: 'POST', headers: authHeaders() });
          const d = await r.json();
          alert(r.ok ? '✅ Loja diária renovada!' : `❌ ${d.error}`);
        }} className="mt-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold hover:bg-amber-500/30 transition-all">
          🔄 Forçar renovação da Loja Diária
        </button>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold">🏬 Loja Fixa (manual)</h2>
          <p className="text-xs text-zinc-500">Itens permanentes cadastrados manualmente. Filtrados automaticamente pelo nível do usuário.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="px-4 py-2 bg-teal-400 text-zinc-900 font-bold rounded-xl hover:bg-teal-300 transition-all">
          + Novo Item
        </button>
      </div>

      {showForm && (
        <YuanStoreForm
          initial={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSave={save}
        />
      )}

      {loading && <p className="text-zinc-500 text-center py-8">Carregando...</p>}
      {!loading && items.length === 0 && (
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-8 text-center">
          <p className="text-zinc-500">Nenhum item cadastrado. Use "+ Novo Item" para adicionar.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger" id="yuan-fixed-grid">
        {items.map(it => (
          <div key={it.id} className={`bg-zinc-900 border rounded-xl p-4 lift ${it.isActive ? 'border-white/5' : 'border-red-500/20 opacity-60'}`}>
            <div className="flex items-start gap-3">
              <div className="text-3xl">{it.icon || '📦'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold truncate">{it.name}</span>
                  <span className={`text-xs ${RARITY_COLOR[it.rarity] || RARITY_COLOR.common}`}>{it.rarity}</span>
                </div>
                <p className="text-sm text-zinc-400 mb-2 line-clamp-2">{it.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded-full">💰 {it.priceYuan} Yuan</span>
                  <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">Lv {it.minLevel}+</span>
                  <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{it.type}</span>
                  <span className="bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                    Stock: {it.stock === -1 ? '∞' : it.stock}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setEditing(it); setShowForm(true); }}
                className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs">✏️ Editar</button>
              <button onClick={() => toggle(it)}
                className={`flex-1 py-1.5 rounded-lg text-xs ${it.isActive ? 'bg-yellow-500/15 text-yellow-400' : 'bg-teal-500/15 text-teal-400'}`}>
                {it.isActive ? '⏸️ Desativar' : '▶️ Ativar'}
              </button>
              <button onClick={() => del(it.id)}
                className="px-3 py-1.5 bg-red-500/15 text-red-400 rounded-lg text-xs">🗑️</button>
            </div>
          </div>
        ))}
      </div>
      </div>
    )}
    </div>
  );
}

function YuanStoreForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState({
    name:        initial?.name || '',
    description: initial?.description || '',
    type:        initial?.type || 'item',
    icon:        initial?.icon || '📦',
    priceYuan:   initial?.priceYuan ?? 100,
    minLevel:    initial?.minLevel ?? 1,
    rarity:      initial?.rarity || 'common',
    stock:       initial?.stock ?? -1,
  });

  // Catálogos (items + skills) carregados conforme tipo
  const [itemsCatalog, setItemsCatalog] = useState([]);
  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [pickFromCatalog, setPickFromCatalog] = useState(false);
  const [selectedFromCatalog, setSelectedFromCatalog] = useState('');

  // Mapeamento de tipo do form -> filtro do catálogo de items
  const itemTypeFilter = (form.type === 'consumable' ? 'consumable' : '');

  // Carrega o catálogo apropriado quando o tipo muda
  useEffect(() => {
    if (!pickFromCatalog) return;
    setLoadingCatalog(true);

    if (form.type === 'skill') {
      fetch(`${API}/api/admin/skills-catalog`, { headers: authHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then(d => setSkillsCatalog(Array.isArray(d) ? d : []))
        .catch(() => setSkillsCatalog([]))
        .finally(() => setLoadingCatalog(false));
    } else {
      const url = itemTypeFilter
        ? `${API}/api/admin/items-catalog?type=${itemTypeFilter}`
        : `${API}/api/admin/items-catalog`;
      fetch(url, { headers: authHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then(d => setItemsCatalog(Array.isArray(d) ? d : []))
        .catch(() => setItemsCatalog([]))
        .finally(() => setLoadingCatalog(false));
    }
  }, [form.type, pickFromCatalog]);

  // Quando seleciona algo do catálogo → preenche os campos
  const applyCatalogSelection = (selectedName) => {
    setSelectedFromCatalog(selectedName);
    if (!selectedName) return;

    if (form.type === 'skill') {
      const skill = skillsCatalog.find(s => s.name === selectedName);
      if (!skill) return;
      setForm(f => ({
        ...f,
        name: skill.name,
        description: `${skill.description} (skill:${skill.id})`,
        icon: skill.icon || '✨',
        minLevel: skill.minLevel || 1,
        rarity: skill.rarity || 'common',
        priceYuan: skill.suggestedPrice || 100,
      }));
    } else {
      const item = itemsCatalog.find(i => i.name === selectedName);
      if (!item) return;

      const ICON_BY_TYPE = {
        weapon: '⚔️', armor: '🛡️', amulet: '📿',
        consumable: '🧪', material: '💎',
      };
      // Loja Yuan só aceita common/uncommon/rare; mapear épico/lendário p/ raro
      const RARITY_MAP = {
        common: 'common', uncommon: 'uncommon',
        rare: 'rare', epic: 'rare', legendary: 'rare',
      };
      setForm(f => ({
        ...f,
        name: item.name,
        description: `${item.name} — ${item.element}/${item.rarity}. Item do catálogo do RPG.`,
        icon: ICON_BY_TYPE[item.type] || '📦',
        minLevel: item.minLevel || 1,
        rarity: RARITY_MAP[item.rarity] || 'common',
        priceYuan: Math.max(1, item.price || 100),
      }));
    }
  };

  const submit = () => {
    if (!form.name || !form.description) { alert('Preencha nome e descrição'); return; }
    onSave(form);
  };

  // Catálogo a exibir no dropdown
  const currentCatalog = form.type === 'skill' ? skillsCatalog : itemsCatalog;

  return (
    <div className="bg-zinc-900 border border-teal-500/30 rounded-2xl p-5 mb-5">
      <h3 className="font-bold mb-4">{initial?.id ? 'Editar Item' : 'Novo Item da Loja Yuan'}</h3>
      <div className="space-y-3">

        {/* Toggle catálogo (apenas em criação) */}
        {!initial?.id && (
          <div className="bg-zinc-800/60 border border-white/5 rounded-xl p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={pickFromCatalog}
                onChange={e => {
                  setPickFromCatalog(e.target.checked);
                  if (!e.target.checked) setSelectedFromCatalog('');
                }}
                className="w-4 h-4 accent-teal-400" />
              <span className="text-sm font-semibold">📚 Selecionar do catálogo do RPG</span>
            </label>
            <p className="text-xs text-zinc-500 mt-1 ml-6">
              {form.type === 'skill'
                ? 'Mostra todas as skills cadastradas. Preenche nome, descrição com skill:id, ícone, custo de chi, etc.'
                : 'Mostra itens cadastrados (filtrados pelo tipo). Preenche nome, descrição, ícone, raridade e preço base.'}
            </p>
          </div>
        )}

        {/* Tipo (sempre disponível) */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo *">
            <select value={form.type}
              onChange={e => {
                setForm({ ...form, type: e.target.value });
                setSelectedFromCatalog('');
              }}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
              <option value="item">Item</option>
              <option value="consumable">Consumível</option>
              <option value="skill">Skill</option>
            </select>
          </Field>

          <Field label="Raridade">
            <select value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm">
              <option value="common">Comum</option>
              <option value="uncommon">Incomum</option>
              <option value="rare">Raro</option>
            </select>
          </Field>
        </div>

        {/* Dropdown do catálogo */}
        {!initial?.id && pickFromCatalog && (
          <Field label={`Selecionar do catálogo (${form.type === 'skill' ? 'skills' : form.type === 'consumable' ? 'consumíveis' : 'items'})`}>
            <select value={selectedFromCatalog}
              onChange={e => applyCatalogSelection(e.target.value)}
              className="w-full bg-zinc-800 border border-teal-400/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
              <option value="">— Escolha do catálogo —</option>
              {loadingCatalog && <option disabled>Carregando...</option>}
              {!loadingCatalog && currentCatalog.length === 0 && (
                <option disabled>Nenhum item disponível neste tipo</option>
              )}
              {currentCatalog.map(it => {
                const desc = form.type === 'skill'
                  ? `${it.icon} ${it.name} · ${it.element} · Lv ${it.minLevel}+ · ${it.baseDamageMin}-${it.baseDamageMax} dmg`
                  : `${it.name} · ${it.element} · ${it.rarity} · Lv ${it.minLevel}+`;
                return <option key={it.id || it.name} value={it.name}>{desc}</option>;
              })}
            </select>
            <p className="text-xs text-zinc-500 mt-1">
              💡 Após selecionar, os campos abaixo são pré-preenchidos. Você pode editar antes de salvar.
            </p>
          </Field>
        )}

        {/* Ícone + Nome */}
        <div className="grid grid-cols-4 gap-3">
          <Field label="Ícone">
            <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-center text-xl" />
          </Field>
          <div className="col-span-3">
            <Field label="Nome *">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
            </Field>
          </div>
        </div>

        {/* Descrição */}
        <Field label="Descrição *">
          <textarea value={form.description} rows={3}
            onChange={e => setForm({ ...form, description: e.target.value })}
            className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400" />
          {form.type === 'skill' && (
            <p className="text-xs text-amber-300 mt-1">
              💡 Para skills, a descrição precisa conter <code className="bg-zinc-800 px-1 rounded">skill:id_da_skill</code> (ex: skill:dobra_fogo).
              Quando você seleciona do catálogo, isso é adicionado automaticamente.
            </p>
          )}
        </Field>

        {/* Preço, Nível, Stock */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Preço (Yuan) *">
            <input type="number" min="1" value={form.priceYuan}
              onChange={e => setForm({ ...form, priceYuan: parseInt(e.target.value) || 1 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Nível mínimo">
            <input type="number" min="1" max="100" value={form.minLevel}
              onChange={e => setForm({ ...form, minLevel: parseInt(e.target.value) || 1 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Stock (-1 = ∞)">
            <input type="number" value={form.stock}
              onChange={e => setForm({ ...form, stock: parseInt(e.target.value) || -1 })}
              className="w-full bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm" />
          </Field>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={submit}
            className="flex-1 py-2 bg-teal-400 text-zinc-900 font-bold rounded-lg hover:bg-teal-300">
            {initial?.id ? 'Salvar' : 'Criar'}
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
// ══════════════════��════════════════════════════
// PAINEL DE PREMIUM
// Permite ao admin conceder ou revogar premium (user/server) manualmente.
// Usa os endpoints /api/admin/premium/{search,grant,revoke,active}.
function PremiumPanel() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);

  const [planType, setPlanType] = useState('premium_user');
  const [days, setDays] = useState(30);
  const [granting, setGranting] = useState(false);

  const [activeList, setActiveList] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);

  const loadActive = async () => {
    setLoadingActive(true);
    try {
      const res = await fetch(`${API}/api/admin/premium/active`, { headers: authHeaders() });
      const data = await res.json();
      setActiveList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingActive(false);
    }
  };

  useEffect(() => { loadActive(); }, []);

  const doSearch = async () => {
    const q = search.trim();
    if (!q) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`${API}/api/admin/premium/search?q=${encodeURIComponent(q)}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      alert('❌ Erro ao buscar usuário');
    } finally {
      setSearching(false);
    }
  };

  const doGrant = async () => {
    if (!selected) { alert('Selecione um usuário primeiro.'); return; }
    const planLabel = planType === 'premium_user' ? 'Premium Usuário' : 'Premium Servidor';
    if (!confirm(`Conceder ${planLabel} a ${selected.username} por ${days} dias?`)) return;

    setGranting(true);
    try {
      const res = await fetch(`${API}/api/admin/premium/grant`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ discordId: selected.discordId, planType, days: parseInt(days) }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        // atualiza o card do selecionado e a lista
        setSelected({ ...selected, currentPlan: planType, expiresAt: data.subscription.expiresAt });
        loadActive();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (e) {
      alert('❌ Erro de conexão');
    } finally {
      setGranting(false);
    }
  };

  const doRevoke = async (user = selected) => {
    if (!user) return;
    if (!confirm(`Revogar premium ativo de ${user.username}?`)) return;
    setGranting(true);
    try {
      const res = await fetch(`${API}/api/admin/premium/revoke`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ discordId: user.discordId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        if (selected?.discordId === user.discordId) {
          setSelected({ ...selected, currentPlan: 'free', expiresAt: null });
        }
        loadActive();
      } else {
        alert(`❌ ${data.error}`);
      }
    } finally {
      setGranting(false);
    }
  };

  const PLAN_META = {
    free:           { label: '🆓 Free',              color: 'bg-zinc-800 text-zinc-300' },
    premium_user:   { label: '⭐ Premium Usuário',    color: 'bg-amber-500/20 text-amber-300' },
    premium_server: { label: '👑 Premium Servidor',   color: 'bg-purple-500/20 text-purple-300' },
  };

  return (
    <div className="space-y-5">
      {/* ══════ GRID 1: BUSCA + CONCESSÃO ══════ */}
      <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-3xl">💎</div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-400 mb-1">Conceder Premium</h3>
            <p className="text-xs text-zinc-400">
              Busque um usuário pelo <strong>username</strong> ou <strong>Discord ID</strong>, selecione-o,
              escolha o tipo de plano e a duração. O plano substitui qualquer assinatura ativa anterior.
            </p>
          </div>
        </div>

        {/* Busca */}
        <div className="flex gap-2 mb-4">
          <input value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Username ou Discord ID..."
            className="flex-1 bg-zinc-800 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
          <button onClick={doSearch} disabled={searching}
            className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-bold disabled:opacity-50">
            {searching ? '⏳' : '🔍 Buscar'}
          </button>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-zinc-500 mb-2">
              {results.length} resultado{results.length !== 1 ? 's' : ''} — clique pra selecionar:
            </p>
            {results.map(u => {
              const isSelected = selected?.id === u.id;
              const meta = PLAN_META[u.currentPlan] || PLAN_META.free;
              return (
                <button key={u.id} onClick={() => setSelected(u)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                    ${isSelected
                      ? 'bg-amber-500/10 border-2 border-amber-500/40'
                      : 'bg-zinc-800 border border-white/5 hover:border-amber-400/30'}`}>
                  <img src={u.avatar || 'https://via.placeholder.com/40'} alt=""
                    className="w-10 h-10 rounded-xl flex-shrink-0"
                    onError={e => { e.target.src = 'https://via.placeholder.com/40'; }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{u.username}</div>
                    <div className="text-xs text-zinc-500 font-mono truncate">{u.discordId}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${meta.color}`}>
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Usuário selecionado + form de grant */}
        {selected && (
          <div className="bg-zinc-800 border border-amber-500/30 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <img src={selected.avatar || 'https://via.placeholder.com/48'} alt=""
                className="w-12 h-12 rounded-xl"
                onError={e => { e.target.src = 'https://via.placeholder.com/48'; }} />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{selected.username}</div>
                <div className="text-xs text-zinc-500 font-mono truncate">{selected.discordId}</div>
              </div>
              {(() => {
                const meta = PLAN_META[selected.currentPlan] || PLAN_META.free;
                return (
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${meta.color}`}>
                    {meta.label}
                  </span>
                );
              })()}
            </div>

            {selected.expiresAt && (
              <p className="text-xs text-zinc-500">
                Expira em: <strong className="text-zinc-300">
                  {new Date(selected.expiresAt).toLocaleDateString('pt-BR')}
                </strong>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de Plano">
                <select value={planType} onChange={e => setPlanType(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm">
                  <option value="premium_user">⭐ Premium Usuário</option>
                  <option value="premium_server">👑 Premium Servidor</option>
                </select>
              </Field>
              <Field label="Duração">
                <select value={days} onChange={e => setDays(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm">
                  <option value="7">7 dias (trial)</option>
                  <option value="30">30 dias (1 mês)</option>
                  <option value="90">90 dias (3 meses)</option>
                  <option value="180">180 dias (6 meses)</option>
                  <option value="365">365 dias (1 ano)</option>
                </select>
              </Field>
            </div>

            <div className="flex gap-2">
              <button onClick={doGrant} disabled={granting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded-lg text-sm disabled:opacity-50">
                {granting ? '⏳ Processando...' : '💎 Conceder Premium'}
              </button>
              {selected.currentPlan !== 'free' && (
                <button onClick={() => doRevoke()} disabled={granting}
                  className="px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-lg text-sm font-bold disabled:opacity-50">
                  🗑️ Revogar
                </button>
              )}
              <button onClick={() => setSelected(null)} disabled={granting}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-700 rounded-lg text-sm">
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════ GRID 2: ASSINATURAS ATIVAS ══════ */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold">📋 Assinaturas Ativas</h3>
            <p className="text-xs text-zinc-500">Últimas 30 · ordenadas por mais recentes</p>
          </div>
          <button onClick={loadActive}
            className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg">
            🔄 Recarregar
          </button>
        </div>

        {loadingActive && <p className="text-zinc-500 text-center py-6">Carregando...</p>}

        {!loadingActive && activeList.length === 0 && (
          <p className="text-zinc-500 text-center py-6">Nenhuma assinatura ativa.</p>
        )}

        <div className="space-y-2">
          {activeList.map(s => {
            const meta = PLAN_META[s.planType] || PLAN_META.free;
            const expiresIn = s.expiresAt
              ? Math.max(0, Math.round((new Date(s.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
              : null;
            return (
              <div key={s.id} className="bg-zinc-800 border border-white/5 rounded-xl p-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <img src={s.user?.avatar || 'https://via.placeholder.com/40'} alt=""
                  className="w-10 h-10 rounded-xl flex-shrink-0"
                  onError={e => { e.target.src = 'https://via.placeholder.com/40'; }} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.user?.username}</div>
                  <div className="text-xs text-zinc-500 font-mono truncate">{s.user?.discordId}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${meta.color}`}>
                  {meta.label}
                </span>
                <div className="text-xs text-zinc-400 whitespace-nowrap">
                  {expiresIn !== null ? `${expiresIn}d restantes` : 'sem expiração'}
                </div>
                <button onClick={() => doRevoke({
                    username: s.user?.username || 'usuário',
                    discordId: s.user?.discordId,
                  })}
                  className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold">
                  🗑️ Revogar
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// PAINEL DE AÇÕES
function ActionsPanel() {
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupTarget, setCleanupTarget] = useState('');
  const [cleanupWorking, setCleanupWorking] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const [forceRefreshWorking, setForceRefreshWorking] = useState(false);
  const [forceRefreshResult, setForceRefreshResult] = useState(null);

  const giveYuan = async () => {
    const discordId = prompt('Discord ID do usuário:');
    const amount    = prompt('Quantidade de Yuan:');
    if (!discordId || !amount) return;
    const res = await fetch(`${API}/api/admin/give-yuan`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ discordId, amount: parseInt(amount) }),
    });
    if (res.ok) alert('✅ Yuan enviado!');
    else alert('❌ Erro');
  };
  const banUser = async () => {
    const discordId = prompt('Discord ID do usuário a banir:');
    const motivo    = prompt('Motivo:');
    if (!discordId) return;
    const res = await fetch(`${API}/api/admin/ban`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ discordId, motivo: motivo || 'Sem motivo' }),
    });
    if (res.ok) alert('🔨 Usuário banido');
    else alert('❌ Erro');
  };
  const resetUser = async () => {
    const discordId = prompt('Discord ID do usuário a resetar:');
    if (!discordId || !confirm(`Resetar ${discordId}? TODO progresso será perdido.`)) return;
    const res = await fetch(`${API}/api/admin/reset`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ discordId }),
    });
    if (res.ok) alert('♻️ Personagem resetado');
    else alert('❌ Erro');
  };

  const doCleanupSkills = async () => {
    const target = cleanupTarget.trim();
    if (!target) { alert('Informe Discord ID ou username'); return; }
    setCleanupWorking(true);
    setCleanupResult(null);
    try {
      const body = /^\d{17,20}$/.test(target)
        ? { discordId: target }
        : { username: target };
      const res = await fetch(`${API}/api/admin/cleanup-character-skills`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) setCleanupResult(data.character);
      else alert(`❌ ${data.error || 'Erro'}${data.detail ? ': ' + data.detail : ''}`);
    } catch (e) {
      alert('❌ Erro de conexão');
    } finally {
      setCleanupWorking(false);
    }
  };

  const doForceDailyRefresh = async () => {
    if (!confirm('Re-rolar a Loja Yuan de hoje? Os 6 produtos atuais serão substituídos.')) return;
    setForceRefreshWorking(true);
    setForceRefreshResult(null);
    try {
      const res = await fetch(`${API}/api/admin/force-daily-refresh`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) setForceRefreshResult(data);
      else alert(`❌ ${data.error || 'Erro'}${data.detail ? ': ' + data.detail : ''}`);
    } catch (e) {
      alert('❌ Erro de conexão');
    } finally {
      setForceRefreshWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      {}
      <div className="bg-gradient-to-br from-teal-500/5 to-purple-500/5 border border-teal-500/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🛠️</div>
          <div>
            <h3 className="font-bold text-teal-300 mb-1">Ferramentas de faxina</h3>
            <p className="text-xs text-zinc-400">Resolve casos pontuais — não destrutivas, podem ser usadas a qualquer hora.</p>
          </div>
        </div>

        {}
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
          <h4 className="text-sm font-bold text-white mb-1">🧹 Limpar skills incompatíveis</h4>
          <p className="text-xs text-zinc-400 mb-3">
            Remove skills do <code className="bg-zinc-800 px-1 rounded">unlockedSkills</code> que não combinam
            com o elemento do personagem. Útil pra contas pré-v6.4 que ficaram com skills "fantasma".
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input value={cleanupTarget}
              onChange={e => setCleanupTarget(e.target.value)}
              placeholder="Discord ID ou username"
              className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            <button onClick={doCleanupSkills} disabled={cleanupWorking}
              className="px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
              {cleanupWorking ? '⏳ Limpando...' : '🧹 Limpar'}
            </button>
          </div>
          {cleanupResult && (
            <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 text-xs space-y-2 mt-2">
              <div className="font-bold text-teal-300">✅ Faxina concluída</div>
              <div>Elemento: <strong>{cleanupResult.element}</strong></div>
              <div>
                Skills antes: <strong>{cleanupResult.before.unlockedSkills.length}</strong> · 
                depois: <strong>{cleanupResult.after.unlockedSkills.length}</strong>
              </div>
              {cleanupResult.removed.unlockedSkills.length > 0 && (
                <div className="text-red-300">
                  Removidas: {cleanupResult.removed.unlockedSkills.join(', ')}
                </div>
              )}
              {cleanupResult.removed.equippedSkills.length > 0 && (
                <div className="text-amber-300">
                  Desequipadas: {cleanupResult.removed.equippedSkills.join(', ')}
                </div>
              )}
              <button onClick={() => setCleanupResult(null)}
                className="text-zinc-500 hover:text-white text-xs">Fechar</button>
            </div>
          )}
        </div>

        {/* Force daily refresh */}
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
          <h4 className="text-sm font-bold text-white mb-1">🏬 Re-rolar Loja Yuan agora</h4>
          <p className="text-xs text-zinc-400 mb-3">
            Substitui os 6 produtos do dia atual. A loja normalmente renova à meia-noite UTC
            (21h em Brasília). Use isto pra forçar troca antes do horário automático.
          </p>
          <button onClick={doForceDailyRefresh} disabled={forceRefreshWorking}
            className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-bold transition-all disabled:opacity-50">
            {forceRefreshWorking ? '⏳ Re-rolando...' : '🎲 Re-rolar agora'}
          </button>
          {forceRefreshResult && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
              <div className="font-bold text-amber-300 mb-2">✅ Re-rolada · {forceRefreshResult.date}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {forceRefreshResult.products.map((p, i) => (
                  <div key={i} className="bg-zinc-900/50 rounded px-2 py-1">
                    {p.icon} {p.name} <span className="text-zinc-500">({p.element})</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setForceRefreshResult(null)}
                className="mt-2 text-zinc-500 hover:text-white text-xs">Fechar</button>
            </div>
          )}
        </div>
      </div>

      {/* AÇÕES RÁPIDAS clássicas */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5">
        <h2 className="font-semibold mb-4">🔧 Ações Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={giveYuan}
            className="py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-xl text-sm font-semibold transition-all">
            💰 Dar Yuan a Usuário
          </button>
          <button onClick={banUser}
            className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold transition-all">
            🔨 Banir Usuário
          </button>
          <button onClick={resetUser}
            className="py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl text-sm font-semibold transition-all">
            ♻️ Resetar Personagem
          </button>
          <button onClick={() => alert('Em breve')}
            className="py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-sm font-semibold transition-all">
            📢 Anúncio Global
          </button>
        </div>
      </div>
    </div>
  );
}

function ClanWarPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', startsAt: '', endsAt: '', launchNow: true,
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/clan-war`, { headers: authHeaders() });
      if (res.ok) setEvents(await res.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { alert('Informe o nome do evento.'); return; }
    if (!form.endsAt) { alert('Informe a data de término.'); return; }
    if (!form.launchNow && !form.startsAt) { alert('Informe a data de início (ou marque "lançar agora").'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/clan-war`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        setShowCreate(false);
        setForm({ name: '', description: '', startsAt: '', endsAt: '', launchNow: true });
        load();
      } else alert(`❌ ${data.error}`);
    } finally { setBusy(false); }
  };

  const setStatus = async (id, status) => {
    if (!confirm(`Mudar status do evento para "${status}"?`)) return;
    const res = await fetch(`${API}/api/admin/clan-war/${id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (res.ok) { load(); }
    else alert('Erro ao atualizar status.');
  };

  const remove = async (id) => {
    if (!confirm('Deletar este evento? Não pode ser desfeito.')) return;
    const res = await fetch(`${API}/api/admin/clan-war/${id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) load();
    else alert('Erro ao deletar.');
  };

  const STATUS_BADGE = {
    scheduled: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    active:    'bg-teal-500/15 text-teal-300 border-teal-500/30',
    finished:  'bg-zinc-700/30 text-zinc-400 border-zinc-600/30',
  };

  return (
    <div>
      <div className="bg-zinc-900 border border-white/5 rounded-xl p-4 mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">⚔️ Batalha de Clãs</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Lance eventos cronometrados. Durante a janela "active", os clãs podem se enfrentar e pontuar.
          </p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className="px-4 py-2 bg-teal-400 text-zinc-900 font-bold rounded-xl hover:bg-teal-300 transition">
          {showCreate ? '✕ Cancelar' : '+ Novo Evento'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-zinc-900 border border-teal-500/20 rounded-xl p-4 mb-5 space-y-3">
          <Field label="Nome do evento *">
            <input value={form.name} maxLength={80}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Batalha das Quatro Nações"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Descrição (opcional)">
            <textarea value={form.description} maxLength={500} rows="2"
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Explique as regras, prêmios..."
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="launchNow" checked={form.launchNow}
              onChange={e => setForm({ ...form, launchNow: e.target.checked })} />
            <label htmlFor="launchNow" className="text-sm text-zinc-300">🚀 Lançar agora (ignora data de início)</label>
          </div>
          {!form.launchNow && (
            <Field label="Início *">
              <input type="datetime-local" value={form.startsAt}
                onChange={e => setForm({ ...form, startsAt: e.target.value })}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </Field>
          )}
          <Field label="Término *">
            <input type="datetime-local" value={form.endsAt}
              onChange={e => setForm({ ...form, endsAt: e.target.value })}
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <button onClick={create} disabled={busy}
            className="w-full py-3 bg-teal-400 text-zinc-900 font-bold rounded-xl hover:bg-teal-300 disabled:opacity-50">
            {busy ? '⏳ Lançando...' : form.launchNow ? '🚀 Lançar Evento' : '📅 Agendar Evento'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 py-10 text-center">Carregando eventos...</p>
      ) : events.length === 0 ? (
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-10 text-center">
          <div className="text-4xl mb-2">⚔️</div>
          <p className="text-zinc-500">Nenhum evento ainda. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-zinc-900 border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold truncate">{ev.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[ev.status] || ''}`}>
                      {ev.status}
                    </span>
                  </div>
                  {ev.description && <p className="text-xs text-zinc-400 mt-1">{ev.description}</p>}
                  <p className="text-xs text-zinc-500 mt-1">
                    📅 {new Date(ev.startsAt).toLocaleString('pt-BR')} → {new Date(ev.endsAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mt-3">
                {ev.status === 'scheduled' && (
                  <button onClick={() => setStatus(ev.id, 'active')}
                    className="text-xs px-3 py-1.5 bg-teal-500/15 text-teal-300 rounded-lg hover:bg-teal-500/25 border border-teal-500/30">
                    🚀 Lançar agora
                  </button>
                )}
                {ev.status === 'active' && (
                  <button onClick={() => setStatus(ev.id, 'finished')}
                    className="text-xs px-3 py-1.5 bg-zinc-700/50 text-zinc-300 rounded-lg hover:bg-zinc-700 border border-white/10">
                    🏁 Encerrar
                  </button>
                )}
                <button onClick={() => remove(ev.id)}
                  className="text-xs px-3 py-1.5 bg-red-500/15 text-red-300 rounded-lg hover:bg-red-500/25 border border-red-500/30 ml-auto">
                  🗑️ Deletar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FutureUpdatesPanel() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [form, setForm] = useState(emptyNoteForm());
  const [busy, setBusy] = useState(false);

  function emptyNoteForm() {
    return {
      category: 'skill', title: '', element: '', description: '',
      metadata: { damage: '', chiCost: '', cooldown: '', value: '', notes: '' },
      pinned: false,
    };
  }

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/notes`, { headers: authHeaders() });
      if (res.ok) setNotes(await res.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const startEdit = (note) => {
    setEditing(note.id);
    setForm({
      category: note.category,
      title: note.title,
      element: note.element || '',
      description: note.description || '',
      metadata: { damage: '', chiCost: '', cooldown: '', value: '', notes: '', ...(note.metadata || {}) },
      pinned: !!note.pinned,
    });
  };
  const startNew = () => {
    setEditing('new');
    setForm(emptyNoteForm());
  };
  const cancel = () => { setEditing(null); setForm(emptyNoteForm()); };

  const save = async () => {
    if (!form.title.trim()) { alert('Título obrigatório.'); return; }
    setBusy(true);
    try {
      const url = editing === 'new'
        ? `${API}/api/admin/notes`
        : `${API}/api/admin/notes/${editing}`;
      const method = editing === 'new' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method, headers: authHeaders(), body: JSON.stringify(form),
      });
      if (res.ok) { cancel(); load(); }
      else alert('Erro ao salvar nota.');
    } finally { setBusy(false); }
  };

  const togglePin = async (note) => {
    const res = await fetch(`${API}/api/admin/notes/${note.id}`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    if (res.ok) load();
  };

  const remove = async (id) => {
    if (!confirm('Deletar esta nota? Não pode ser desfeito.')) return;
    const res = await fetch(`${API}/api/admin/notes/${id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    if (res.ok) load();
  };

  const filtered = filter === 'all' ? notes : notes.filter(n => n.category === filter);
  const CATEGORY = {
    skill:   { icon: '⚡', label: 'Skill', color: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
    item:    { icon: '📦', label: 'Item', color: 'text-teal-300 bg-teal-500/15 border-teal-500/30' },
    feature: { icon: '💡', label: 'Feature', color: 'text-purple-300 bg-purple-500/15 border-purple-500/30' },
    bug:     { icon: '🐛', label: 'Bug', color: 'text-red-300 bg-red-500/15 border-red-500/30' },
  };

  return (
    <div>
      <div className="bg-gradient-to-br from-purple-500/10 to-amber-500/10 border border-purple-500/20 rounded-xl p-4 mb-5">
        <h2 className="text-lg font-bold flex items-center gap-2">📝 Futuras Atualizações</h2>
        <p className="text-xs text-zinc-400 mt-1">
          Bloco de notas privado para planejar skills, itens e features. Nada aqui aparece em nenhum outro lugar do jogo — é só seu rascunho.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${filter === 'all' ? 'bg-zinc-700 text-white' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
          Todos ({notes.length})
        </button>
        {Object.entries(CATEGORY).map(([k, v]) => {
          const count = notes.filter(n => n.category === k).length;
          return (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === k ? v.color : 'bg-zinc-900 text-zinc-400 border-white/5'}`}>
              {v.icon} {v.label} ({count})
            </button>
          );
        })}
        <button onClick={startNew}
          className="ml-auto px-4 py-1.5 bg-teal-400 text-zinc-900 font-bold rounded-full text-xs hover:bg-teal-300 transition">
          + Nova nota
        </button>
      </div>

      {/* Editor */}
      {editing && (
        <div className="bg-zinc-900 border border-teal-500/30 rounded-xl p-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm">
                {Object.entries(CATEGORY).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Elemento (opcional)">
              <select value={form.element} onChange={e => setForm({ ...form, element: e.target.value })}
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm">
                <option value="">— Nenhum —</option>
                <option value="Fogo">🔥 Fogo</option>
                <option value="Água">💧 Água</option>
                <option value="Terra">🪨 Terra</option>
                <option value="Ar">🌬️ Ar</option>
                <option value="Neutro">⚪ Neutro</option>
              </select>
            </Field>
          </div>
          <Field label="Título *">
            <input value={form.title} maxLength={120}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: Tempestade de Areia (Terra)"
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Descrição / o que faz">
            <textarea value={form.description} rows="4" maxLength={5000}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Detalhe a mecânica, o efeito, observações..."
              className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono" />
          </Field>

          {/* Stats opcionais — útil principalmente para skills */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Field label="Dano">
              <input value={form.metadata.damage}
                onChange={e => setForm({ ...form, metadata: { ...form.metadata, damage: e.target.value } })}
                placeholder="20-35"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Chi">
              <input value={form.metadata.chiCost}
                onChange={e => setForm({ ...form, metadata: { ...form.metadata, chiCost: e.target.value } })}
                placeholder="15"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Cooldown">
              <input value={form.metadata.cooldown}
                onChange={e => setForm({ ...form, metadata: { ...form.metadata, cooldown: e.target.value } })}
                placeholder="2 turnos"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Valor / preço">
              <input value={form.metadata.value}
                onChange={e => setForm({ ...form, metadata: { ...form.metadata, value: e.target.value } })}
                placeholder="500 Yuan"
                className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="pinned" checked={form.pinned}
              onChange={e => setForm({ ...form, pinned: e.target.checked })} />
            <label htmlFor="pinned" className="text-sm text-zinc-300">📌 Fixar no topo</label>
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={busy}
              className="flex-1 py-2.5 bg-teal-400 text-zinc-900 font-bold rounded-xl hover:bg-teal-300 disabled:opacity-50">
              {busy ? '⏳ Salvando...' : editing === 'new' ? '✓ Criar nota' : '💾 Salvar'}
            </button>
            <button onClick={cancel}
              className="px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 border border-white/10">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-zinc-500 py-10 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-white/5 rounded-xl p-10 text-center">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-zinc-500">
            {notes.length === 0 ? 'Nenhuma nota ainda. Crie a primeira!' : 'Nenhuma nota nessa categoria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(note => {
            const cat = CATEGORY[note.category] || CATEGORY.skill;
            const meta = note.metadata || {};
            return (
              <div key={note.id} className={`bg-zinc-900 border rounded-xl p-4 ${note.pinned ? 'border-amber-500/30' : 'border-white/5'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cat.color}`}>
                        {cat.icon} {cat.label}
                      </span>
                      {note.element && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                          {note.element}
                        </span>
                      )}
                      {note.pinned && <span className="text-[10px]">📌</span>}
                    </div>
                    <h3 className="text-base font-bold mt-1">{note.title}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => togglePin(note)}
                      title={note.pinned ? 'Desafixar' : 'Fixar'}
                      className="text-xs px-2 py-1 hover:bg-zinc-800 rounded">
                      {note.pinned ? '📌' : '📍'}
                    </button>
                    <button onClick={() => startEdit(note)}
                      className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700">
                      ✏️
                    </button>
                    <button onClick={() => remove(note.id)}
                      className="text-xs px-2 py-1 bg-red-500/15 text-red-300 rounded hover:bg-red-500/25">
                      🗑️
                    </button>
                  </div>
                </div>
                {note.description && (
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans bg-zinc-800/40 rounded p-2 mt-2">
                    {note.description}
                  </pre>
                )}
                {(meta.damage || meta.chiCost || meta.cooldown || meta.value) && (
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    {meta.damage   && <span>🎯 <strong>{meta.damage}</strong></span>}
                    {meta.chiCost  && <span>💜 <strong>{meta.chiCost}</strong></span>}
                    {meta.cooldown && <span>⏱️ <strong>{meta.cooldown}</strong></span>}
                    {meta.value    && <span>💰 <strong>{meta.value}</strong></span>}
                  </div>
                )}
                <div className="text-[10px] text-zinc-500 mt-2">
                  Atualizada em {new Date(note.updatedAt).toLocaleString('pt-BR')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
      {children}
    </div>
  );
}