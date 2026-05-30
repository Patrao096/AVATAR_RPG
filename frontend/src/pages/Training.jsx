// frontend/src/pages/Training.jsx
// Training Grounds — Mini-game contra bosses do mundo de Avatar
// 3 visões:
//   - 'map':    Mapa SVG do mundo, escolhe nação
//   - 'bosses': Lista de bosses da nação selecionada
//   - 'battle': Tela de batalha (reaproveitada do estilo da arena)

import { useState, useEffect, useRef, useCallback } from 'react';
import { authHeaders } from '../App';

const API = window.__API_URL__ || 'http://localhost:5000';

const NATIONS = [
  { id: 'Ar',    name: 'Templos do Ar',  icon: '🌬️', color: '#94a3b8',
    glow: 'rgba(148,163,184,0.4)', desc: 'Os 4 templos no topo do mundo',
    pos: { x: 20, y: 18 } },                              // NO
  { id: 'Água', name: 'Tribos da Água', icon: '💧', color: '#3b82f6',
    glow: 'rgba(59,130,246,0.4)', desc: 'Os polos gelados Norte e Sul',
    pos: { x: 80, y: 18 } },                              // NE
  { id: 'Terra', name: 'Reino da Terra', icon: '🪨', color: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)', desc: 'O vasto continente verdejante',
    pos: { x: 20, y: 78 } },                              // SO
  { id: 'Fogo',  name: 'Nação do Fogo',  icon: '🔥', color: '#ef4444',
    glow: 'rgba(239,68,68,0.4)', desc: 'Os arquipélagos vulcânicos',
    pos: { x: 80, y: 78 } },                              // SE
];

const PERSONALITY_LABEL = {
  aggressive: { label: 'Agressivo', color: 'text-red-400', icon: '⚔️' },
  defensive:  { label: 'Defensivo', color: 'text-sky-400', icon: '🛡️' },
  wise:       { label: 'Sábio',     color: 'text-teal-400', icon: '🧘' },
  trickster:  { label: 'Trapaceiro', color: 'text-purple-400', icon: '🎭' },
  berserker:  { label: 'Bersek',    color: 'text-orange-400', icon: '🩸' },
};

export default function Training({ user, embedded = false }) {
  const [view, setView] = useState('map');         // 'map' | 'bosses' | 'battle'
  const [progress, setProgress] = useState(null);
  const [selectedNation, setSelectedNation] = useState(null);
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requiresClan, setRequiresClan] = useState(false);

  const loadProgress = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/training/progress`, { headers: authHeaders() });
      const data = await res.json();
      if (res.status === 403 && data.requiresClan) {
        setRequiresClan(true);
        return;
      }
      setProgress(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const startBattle = async (bossId) => {
    try {
      const res = await fetch(`${API}/api/training/start/${bossId}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.requiresClan) {
          alert('🛡️ O treino é exclusivo para membros de clãs. Entre em um clã primeiro.');
        } else {
          alert(`❌ ${data.error}`);
        }
        return;
      }
      setBattle(data);
      setView('battle');
    } catch (e) {
      alert('Erro ao iniciar batalha');
    }
  };

  const onBattleEnd = () => {
    setBattle(null);
    setView('bosses');
    loadProgress();
  };

  // Wrappers de layout: se embedded=true (dentro de outra página), não usa lg:ml-56
  const Outer = embedded
    ? ({ children }) => <div className="page-enter">{children}</div>
    : ({ children }) => <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">{children}</div>;

  const Inner = embedded
    ? ({ children }) => <div>{children}</div>
    : ({ children }) => <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">{children}</div>;

  if (requiresClan) {
    return (
      <Outer>
        <Inner>
          <div className="bg-zinc-900 border border-amber-500/25 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">🛡️</div>
            <h2 className="text-xl font-bold mb-2 text-amber-300">Treino exclusivo de clãs</h2>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Os Salões de Treino são exclusivos para membros de clãs. Entre em um clã para acessar este modo.
            </p>
          </div>
        </Inner>
      </Outer>
    );
  }

  if (loading) {
    return (
      <Outer>
        <Inner>
          <div className="text-center text-zinc-500 py-16">Carregando o mundo...</div>
        </Inner>
      </Outer>
    );
  }

  return (
    <Outer>
      <Inner>
        {view === 'map'    && <MapView progress={progress} onSelect={(n) => { setSelectedNation(n); setView('bosses'); }} />}
        {view === 'bosses' && <BossListView progress={progress} nation={selectedNation} onBack={() => setView('map')} onChallenge={startBattle} />}
        {view === 'battle' && <BattleView battle={battle} onEnd={onBattleEnd} />}
      </Inner>
    </Outer>
  );
}

// VISÃO 1: MAPA
function MapView({ progress, onSelect }) {
  return (
    <>
      <div className="mb-5 stagger">
        <h1 className="text-2xl lg:text-3xl font-bold mb-1">🗺️ Salões de Treino</h1>
        <p className="text-zinc-400 text-sm">
          Domine os mestres do mundo. Cada nação tem 10 desafios em escala de poder.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 stagger">
        {[
          ['🏆', progress.stats.totalDefeated, 'Derrotados'],
          ['⚔️',  progress.stats.totalBosses, 'Total'],
          ['📊', `${progress.stats.percent}%`, 'Progresso'],
          ['⚡', `Lv ${progress.myCharacter.level}`, 'Seu nível'],
        ].map(([icon, val, label]) => (
          <div key={label} className="bg-zinc-900 border border-white/5 rounded-2xl p-3 lg:p-4 text-center lift">
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-xl lg:text-2xl font-bold text-teal-400 font-mono">{val}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {/* MAPA SVG */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 lg:p-6 relative overflow-hidden lift">
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3">📍 Escolha sua jornada</h2>
        <div className="relative aspect-[16/10] w-full bg-zinc-950 rounded-xl overflow-hidden">
          <WorldMapSVG progress={progress} onSelect={onSelect} />
        </div>
        <p className="text-xs text-zinc-500 mt-3 text-center">
          Toque numa região para ver os mestres disponíveis
        </p>
      </div>
    </>
  );
}

function WorldMapSVG({ progress, onSelect }) {
  return (
    <svg viewBox="0 0 100 60" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {NATIONS.map(n => (
          <radialGradient key={n.id} id={`grad-${n.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={n.color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={n.color} stopOpacity="0" />
          </radialGradient>
        ))}
        {/* Padrão de "ondulação" no fundo (oceano) */}
        <pattern id="ocean" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0,3 Q1.5,1.5 3,3 T6,3" stroke="#1e3a5f" strokeWidth="0.2" fill="none" opacity="0.6" />
        </pattern>
        {/* Bordas suaves nas regiões */}
        <filter id="soft-glow">
          <feGaussianBlur stdDeviation="0.4" />
        </filter>
      </defs>

      {/* Fundo oceano */}
      <rect width="100" height="60" fill="url(#ocean)" />
      <rect width="100" height="60" fill="#0a1929" opacity="0.85" />

      {/* "Continentes" estilizados — formas orgânicas para cada nação */}
      {/* AR — NO — Templos no topo */}
      <g transform="translate(0,0)">
        <ellipse cx="20" cy="14" rx="15" ry="9" fill={`url(#grad-Ar)`} />
        <path d="M10,12 Q15,8 20,11 Q26,7 31,13 Q26,20 20,18 Q12,20 10,12 Z"
              fill="#1e293b" stroke="#475569" strokeWidth="0.3" opacity="0.85" />
        {/* "Picos" simbólicos */}
        <path d="M14,12 L16,7 L18,12 Z M22,11 L24,5 L26,11 Z"
              fill="#475569" opacity="0.5" />
      </g>

      {/* ÁGUA — NE — Tribos polares */}
      <g>
        <ellipse cx="80" cy="14" rx="14" ry="9" fill={`url(#grad-Água)`} />
        <path d="M68,11 Q72,8 76,11 Q82,8 88,12 Q92,16 88,19 Q80,22 74,18 Q68,16 68,11 Z"
              fill="#0c4a6e" stroke="#0ea5e9" strokeWidth="0.3" opacity="0.85" />
        {/* Glaciares */}
        <polygon points="74,9 76,5 78,9" fill="#bae6fd" opacity="0.7" />
        <polygon points="82,11 84,7 86,11" fill="#bae6fd" opacity="0.6" />
      </g>

      {/* TERRA — SO — Reino verdejante */}
      <g>
        <ellipse cx="22" cy="44" rx="18" ry="11" fill={`url(#grad-Terra)`} />
        <path d="M6,42 Q10,34 18,38 Q26,32 34,40 Q38,46 32,52 Q22,55 14,52 Q6,50 6,42 Z"
              fill="#3f3621" stroke="#92400e" strokeWidth="0.3" opacity="0.9" />
        {/* Montanhas */}
        <path d="M14,42 L17,36 L20,42 M22,42 L25,34 L28,42"
              fill="none" stroke="#78716c" strokeWidth="0.6" strokeLinejoin="round" />
        {/* Cidade Ba Sing Se */}
        <rect x="20" y="44" width="2" height="2" fill="#fbbf24" opacity="0.8" />
      </g>

      {/* FOGO — SE — Arquipélago vulcânico */}
      <g>
        <ellipse cx="80" cy="44" rx="15" ry="10" fill={`url(#grad-Fogo)`} />
        <path d="M68,42 Q72,36 78,40 Q84,36 90,42 Q92,48 86,52 Q78,54 72,50 Q66,48 68,42 Z"
              fill="#3f1d1d" stroke="#dc2626" strokeWidth="0.3" opacity="0.9" />
        {/* Vulcão */}
        <polygon points="78,42 80,34 82,42" fill="#7c2d12" />
        <polygon points="79,38 80,34 81,38" fill="#fbbf24" opacity="0.8" />
        {/* Smoke */}
        <circle cx="80" cy="32" r="0.8" fill="#fb923c" opacity="0.5" />
      </g>

      {/* PONTOS CLICÁVEIS DAS NAÇÕES (sobrepostos) */}
      {NATIONS.map(n => {
        const stats = progress.stats.byNation[n.id];
        const allBeaten = stats && stats.defeated === stats.total;
        const someAvailable = stats && stats.defeated < stats.total;
        return (
          <g key={n.id}
             className="cursor-pointer"
             onClick={() => onSelect(n.id)}
             style={{ pointerEvents: 'all' }}>
            {/* Aura pulsante se há bosses não derrotados */}
            {someAvailable && (
              <circle cx={n.pos.x} cy={n.pos.y} r="8" fill={n.color} opacity="0.15">
                <animate attributeName="r" values="6;9;6" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.05;0.25" dur="3s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Marcador central */}
            <circle cx={n.pos.x} cy={n.pos.y} r="5" fill={n.color} opacity={allBeaten ? "0.4" : "0.85"}
                    stroke="white" strokeWidth="0.4" />
            <text x={n.pos.x} y={n.pos.y + 1.5} fontSize="5" textAnchor="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {n.icon}
            </text>
            {/* Label da nação */}
            <text x={n.pos.x} y={n.pos.y + 9} fontSize="2.3" fontWeight="bold" textAnchor="middle"
                  fill="white" style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {n.name.toUpperCase()}
            </text>
            {/* Progresso */}
            <text x={n.pos.x} y={n.pos.y + 12} fontSize="2" textAnchor="middle"
                  fill={n.color} fontFamily="monospace"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {stats?.defeated || 0}/{stats?.total || 10}
            </text>
            {allBeaten && (
              <text x={n.pos.x + 6} y={n.pos.y - 3} fontSize="3" textAnchor="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>👑</text>
            )}
          </g>
        );
      })}

      {/* Linhas conectando as nações (rotas) */}
      <g opacity="0.15" stroke="#64748b" strokeWidth="0.2" strokeDasharray="0.5,0.5" fill="none">
        <line x1="20" y1="18" x2="80" y2="18" />
        <line x1="20" y1="78" x2="80" y2="78" /> {/* fora do viewBox para "saída" */}
        <line x1="20" y1="18" x2="20" y2="44" />
        <line x1="80" y1="18" x2="80" y2="44" />
      </g>
    </svg>
  );
}

// VISÃO 2: LISTA DE BOSSES DA NAÇÃO
function BossListView({ progress, nation, onBack, onChallenge }) {
  const nationData = NATIONS.find(n => n.id === nation);
  const bosses = progress.progress[nation] || [];

  return (
    <>
      <button onClick={onBack}
        className="text-sm text-zinc-400 hover:text-white mb-3 flex items-center gap-1">
        ← Voltar ao mapa
      </button>

      <div className="rounded-2xl p-5 lg:p-6 mb-5 relative overflow-hidden border border-white/5 lift"
           style={{ background: `linear-gradient(135deg, ${nationData.color}26, ${nationData.color}08)` }}>
        <div className="absolute -top-12 -right-12 w-48 h-48 pointer-events-none rounded-full"
             style={{ background: `radial-gradient(circle, ${nationData.glow}, transparent 70%)` }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-4xl">{nationData.icon}</span>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold">{nationData.name}</h1>
              <p className="text-xs text-zinc-400">{nationData.desc}</p>
            </div>
          </div>
          <div className="text-xs font-mono mt-2 text-zinc-500">
            {progress.stats.byNation[nation]?.defeated || 0}/{progress.stats.byNation[nation]?.total || 10} mestres derrotados
          </div>
        </div>
      </div>

      <div className="space-y-2 stagger">
        {bosses.map(b => <BossCard key={b.id} boss={b} nationData={nationData} onChallenge={onChallenge} />)}
      </div>
    </>
  );
}

function BossCard({ boss, nationData, onChallenge }) {
  const personality = PERSONALITY_LABEL[boss.personality];
  const isMilestone = boss.tier === 5 || boss.tier === 10;

  return (
    <div className={`bg-zinc-900 border rounded-2xl p-4 transition-all relative overflow-hidden
      ${boss.defeated ? 'border-teal-500/25' : boss.unlocked ? `${isMilestone ? 'border-amber-500/30' : 'border-white/5'} lift cursor-pointer` : 'border-white/5 opacity-50'}`}
      onClick={() => boss.unlocked && !boss.defeated && onChallenge(boss.id)}>

      {boss.unlocked && !boss.defeated && (
        <div className="absolute -top-12 -right-12 w-32 h-32 pointer-events-none rounded-full"
          style={{ background: `radial-gradient(circle, ${nationData.color}30, transparent 70%)` }} />
      )}

      <div className="flex items-center gap-3 lg:gap-4 relative">
        {/* Tier number */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0
          ${boss.defeated ? 'bg-teal-500/15 text-teal-300'
            : boss.unlocked ? 'bg-zinc-800 text-amber-400'
            : 'bg-zinc-800 text-zinc-600'}`}>
          {boss.unlocked ? boss.tier : '🔒'}
        </div>

        {/* Avatar */}
        <div className="text-3xl lg:text-4xl flex-shrink-0">{boss.icon}</div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`font-bold text-sm ${boss.defeated ? 'text-teal-300' : 'text-white'}`}>
              {boss.name}
            </span>
            {isMilestone && !boss.defeated && (
              <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full font-bold">
                ⭐ MARCO
              </span>
            )}
            {boss.defeated && (
              <span className="text-[9px] bg-teal-500/15 text-teal-400 border border-teal-500/25 px-1.5 py-0.5 rounded-full font-bold">
                ✓ {boss.totalWins}× DERROTADO
              </span>
            )}
          </div>
          {boss.unlocked && (
            <p className="text-xs text-zinc-400 italic line-clamp-2 mb-1">"{boss.description}"</p>
          )}
          <div className="flex flex-wrap gap-2 text-[10px] font-mono">
            {boss.unlocked && (
              <>
                <span className={personality.color}>
                  {personality.icon} {personality.label}
                </span>
                <span className="text-zinc-500">·</span>
                <span className="text-zinc-400">Lv {boss.previewStats.level}</span>
                <span className="text-zinc-500">·</span>
                <span className="text-red-400">❤️ {boss.previewStats.maxHp}</span>
                <span className="text-orange-400">⚔️ {boss.previewStats.attack}</span>
                <span className="text-sky-400">🛡️ {boss.previewStats.defense}</span>
              </>
            )}
            {!boss.unlocked && <span className="text-zinc-600">Derrote o tier {boss.tier - 1} primeiro</span>}
          </div>
        </div>

        {/* CTA */}
        {boss.unlocked && !boss.defeated && (
          <button className="px-3 lg:px-4 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-900 font-bold rounded-xl text-xs lg:text-sm flex-shrink-0">
            ⚔️ Enfrentar
          </button>
        )}
        {boss.defeated && (
          <button onClick={(e) => { e.stopPropagation(); onChallenge(boss.id); }}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs flex-shrink-0">
            ↻ Refazer
          </button>
        )}
      </div>
    </div>
  );
}

// VISÃO 3: BATALHA
function BattleView({ battle, onEnd }) {
  const [state, setState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [skills, setSkills] = useState([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [endResult, setEndResult] = useState(null);
  const [potionInfo, setPotionInfo] = useState({ canUse: true, potionsLeft: 5, bossPotionsLeft: 5 });

  const logRef = useRef(null);

  // Carrega skills equipadas
  useEffect(() => {
    fetch(`${API}/api/battle/skills?battleId=${battle.battleId}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setSkills(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [battle.battleId]);

  // Inicializa estado
  useEffect(() => {
    setState({
      me: {
        hp: battle.player.hp, maxHp: battle.player.maxHp,
        chi: battle.player.chi, maxChi: battle.player.maxChi,
        name: battle.player.name,
      },
      opponent: {
        hp: battle.opponent.hp, maxHp: battle.opponent.maxHp,
        name: battle.opponent.name,
      },
      isMyTurn: true,
      turnNumber: 1,
    });
  }, [battle]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const performAction = async (endpoint, body) => {
    if (busy || outcome) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/training/${endpoint}`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ battleId: battle.battleId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`❌ ${data.error}`); return; }

      if (data.state) setState(data.state);
      if (data.logs) setLogs(data.logs);
      if (data.potionInfo) setPotionInfo(data.potionInfo);

      if (data.outcome === 'won' || data.outcome === 'lost') {
        setOutcome(data.outcome);
        // Finaliza no servidor
        const endRes = await fetch(`${API}/api/training/end`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({ battleId: battle.battleId, result: data.outcome === 'won' ? 'win' : 'loss' }),
        });
        const endData = await endRes.json();
        if (endRes.ok) setEndResult(endData);
      }
    } finally { setBusy(false); }
  };

  if (!state) return <div className="text-center py-10 text-zinc-500">Preparando batalha...</div>;

  const myHpPct = (state.me.hp / state.me.maxHp) * 100;
  const myChiPct = (state.me.chi / state.me.maxChi) * 100;
  const oppHpPct = (state.opponent.hp / state.opponent.maxHp) * 100;
  const personality = PERSONALITY_LABEL[battle.boss.personality];

  return (
    <div className="space-y-4">
      {/* Header com info do boss */}
      <div className="bg-zinc-900 border border-amber-500/25 rounded-2xl p-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 pointer-events-none rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)' }} />
        <div className="relative flex items-center gap-3 flex-wrap">
          <span className="text-4xl">{battle.boss.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg">{battle.boss.name}</span>
              <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full font-bold">
                Tier {battle.boss.tier}
              </span>
              <span className={`text-[10px] ${personality.color}`}>
                {personality.icon} {personality.label}
              </span>
            </div>
            <p className="text-xs text-zinc-400 italic mt-0.5">"{battle.boss.description}"</p>
          </div>
        </div>
      </div>

      {/* Outcome modal */}
      {outcome && (
        <OutcomeModal outcome={outcome} endResult={endResult} boss={battle.boss} onClose={onEnd} />
      )}

      {/* VS Cards */}
      <div className="grid grid-cols-3 gap-2 lg:gap-3 items-center">
        {/* Player */}
        <div className="bg-zinc-900 border border-teal-500/25 rounded-2xl p-3 lg:p-4 text-center relative overflow-hidden lift">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/8 to-transparent pointer-events-none" />
          <div className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-2 rounded-full border-2 border-teal-400 flex items-center justify-center text-2xl lg:text-3xl bg-zinc-800 relative shadow-lg shadow-teal-500/20">
            {{ Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' }[battle.player.element] || '⚔️'}
          </div>
          <p className="text-teal-400 text-xs font-semibold truncate relative">{state.me.name} · Lv.{battle.player.level}</p>
          <div className="mt-2 relative">
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-0.5">
              <span>HP</span><span>{state.me.hp}/{state.me.maxHp}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 transition-all" style={{ width: `${myHpPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1 mb-0.5">
              <span>Chi</span><span>{state.me.chi}/{state.me.maxChi}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-purple-400 transition-all" style={{ width: `${myChiPct}%` }} />
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="text-center">
          <div className="relative w-10 h-10 lg:w-12 lg:h-12 mx-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-red-500 rounded-full shadow-lg shadow-amber-500/40 flex items-center justify-center font-black text-base lg:text-lg">
              VS
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">Turno {state.turnNumber}</div>
        </div>

        {/* Boss */}
        <div className="bg-zinc-900 border border-amber-500/25 rounded-2xl p-3 lg:p-4 text-center relative overflow-hidden lift">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/8 to-transparent pointer-events-none" />
          <div className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-2 rounded-full border-2 border-amber-400 flex items-center justify-center text-2xl lg:text-3xl bg-zinc-800 relative shadow-lg shadow-amber-500/20">
            {battle.boss.icon}
          </div>
          <p className="text-amber-400 text-xs font-semibold truncate relative">{state.opponent.name}</p>
          <div className="mt-2 relative">
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mb-0.5">
              <span>HP</span><span>{state.opponent.hp}/{state.opponent.maxHp}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${oppHpPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Turn indicator */}
      <div className={`text-center py-2.5 rounded-xl text-sm font-bold relative overflow-hidden
        ${state.isMyTurn ? 'bg-teal-400/15 text-teal-300 border border-teal-400/30' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
        {state.isMyTurn && !busy && <span className="absolute inset-0 bar-shimmer pointer-events-none" />}
        <span className="relative">
          {busy ? '⏳ Processando...' : state.isMyTurn ? '🎯 SEU TURNO' : '⏸️ Boss pensando...'}
        </span>
      </div>

      {/* Log */}
      <div ref={logRef} className="bg-zinc-900 border border-white/5 rounded-2xl p-4 max-h-40 overflow-y-auto space-y-1.5">
        {logs.length === 0 && <p className="text-xs text-zinc-600 italic text-center">A batalha começa...</p>}
        {logs.map((l, i) => (
          <div key={i} className={`text-xs ${l.attackerSide === battle.mySide ? 'text-teal-300' : 'text-amber-300'}`}>
            <span className="font-mono text-zinc-600 mr-1">[T{l.turnNumber}]</span>
            <span className="font-semibold">{l.attackerName}</span> usou <span>{l.skillIcon} {l.skillName}</span>
            {l.damage > 0 && <span className="text-red-400 font-mono"> ({l.damage} de dano)</span>}
            {l.hpHealed > 0 && <span className="text-teal-400 font-mono"> (+{l.hpHealed} HP)</span>}
            {l.chiRestored > 0 && <span className="text-purple-400 font-mono"> (+{l.chiRestored} chi)</span>}
            {l.defending && <span className="text-sky-400"> (defendeu)</span>}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-3 lg:p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          {/* Skills equipadas */}
          {skills.map(s => {
            const onCd = s.turnsRemaining > 0;
            const noChi = state.me.chi < s.chiCost;
            const disabled = !state.isMyTurn || busy || onCd || noChi || outcome;
            return (
              <button key={s.id}
                onClick={() => performAction('use-skill', { skillId: s.id })}
                disabled={disabled}
                className={`p-2 lg:p-3 rounded-xl text-left transition lift relative overflow-hidden
                  ${disabled
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/25'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-base">{s.icon}</span>
                  <span className="text-xs font-bold truncate">{s.name}</span>
                </div>
                <div className="text-[9px] font-mono space-x-2">
                  <span className="text-purple-300">{s.chiCost} chi</span>
                  <span className="text-red-300">{s.baseDamageMin}-{s.baseDamageMax}</span>
                  {onCd && <span className="text-amber-300">CD: {s.turnsRemaining}</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Defender */}
          <button onClick={() => performAction('defend', {})}
            disabled={!state.isMyTurn || busy || outcome}
            className="py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 rounded-xl text-sm font-bold disabled:opacity-40 lift">
            🛡️ Defender
          </button>
          {/* Poção */}
          <button onClick={() => performAction('use-potion', {})}
            disabled={!state.isMyTurn || busy || !potionInfo.canUse || outcome}
            className="py-2.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/25 rounded-xl text-sm font-bold disabled:opacity-40 lift">
            🧪 Poção ({potionInfo.potionsLeft ?? 5}/5)
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 text-center mt-2">
          💡 Poção restaura 40% HP + 20% chi · 5 por partida · 1 por turno
        </p>
      </div>
    </div>
  );
}

// MODAL DE FIM DE BATALHA
function OutcomeModal({ outcome, endResult, boss, onClose }) {
  const won = outcome === 'won';
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`bg-zinc-900 border-2 rounded-2xl p-6 lg:p-8 max-w-md w-full text-center relative overflow-hidden
        ${won ? 'border-teal-500/40' : 'border-red-500/40'}`}>
        <div className="absolute -top-20 -right-20 w-60 h-60 pointer-events-none rounded-full"
          style={{ background: won
            ? 'radial-gradient(circle, rgba(45,212,191,0.3), transparent 70%)'
            : 'radial-gradient(circle, rgba(239,68,68,0.2), transparent 70%)' }} />

        <div className="text-6xl lg:text-7xl mb-3 relative">
          {won ? '🏆' : '💀'}
        </div>
        <h2 className={`text-2xl lg:text-3xl font-bold mb-1 relative ${won ? 'text-teal-400' : 'text-red-400'}`}>
          {won ? 'Vitória!' : 'Derrota...'}
        </h2>
        <p className="text-sm text-zinc-400 mb-5 relative">
          {won
            ? `Você superou ${boss.name}.`
            : `${boss.name} foi mais forte. Tente novamente.`}
        </p>

        {endResult && (
          <div className="bg-zinc-800/60 rounded-xl p-4 mb-5 space-y-2 relative">
            {endResult.rewards.isMilestone && (
              <div className="text-amber-400 font-bold text-sm">⭐ MARCO ALCANÇADO!</div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-2xl font-bold text-amber-400 font-mono">+{endResult.rewards.exp}</div>
                <div className="text-[10px] text-zinc-500">EXP</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-400 font-mono">+{endResult.rewards.yuan}</div>
                <div className="text-[10px] text-zinc-500">YUAN</div>
              </div>
            </div>
            {endResult.progression?.leveled && (
              <div className="text-purple-400 font-bold mt-2">
                🆙 SUBIU {endResult.progression.levelsGained} NÍVEL! Agora Lv {endResult.progression.newLevel}
              </div>
            )}
            {endResult.rewards.decayFactor < 1 && endResult.rewards.decayFactor > 0 && (
              <p className="text-[10px] text-zinc-500 italic">
                Recompensa reduzida ({Math.round(endResult.rewards.decayFactor * 100)}%) por re-vitória
              </p>
            )}
          </div>
        )}

        <button onClick={onClose}
          className={`w-full py-3 font-bold rounded-xl text-sm relative
            ${won ? 'bg-teal-400 hover:bg-teal-300 text-zinc-900' : 'bg-zinc-800 hover:bg-zinc-700 text-white'}`}>
          ← Voltar à lista
        </button>
      </div>
    </div>
  );
}
