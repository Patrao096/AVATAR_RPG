// frontend/src/pages/Arena.jsx
// Arena com:
//   - Skills equipadas (loadout)
//   - Consumíveis equipados usáveis em batalha (não consome turno)
//   - Buffs ativos visíveis
//   - HUD com clan buff e equip bonus
import { useState, useEffect, useRef } from 'react';
import { useToast } from '../components/Toast';
import { authHeaders } from '../App';

const API = window.__API_URL__ || 'http://localhost:5000';
const ELEM_BAR  = { Fogo: 'bg-orange-400', 'Água': 'bg-sky-400', Terra: 'bg-green-400', Ar: 'bg-teal-300', default: 'bg-red-400' };
const ELEM_ICON = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' };

export default function Arena({ user }) {
  const [battle, setBattle] = useState(null);
  const [state, setState] = useState(null);
  const [log, setLog] = useState([]);
  // usamos um ref com o maior id de log já processado. Backend manda id sequencial.
  const lastSeenLogIdRef = useRef(0);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState(null);
  const [rewards, setRewards] = useState(null);
  const [searching, setSearching] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [queueStats, setQueueStats] = useState({ online: 0, queueSize: 0, waitSeconds: 8 });
  const [myRank, setMyRank] = useState(null);
  const [skills, setSkills] = useState([]);
  const [limits, setLimits] = useState(null);
  const { toast } = useToast();
  const [meEffect, setMeEffect] = useState(null);   // 'shake' | 'shake-hard' | 'crit-flash'
  const [oppEffect, setOppEffect] = useState(null);
  const [floatDmgs, setFloatDmgs] = useState([]);   // [{ id, side, value, isCrit }]

  const pollingRef = useRef(null);
  const endedRef = useRef(false);

  useEffect(() => {
    fetch(`${API}/api/battle/rank`, { headers: authHeaders() })
      .then(r => r.json()).then(setMyRank).catch(() => {});
    fetch(`${API}/api/battle/limits`, { headers: authHeaders() })
      .then(r => r.json()).then(setLimits).catch(() => {});
    loadQueueStats();
    const interval = setInterval(loadQueueStats, 10000);

    const pendingFriendly = sessionStorage.getItem('pendingFriendlyBattle');
    if (pendingFriendly) {
      sessionStorage.removeItem('pendingFriendlyBattle');
      try {
        const data = JSON.parse(pendingFriendly);
        setBattle(data);
        loadSkills(data.battleId);
        fetchState(data.battleId);
        startPollingIfNeeded(data.battleId);
      } catch (e) { console.error('pending friendly parse:', e); }
      return () => {
        clearInterval(interval);
        stopPolling();
      };
    }

    fetch(`${API}/api/battle/active`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.active) {
          setBattle(data);
          loadSkills(data.battleId);
          fetchState(data.battleId);
          startPollingIfNeeded(data.battleId);
        }
      })
      .catch(() => {});

    return () => {
      clearInterval(interval);
      stopPolling();
    };
  }, []);

  const loadQueueStats = async () => {
    try {
      const res = await fetch(`${API}/api/battle/queue/stats`);
      const data = await res.json();
      setQueueStats(data);
    } catch (e) {}
  };

  const loadSkills = async (battleId) => {
    try {
      const url = battleId
        ? `${API}/api/battle/skills?battleId=${battleId}`
        : `${API}/api/battle/skills`;
      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      setSkills(Array.isArray(data) ? data : []);
    } catch (e) { setSkills([]); }
  };

  const addLog = (msg, type = '') => {
    setLog(prev => [...prev.slice(-25), { msg, type, id: Date.now() + Math.random() }]);
  };

  const consumeLogs = (logs) => {
    if (!Array.isArray(logs) || logs.length === 0) return;
    // Filtra só os logs com id > último visto. Backend envia id sequencial,
    // então isso é à prova de polling duplicado / closures stale.
    const lastSeen = lastSeenLogIdRef.current;
    const fresh = logs.filter(l => typeof l.id === 'number' && l.id > lastSeen);
    if (fresh.length === 0) return;
    // Atualiza o ref ANTES de chamar addLog (que dispara setState e re-render).
    lastSeenLogIdRef.current = Math.max(lastSeen, ...fresh.map(l => l.id));

    for (const entry of fresh) {
      const attackerIsMe = entry.attackerSide === battle?.mySide;
      if (entry.consumable) {
        const desc = entry.consumableEffect || 'efeito';
        addLog(
          attackerIsMe ? `🧪 Você ${entry.skillName.toLowerCase()} → ${desc}` : `🧪 ${entry.attackerName} ${entry.skillName.toLowerCase()} → ${desc}`,
          'cons'
        );
      } else if (entry.isStatusTick) {
        addLog(entry.statusMessage || `Status tick`, 'status');
      } else if (entry.turnSkipped) {
        addLog(
          attackerIsMe ? `⏭️ Você perdeu o turno!` : `⏭️ ${entry.attackerName} perdeu o turno!`,
          'status'
        );
      } else if (entry.defending) {
        addLog(
          attackerIsMe ? `🛡️ Você defendeu.` : `🛡️ ${entry.attackerName} está defendendo.`,
          'def'
        );
      } else if (entry.isDodge) {
        addLog(
          attackerIsMe
            ? `💨 ${entry.skillIcon} ${entry.skillName} — ${state?.opponent?.name || 'Oponente'} esquivou!`
            : `💨 ${entry.attackerName} usou ${entry.skillIcon} ${entry.skillName}, mas você esquivou!`,
          'dodge'
        );
      } else {
        const prefix = attackerIsMe ? '⚔️ Você usou' : `🔥 ${entry.attackerName} usou`;
        const critTag = entry.isCrit ? ' 💥CRÍTICO!' : '';
        const elemTag = entry.elementalMult > 1.0
          ? ' 🔥 super-eficaz!'
          : entry.elementalMult < 1.0 ? ' 💢 pouco efetivo...' : '';
        const statusTag = entry.statusApplied
          ? ` ${entry.statusApplied.icon} ${entry.statusApplied.label} aplicado!`
          : '';
        addLog(
          `${prefix} ${entry.skillIcon} ${entry.skillName} — ${entry.damage} dano${critTag}${elemTag}${statusTag}`,
          entry.isCrit ? 'crit' : (attackerIsMe ? 'dmg' : 'enemy')
        );

        if (entry.damage > 0) {
          triggerHitAnimation({
            attackerIsMe,
            damage: entry.damage,
            isCrit: entry.isCrit,
          });
        }
      }
    }
  };

  const triggerHitAnimation = ({ attackerIsMe, damage, isCrit }) => {
    const defenderSide = attackerIsMe ? 'opp' : 'me';
    const attackerSide = attackerIsMe ? 'me' : 'opp';
    const setDef = defenderSide === 'me' ? setMeEffect : setOppEffect;
    const setAtk = attackerSide === 'me' ? setMeEffect : setOppEffect;

    // Shake no defensor (mais forte se crit)
    setDef(isCrit ? 'shake-hard' : 'shake');
    setTimeout(() => setDef(null), isCrit ? 600 : 400);

    // Crit-flash no atacante
    if (isCrit) {
      setAtk('crit-flash');
      setTimeout(() => setAtk(null), 600);
    }

    // Número flutuante de dano
    const id = Date.now() + Math.random();
    setFloatDmgs(curr => [...curr, { id, side: defenderSide, value: damage, isCrit }]);
    setTimeout(() => setFloatDmgs(curr => curr.filter(d => d.id !== id)), 1300);
  };

  const fetchState = async (battleId) => {
    try {
      const res = await fetch(`${API}/api/battle/state?battleId=${battleId}`, { headers: authHeaders() });
      if (!res.ok) {
        // /end, então 404 só acontece se: (a) batalha não existe; ou
        // (b) usuário ficou >60s sem polling. De toda forma, se a tela
        // ainda não terminou, considera derrota — não trava o jogador.
        if (res.status === 404) {
          stopPolling();
          if (!endedRef.current && battle) {
            await handleOutcome(false);
          }
        }
        return null;
      }
      const data = await res.json();
      setState(data);
      consumeLogs(data.logs);
      if (data.outcome && !endedRef.current) {
        stopPolling();
        await handleOutcome(data.outcome === 'won');
      }
      return data;
    } catch (e) {
      console.error('fetchState:', e);
    }
  };

  const startPollingIfNeeded = (battleId) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const data = await fetchState(battleId);
      if (!data || endedRef.current) {
        stopPolling();
        return;
      }
      if (data.isMyTurn) {
        stopPolling();
        loadSkills(battleId);
      }
    }, 1800);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const joinQueue = async () => {
    setSearching(true);
    try {
      const res = await fetch(`${API}/api/battle/queue/join`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao entrar na fila');
        if (data.requiresPremium) window.location.href = '/plans';
        return;
      }

      if (data.type === 'match') {
        setBattle(data);
        setLog([]);
        lastSeenLogIdRef.current = 0;
        setEnded(false);
        endedRef.current = false;
        setResult(null);
        setRewards(null);

        await loadSkills(data.battleId);
        const initialState = await fetchState(data.battleId);
        addLog(`⚔️ Batalha contra ${data.opponent.name}${data.opponent.isBot ? ' (BOT)' : ''}!`, 'info');
        if (initialState?.isMyTurn) {
          addLog('🎯 Seu turno!', 'info');
        } else {
          addLog('⏸️ Aguardando oponente...', 'info');
          startPollingIfNeeded(data.battleId);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Erro de conexão ao entrar na fila.');
    } finally {
      setSearching(false);
    }
  };

  const cancelQueue = async () => {
    try { await fetch(`${API}/api/battle/queue/leave`, { method: 'POST', headers: authHeaders() }); } catch {}
    setSearching(false);
  };

  const isMyTurn = state?.isMyTurn && !waiting && !ended;

  const useSkill = async (skill) => {
    if (!state || ended || !isMyTurn) return;
    if (skill.turnsRemaining > 0) { addLog(`⏳ ${skill.name} em cooldown.`, 'err'); return; }
    if (state.me.chi < skill.chiCost) { addLog('❌ Chi insuficiente!', 'err'); return; }

    setWaiting(true);
    try {
      const res = await fetch(`${API}/api/battle/use-skill`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ battleId: battle.battleId, skillId: skill.id }),
      });
      const data = await res.json();
      if (!res.ok) { addLog(`❌ ${data.error}`, 'err'); return; }

      setState(data.state);
      consumeLogs(data.logs);
      await loadSkills(battle.battleId);

      if (data.outcome === 'won') await handleOutcome(true);
      else if (data.outcome === 'lost') await handleOutcome(false);
      else if (battle.opponent && !battle.opponent.isBot) {
        startPollingIfNeeded(battle.battleId);
      }
    } catch (e) {
      addLog('❌ Erro de conexão.', 'err');
    } finally {
      setWaiting(false);
    }
  };

  const useConsumable = async (cons) => {
    if (!state || ended || !isMyTurn) return;
    if (cons.quantity <= 0) return;

    setWaiting(true);
    try {
      const res = await fetch(`${API}/api/battle/use-consumable`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ battleId: battle.battleId, consumableInventoryId: cons.inventoryId }),
      });
      const data = await res.json();
      if (!res.ok) { addLog(`❌ ${data.error}`, 'err'); return; }

      setState(data.state);
      consumeLogs(data.logs);
      // Consumível NÃO consome turno
    } catch (e) {
      addLog('❌ Erro de conexão.', 'err');
    } finally {
      setWaiting(false);
    }
  };

  const defendAction = async () => {
    if (!state || ended || !isMyTurn) return;
    setWaiting(true);
    try {
      const res = await fetch(`${API}/api/battle/defend`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ battleId: battle.battleId }),
      });
      const data = await res.json();
      if (!res.ok) { addLog(`❌ ${data.error}`, 'err'); return; }

      setState(data.state);
      consumeLogs(data.logs);
      await loadSkills(battle.battleId);

      if (data.outcome === 'won') await handleOutcome(true);
      else if (data.outcome === 'lost') await handleOutcome(false);
      else if (battle.opponent && !battle.opponent.isBot) {
        startPollingIfNeeded(battle.battleId);
      }
    } finally {
      setWaiting(false);
    }
  };

  const handleOutcome = async (won) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    setResult(won ? 'win' : 'lose');
    stopPolling();

    try {
      const res = await fetch(`${API}/api/battle/end`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          battleId: battle.battleId,
          opponentName: battle.opponent.name,
          opponentElement: battle.opponent.element,
          opponentElo: battle.opponent.elo || 500,
          result: won ? 'win' : 'lose',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRewards(data);
        const rankRes = await fetch(`${API}/api/battle/rank`, { headers: authHeaders() });
        if (rankRes.ok) setMyRank(await rankRes.json());
        const limitsRes = await fetch(`${API}/api/battle/limits`, { headers: authHeaders() });
        if (limitsRes.ok) setLimits(await limitsRes.json());
      }
    } catch (e) { console.error(e); }
  };

  const reset = () => {
    setBattle(null);
    setState(null);
    setEnded(false);
    endedRef.current = false;
    setResult(null);
    setRewards(null);
    setLog([]);
    lastSeenLogIdRef.current = 0;
  };

  const barColor = (elem) => ELEM_BAR[elem] || ELEM_BAR.default;

  if (user && (!user.element || user.element === 'Nenhum')) {
    return (
      <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border-2 border-amber-500/30 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4 animate-pulse">⚡</div>
          <h1 className="text-2xl font-bold text-amber-300 mb-3">Elemento ainda não despertou</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Complete o <strong>Capítulo 1 do Modo História</strong> para descobrir seu elemento.
          </p>
          <a href="/historia"
            className="inline-block px-6 py-3 bg-teal-400 hover:bg-teal-300 text-zinc-900 font-bold rounded-xl text-sm">
            📖 Ir para a História
          </a>
        </div>
      </div>
    );
  }

  if (!battle && limits && !limits.isPremium && limits.remaining === 0) {
    return (
      <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-zinc-900 border-2 border-purple-500/30 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">🕐</div>
          <h1 className="text-2xl font-bold text-purple-300 mb-3">Limite diário atingido</h1>
          <p className="text-zinc-400 text-sm mb-2">
            Você já fez suas <strong>{limits.dailyLimit} batalhas</strong> de hoje (plano Free).
          </p>
          <a href="/plans"
            className="inline-block mt-4 px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold rounded-xl text-sm">
            💎 Ver Planos
          </a>
        </div>
      </div>
    );
  }

  const myHp = state?.me.hp ?? battle?.player?.hp ?? 100;
  const myMaxHp = state?.me.maxHp ?? battle?.player?.maxHp ?? 100;
  const myChi = state?.me.chi ?? battle?.player?.chi ?? 50;
  const myMaxChi = state?.me.maxChi ?? battle?.player?.maxChi ?? 50;
  const oppHp = state?.opponent.hp ?? battle?.opponent?.maxHp ?? 100;
  const oppMaxHp = state?.opponent.maxHp ?? battle?.opponent?.maxHp ?? 100;
  const myConsumables = state?.me.consumables || [];
  const myBuffs = state?.me.buffs || [];
  const oppBuffs = state?.opponent.buffs || [];
  const myStatus = state?.me.statusEffects || [];
  const oppStatus = state?.opponent.statusEffects || [];
  const lastChiRegen = state?.me.lastChiRegen || 0;

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">⚔️ Arena Global</h1>
          {myRank && (
            <div className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2 lift">
              <span className="text-xl">{myRank.rank.icon}</span>
              <div>
                <div className="text-xs font-bold" style={{ color: myRank.rank.badge }}>{myRank.rank.name}</div>
                <div className="text-xs text-zinc-500 font-mono">{myRank.elo} ELO</div>
              </div>
            </div>
          )}
        </div>

        {!battle && limits && !limits.isPremium && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mb-5 text-sm text-center">
            Plano Free: <strong className="text-purple-300">{limits.remaining}</strong> de {limits.dailyLimit} batalhas restantes hoje.
          </div>
        )}

        {!battle ? (
          <div className="text-center py-10">
            <div className="text-8xl mb-6 animate-pulse">⚔️</div>
            <h2 className="text-2xl font-bold mb-3">
              {searching ? 'Procurando Oponente...' : 'Fila Global'}
            </h2>
            <p className="text-zinc-400 mb-6">
              {searching ? 'Buscando um Dobrador de ELO similar...' : 'Batalhas em turnos — 1 ação por vez.'}
            </p>

            <div className="bg-zinc-900 border border-purple-500/20 rounded-xl p-3 max-w-md mx-auto mb-4 text-xs text-zinc-400">
              💡 <strong>Dica:</strong> antes de batalhar, equipe suas skills e poções no <a href="/profile" className="text-teal-300 underline">Perfil → Loadout/Arena</a>.
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto mb-6">
              {[
                [queueStats.online || 0, 'Online'],
                [queueStats.queueSize || 0, 'Na fila'],
                [`~${queueStats.waitSeconds || 8}s`, 'Espera'],
                [user?.wins || 0, 'Vitórias'],
              ].map(([v, l]) => (
                <div key={l} className="bg-zinc-900 border border-white/5 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-teal-400">{typeof v === 'number' ? v.toLocaleString() : v}</div>
                  <div className="text-xs text-zinc-500">{l}</div>
                </div>
              ))}
            </div>

            {!searching ? (
              <button onClick={joinQueue}
                className="px-10 py-4 bg-gradient-to-r from-teal-400 to-cyan-400 text-zinc-900 font-bold text-lg rounded-2xl hover:scale-105 transition-all shadow-xl shadow-teal-500/25">
                ⚔️ ENTRAR NA FILA
              </button>
            ) : (
              <div className="space-y-3">
                <div className="inline-block px-8 py-4 bg-zinc-900 border border-teal-400/30 rounded-2xl">
                  <div className="text-teal-400 font-bold animate-pulse">🔍 Procurando...</div>
                </div>
                <div>
                  <button onClick={cancelQueue}
                    className="px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold">
                    Cancelar busca
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {}
            {(battle.isFriendly || state?.isFriendly) && (
              <div className="text-center mb-3 py-2 rounded-xl text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-200">
                🤝 Batalha Amistosa do Clã · sem ELO · 50% EXP
              </div>
            )}

            {/* Indicador de turno */}
            {!ended && (
              <div className={`text-center mb-4 py-2.5 rounded-xl text-sm font-bold relative overflow-hidden
                ${isMyTurn ? 'bg-teal-400/15 text-teal-300 border border-teal-400/30' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
                {isMyTurn && !waiting && (
                  <span className="absolute inset-0 bar-shimmer pointer-events-none" />
                )}
                <span className="relative">
                  {waiting ? '⏳ Processando...' :
                   isMyTurn ? `🎯 SEU TURNO (Turno ${state?.turnNumber || 1})` :
                   `⏸️ Turno do oponente...`}
                </span>
              </div>
            )}

            {/* VS cards */}
            <div className="grid grid-cols-3 gap-2 lg:gap-3 mb-5 items-center">
              {/* Player card */}
              <div className={`bg-zinc-900 border border-teal-500/25 rounded-2xl p-3 lg:p-4 text-center relative overflow-hidden lift
                ${meEffect === 'shake' ? 'shake' : ''}
                ${meEffect === 'shake-hard' ? 'shake-hard' : ''}
                ${meEffect === 'crit-flash' ? 'crit-flash' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/8 to-transparent pointer-events-none" />
                {}
                {floatDmgs.filter(d => d.side === 'me').map(d => (
                  <span key={d.id} className="float-damage left-1/2 top-1/2 -translate-x-1/2"
                        style={{ color: d.isCrit ? '#fde047' : '#fb923c' }}>
                    -{d.value}{d.isCrit && '💥'}
                  </span>
                ))}
                <div className={`w-14 h-14 lg:w-16 lg:h-16 mx-auto mb-2 lg:mb-3 rounded-full border-2 border-teal-400 flex items-center justify-center text-3xl lg:text-4xl bg-zinc-800 relative shadow-lg shadow-teal-500/20
                  ${isMyTurn ? 'turn-active' : ''}`}>
                  {ELEM_ICON[battle.player.element] || '⚔️'}
                </div>
                <p className="text-teal-400 text-xs font-semibold truncate relative">Você · Lv.{battle.player.level}</p>
                {battle.player.rank && (
                  <p className="text-[10px] mt-1 relative font-mono" style={{ color: battle.player.rank.badge }}>
                    {battle.player.rank.icon} {battle.player.rank.name}
                  </p>
                )}
                <div className="mt-2 relative">
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1 font-mono">
                    <span>HP</span><span>{myHp}/{myMaxHp}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor(battle.player.element)} hp-bar-smooth`}
                         style={{ width: `${(myHp / myMaxHp) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-1 mb-0.5 font-mono">
                    <span className="flex items-center gap-1">
                      Chi
                      {}
                      {lastChiRegen > 0 && (
                        <span key={`regen-${state?.turnNumber}-${lastChiRegen}`}
                              className="text-purple-300 text-[9px] font-bold animate-pulse">
                          +{lastChiRegen}
                        </span>
                      )}
                    </span>
                    <span>{myChi}/{myMaxChi}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 hp-bar-smooth"
                         style={{ width: `${(myChi / myMaxChi) * 100}%` }} />
                  </div>
                </div>
                {/* Buffs ativos */}
                {myBuffs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 justify-center relative">
                    {myBuffs.map((b, i) => (
                      <span key={i} className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">
                        {b.label} ({b.turnsRemaining}t)
                      </span>
                    ))}
                  </div>
                )}
                {}
                {myStatus.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 justify-center relative">
                    {myStatus.map((s, i) => (
                      <span key={i}
                        title={`${s.label}: ${s.turnsRemaining} turno(s) restante(s)`}
                        className="text-[10px] px-1.5 py-0.5 rounded-full border font-semibold"
                        style={{
                          color: s.color,
                          borderColor: `${s.color}66`,
                          background: `${s.color}1a`,
                        }}>
                        {s.icon} {s.label} {s.turnsRemaining}t
                      </span>
                    ))}
                  </div>
                )}
                {/* Bônus equipados/clã */}
                {(battle.player.equipBonus || battle.player.clanBuff) && (
                  <div className="mt-2 text-[9px] text-zinc-500 space-x-1 relative font-mono">
                    {(battle.player.equipBonus?.attack > 0 || battle.player.clanBuff?.attack > 0) && (
                      <span>⚔️+{(battle.player.equipBonus?.attack || 0) + (battle.player.clanBuff?.attack || 0)}</span>
                    )}
                    {(battle.player.equipBonus?.defense > 0 || battle.player.clanBuff?.defense > 0) && (
                      <span>🛡️+{(battle.player.equipBonus?.defense || 0) + (battle.player.clanBuff?.defense || 0)}</span>
                    )}
                  </div>
                )}
              </div>

              {/* VS badge */}
              <div className="text-center">
                <div className="relative w-10 h-10 lg:w-12 lg:h-12 mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-full shadow-lg shadow-orange-500/40 flex items-center justify-center font-black text-base lg:text-lg">
                    VS
                  </div>
                </div>
              </div>

              {/* Opponent card */}
              <div className={`bg-zinc-900 border border-red-500/25 rounded-2xl p-3 lg:p-4 text-center relative overflow-hidden lift
                ${oppEffect === 'shake' ? 'shake' : ''}
                ${oppEffect === 'shake-hard' ? 'shake-hard' : ''}
                ${oppEffect === 'crit-flash' ? 'crit-flash' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 to-transparent pointer-events-none" />
                {}
                {floatDmgs.filter(d => d.side === 'opp').map(d => (
                  <span key={d.id} className="float-damage left-1/2 top-1/2 -translate-x-1/2"
                        style={{ color: d.isCrit ? '#fde047' : '#fb923c' }}>
                    -{d.value}{d.isCrit && '💥'}
                  </span>
                ))}
                <div className={`w-14 h-14 lg:w-16 lg:h-16 mx-auto mb-2 lg:mb-3 rounded-full border-2 border-red-400 flex items-center justify-center text-3xl lg:text-4xl bg-zinc-800 relative shadow-lg shadow-red-500/20
                  ${!isMyTurn && !ended ? 'turn-active-enemy' : ''}`}>
                  {battle.opponent.icon || ELEM_ICON[battle.opponent.element] || '⚔️'}
                </div>
                <p className="text-red-400 text-xs font-semibold truncate relative">
                  {battle.opponent.name} · Lv.{battle.opponent.level || 1}
                </p>
                {battle.opponent.rank && (
                  <p className="text-[10px] mt-1 relative font-mono" style={{ color: battle.opponent.rank.badge }}>
                    {battle.opponent.rank.icon} {battle.opponent.rank.name}
                  </p>
                )}
                <div className="mt-2 relative">
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1 font-mono">
                    <span>HP</span><span>{oppHp}/{oppMaxHp}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor(battle.opponent.element)} hp-bar-smooth`}
                         style={{ width: `${(oppHp / (oppMaxHp || 100)) * 100}%` }} />
                  </div>
                </div>
                {oppBuffs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 justify-center relative">
                    {oppBuffs.map((b, i) => (
                      <span key={i} className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full border border-red-500/30">
                        {b.label} ({b.turnsRemaining}t)
                      </span>
                    ))}
                  </div>
                )}
                {}
                {oppStatus.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 justify-center relative">
                    {oppStatus.map((s, i) => (
                      <span key={i}
                        title={`${s.label}: ${s.turnsRemaining} turno(s)`}
                        className="text-[10px] px-1.5 py-0.5 rounded-full border font-semibold"
                        style={{
                          color: s.color,
                          borderColor: `${s.color}66`,
                          background: `${s.color}1a`,
                        }}>
                        {s.icon} {s.label} {s.turnsRemaining}t
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Log */}
            <div className="bg-black/50 border border-white/5 rounded-xl p-4 h-32 overflow-y-auto font-mono text-xs mb-4 space-y-1">
              {log.map(l => (
                <div key={l.id} className={
                  l.type === 'crit' ? 'text-yellow-300 font-bold' :
                  l.type === 'dodge' ? 'text-cyan-300 italic' :
                  l.type === 'status' ? 'text-orange-300 italic' :
                  l.type === 'dmg' ? 'text-orange-400' :
                  l.type === 'def' ? 'text-sky-400' :
                  l.type === 'enemy' ? 'text-red-400' :
                  l.type === 'info' ? 'text-teal-400' :
                  l.type === 'cons' ? 'text-purple-300' :
                  l.type === 'err' ? 'text-red-500' : 'text-zinc-400'
                }>{l.msg}</div>
              ))}
            </div>

            {ended ? (
              <div className={`text-center p-6 rounded-2xl border ${result === 'win' ? 'bg-teal-500/10 border-teal-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <div className="text-5xl mb-3">{result === 'win' ? '🏆' : '💥'}</div>
                <h2 className={`text-3xl font-bold mb-4 ${result === 'win' ? 'text-teal-400' : 'text-red-400'}`}>
                  {result === 'win' ? 'VITÓRIA!' : 'DERROTA'}
                </h2>
                {rewards && (
                  <>
                    <div className="flex flex-wrap justify-center gap-6 mb-4">
                      <div><div className="text-xl font-bold text-amber-400">+{rewards.expGained}</div><div className="text-xs text-zinc-500">EXP</div></div>
                      <div><div className="text-xl font-bold text-yellow-400">+{rewards.moneyGained}</div><div className="text-xs text-zinc-500">Yuan</div></div>
                      <div>
                        <div className={`text-xl font-bold ${rewards.eloChange > 0 ? 'text-teal-400' : 'text-red-400'}`}>
                          {rewards.eloChange > 0 ? '+' : ''}{rewards.eloChange}
                        </div>
                        <div className="text-xs text-zinc-500">ELO</div>
                      </div>
                      {rewards.leveled && <div><div className="text-xl font-bold text-purple-400">🆙</div><div className="text-xs text-zinc-500">Level Up!</div></div>}
                    </div>
                    {rewards.rankUp && (
                      <div className="bg-teal-500/20 border border-teal-500/40 rounded-xl p-3 mb-4">
                        <div className="text-teal-300 font-bold">🎉 PROMOVIDO PARA {rewards.rank.name.toUpperCase()}!</div>
                      </div>
                    )}
                    {rewards.rankDown && (
                      <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 mb-4">
                        <div className="text-red-300 font-bold">⚠️ Rebaixado para {rewards.rank.name}</div>
                      </div>
                    )}
                  </>
                )}
                <button onClick={reset}
                  className="px-8 py-3 bg-gradient-to-r from-teal-400 to-cyan-400 text-zinc-900 font-bold rounded-xl hover:scale-105 transition-all">
                  Nova Batalha
                </button>
              </div>
            ) : (
              <>
                {/* Skills + Soco */}
                {skills.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-zinc-500 mb-2">Suas ações</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {skills.map(skill => {
                        const onCooldown = skill.turnsRemaining > 0;
                        const lowChi     = myChi < skill.chiCost;
                        const disabled   = !isMyTurn || onCooldown || lowChi || waiting;
                        const isBasic = skill.id === 'ataque_basico';
                        const enabledStyle = isBasic
                          ? 'bg-zinc-700/40 hover:bg-zinc-600/50 border-zinc-500/40 text-zinc-100'
                          : 'bg-teal-400/10 hover:bg-teal-400/20 border-teal-400/25 text-teal-300';
                        return (
                          <button key={skill.id}
                            onClick={() => useSkill(skill)}
                            disabled={disabled}
                            className={`p-3 rounded-xl border text-xs text-left transition-all
                              ${disabled
                                ? 'bg-zinc-900/50 border-white/5 opacity-50 cursor-not-allowed'
                                : enabledStyle}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold truncate">{skill.icon} {skill.name}</span>
                              {skill.chiCost > 0 && <span className="text-purple-300">-{skill.chiCost}</span>}
                              {isBasic && <span className="text-[9px] text-zinc-400 ml-1 whitespace-nowrap">sem custo</span>}
                            </div>
                            <div className="text-zinc-500 text-[10px]">
                              Dmg: {skill.baseDamageMin}-{skill.baseDamageMax}
                              {skill.cooldownTurns > 0 && ` · CD: ${skill.cooldownTurns}T`}
                            </div>
                            {onCooldown && (
                              <div className="text-red-400 text-[10px] mt-1">⏳ {skill.turnsRemaining} turno{skill.turnsRemaining > 1 ? 's' : ''}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Consumíveis equipados (poções da arena) */}
                {myConsumables.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-zinc-500 mb-2">🧪 Poções (uso instantâneo, não passa turno)</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {myConsumables.map(cons => (
                        <button key={cons.inventoryId}
                          onClick={() => useConsumable(cons)}
                          disabled={!isMyTurn || waiting || cons.quantity <= 0}
                          className={`p-2 rounded-xl border text-xs text-left transition-all
                            ${(!isMyTurn || waiting || cons.quantity <= 0)
                              ? 'bg-zinc-900/50 border-white/5 opacity-50 cursor-not-allowed'
                              : 'bg-purple-400/10 hover:bg-purple-400/20 border-purple-400/25 text-purple-300'}`}>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-base">{cons.effect?.icon || '🧪'}</span>
                            <span className="font-bold truncate">{cons.itemName}</span>
                          </div>
                          <div className="text-zinc-500 text-[10px] truncate">
                            {cons.effect?.label}
                          </div>
                          <div className="text-zinc-400 text-[10px] mt-0.5">×{cons.quantity}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <button onClick={defendAction}
                    disabled={!isMyTurn || waiting}
                    className={`py-3 border rounded-xl text-sm font-semibold transition-all
                      ${isMyTurn && !waiting
                        ? 'bg-zinc-900 hover:bg-sky-500/15 border-white/5 hover:border-sky-500/30 text-white'
                        : 'bg-zinc-900/50 border-white/5 text-zinc-500 cursor-not-allowed'}`}>
                    🛡️ Defender (reduz 50% do próximo dano)
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
