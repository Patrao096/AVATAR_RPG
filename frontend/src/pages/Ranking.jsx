import { useState, useEffect } from 'react';

const API = window.__API_URL__ || 'http://localhost:5000';

export default function Ranking() {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/character/ranking`)
      .then(r => r.json())
      .then(data => { setRanking(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const MEDAL = ['🥇', '🥈', '🥉'];
  const ELEM = { Fogo: 'text-orange-400', Água: 'text-sky-400', Terra: 'text-green-400', Ar: 'text-teal-300', Nenhum: 'text-zinc-400' };

  if (loading) return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 flex items-center justify-center min-h-screen">
      <p className="text-zinc-500">Carregando ranking...</p>
    </div>
  );

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">🏆 Ranking Global</h1>
        <p className="text-zinc-500 text-sm mb-6">Ordenado por ELO competitivo (top 50)</p>

        <div className="space-y-2">
          {ranking.length === 0 && <p className="text-zinc-500 text-center py-8">Nenhum jogador ainda.</p>}
          {ranking.map((p, i) => (
            <div key={i} className="bg-zinc-900 border border-white/5 rounded-xl p-4 flex items-center gap-3">
              <span className="text-xl w-8 text-center flex-shrink-0">{MEDAL[i] || `#${i + 1}`}</span>
              <img src={p.discordAvatar || 'https://via.placeholder.com/36'}
                   className="w-9 h-9 rounded-xl flex-shrink-0"
                   alt=""
                   onError={e => { e.target.src = 'https://via.placeholder.com/36'; }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{p.discordUsername}</div>
                <div className={`text-xs ${ELEM[p.element] || 'text-zinc-400'}`}>
                  {p.element} · Lv.{p.level}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                {p.rank && (
                  <div className="flex items-center gap-1 justify-end mb-0.5">
                    <span className="text-base">{p.rank.icon}</span>
                    <span className="font-bold text-sm" style={{ color: p.rank.badge }}>
                      {p.elo || 500}
                    </span>
                  </div>
                )}
                <div className="text-xs text-zinc-500">{p.wins}V / {p.losses || 0}D</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
