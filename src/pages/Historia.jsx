// frontend/src/pages/Historia.jsx
//   - 10 capítulos (5 free, 5 premium)
//   - Cenas de BATALHA dentro de capítulos
//   - Banner ajustado: "Capítulos 6+ são Premium"

import { useState, useEffect, useRef } from 'react';
import { authHeaders } from '../App';

const API = window.__API_URL__ || 'http://localhost:5000';

const PROFILE_ICON  = { wise: '🧘', aggressive: '⚔️', fearful: '🛡️' };
const PROFILE_NAME  = { wise: 'Sábio', aggressive: 'Guerreiro', fearful: 'Cauteloso' };
const PROFILE_COLOR = { wise: 'text-teal-400', aggressive: 'text-red-400', fearful: 'text-sky-400' };
const ELEMENT_ICON  = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' };
const ELEM_BAR      = { Fogo: 'bg-orange-400', 'Água': 'bg-sky-400', Terra: 'bg-green-400', Ar: 'bg-teal-300', Neutro: 'bg-zinc-400' };

export default function Historia() {
  const [progress, setProgress] = useState(null);
  const [cenaAtiva, setCenaAtiva] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sceneLoading, setSceneLoading] = useState(false);

  // Estado da batalha de história
  const [storyBattle, setStoryBattle] = useState(null);

  // Countdown ao vivo do cooldown entre capítulos
  const [cooldownNow, setCooldownNow] = useState(0);

  useEffect(() => { loadProgress(); }, []);

  // Tick a cada segundo enquanto o cooldown está ativo
  useEffect(() => {
    if (!progress?.cooldownRemainingMs || progress.cooldownRemainingMs <= 0) {
      setCooldownNow(0);
      return;
    }
    setCooldownNow(progress.cooldownRemainingMs);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, progress.cooldownRemainingMs - elapsed);
      setCooldownNow(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [progress?.cooldownRemainingMs]);

  const formatCooldown = (ms) => {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const loadProgress = async () => {
    try {
      const res = await fetch(`${API}/api/story/progress`, { headers: authHeaders() });
      const data = await res.json();
      setProgress(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const abrirCena = async (chapter) => {
    if (!progress) return;
    const ch = progress.chapters.find(c => c.id === chapter);
    if (!ch) return;
    if (ch.isCompleted) {
      alert('Você já concluiu este capítulo. Cada capítulo pode ser jogado apenas uma vez.');
      return;
    }
    if (ch.requiresPremium) {
      alert('Este capítulo requer o plano Premium. Assine em /plans.');
      return;
    }

    // ─── Cooldown check ───
    // Só bloqueia se for um capítulo NOVO (que ainda não está em curso)
    const isStartingNewChapter = chapter !== progress.chapter || progress.scene === 0;
    if (isStartingNewChapter && cooldownNow > 0) {
      alert(`Aguarde ${formatCooldown(cooldownNow)} antes de iniciar um novo capítulo.`);
      return;
    }

    const scene = chapter === progress.chapter ? progress.scene : 0;
    setSceneLoading(true);
    try {
      const res = await fetch(`${API}/api/story/scene/${chapter}/${scene}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        if (data.cooldown && data.cooldownRemainingMs > 0) {
          // Atualiza o countdown local com o tempo do servidor
          setCooldownNow(data.cooldownRemainingMs);
          // Recarrega o progresso para sincronizar
          loadProgress();
        }
        alert(data.error);
        return;
      }
      setCenaAtiva({ ...data });
      setResultado(null);
    } finally { setSceneLoading(false); }
  };

  const escolher = async (idx) => {
    if (!cenaAtiva) return;
    try {
      const res = await fetch(`${API}/api/story/choice`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ chapter: cenaAtiva.chapter, scene: cenaAtiva.scene, choiceIndex: idx }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setResultado({ escolha: cenaAtiva.choices[idx], ...data });
      if (data.isLastScene) await loadProgress();
    } catch (e) { console.error(e); }
  };

  const proximaCena = async () => {
    if (!cenaAtiva || !resultado) return;
    if (resultado.isLastScene) {
      setCenaAtiva(null);
      setResultado(null);
      await loadProgress();
      return;
    }
    const nextSceneIdx = cenaAtiva.scene + 1;
    setSceneLoading(true);
    try {
      const res = await fetch(`${API}/api/story/scene/${cenaAtiva.chapter}/${nextSceneIdx}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setCenaAtiva(data);
      setResultado(null);
    } finally { setSceneLoading(false); }
  };

  const iniciarBatalhaHistoria = async () => {
    if (!cenaAtiva || cenaAtiva.type !== 'battle') return;
    setSceneLoading(true);
    try {
      const res = await fetch(`${API}/api/story/start-battle`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ chapter: cenaAtiva.chapter, scene: cenaAtiva.scene }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setStoryBattle(data);
    } finally { setSceneLoading(false); }
  };

  const onStoryBattleEnd = async (won) => {
    if (!storyBattle) return;
    try {
      const res = await fetch(`${API}/api/story/finish-battle`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          battleId: storyBattle.battleId,
          chapter: storyBattle.chapter,
          scene: storyBattle.scene,
          won,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Avança a cena: se foi última, recarrega progresso e fecha. Caso contrário, próxima cena.
        if (data.isLastScene) {
          setStoryBattle(null);
          setCenaAtiva(null);
          setResultado(null);
          await loadProgress();
          alert(`${won ? '🏆 Vitória!' : '💥 Derrota'} +${data.rewards.exp} EXP, +${data.rewards.yuan} Yuan. Capítulo concluído!`);
        } else {
          // Carrega próxima cena
          setStoryBattle(null);
          const nextScene = data.nextScene;
          const sres = await fetch(`${API}/api/story/scene/${cenaAtiva.chapter}/${nextScene}`, { headers: authHeaders() });
          const sdata = await sres.json();
          if (sres.ok) {
            setCenaAtiva(sdata);
            setResultado(null);
            alert(`${won ? '🏆 Vitória!' : '💥 Derrota'} +${data.rewards.exp} EXP, +${data.rewards.yuan} Yuan.`);
          }
        }
      }
    } catch (e) { console.error(e); }
  };

  const fecharCena = () => {
    setCenaAtiva(null);
    setResultado(null);
    setStoryBattle(null);
  };

  if (loading) return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 flex items-center justify-center min-h-screen">
      <p className="text-zinc-500">Carregando...</p>
    </div>
  );

  const chapters = progress?.chapters || [];
  const storyProfile = progress?.storyProfile || { wise: 0, aggressive: 0, fearful: 0 };
  const totalChoices = (storyProfile.wise || 0) + (storyProfile.aggressive || 0) + (storyProfile.fearful || 0);
  const dominant = totalChoices > 0
    ? Object.entries(storyProfile).reduce((max, [k, v]) => v > max[1] ? [k, v] : max, ['wise', -1])[0]
    : null;
  const completedCount = chapters.filter(c => c.isCompleted).length;
  const freeLimit = progress?.freeChapterLimit || 5;

  // Se está em batalha de história, renderiza a tela de batalha
  if (storyBattle) {
    return <StoryBattleScreen battle={storyBattle} onEnd={onStoryBattleEnd} onClose={() => setStoryBattle(null)} />;
  }

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-enter">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">📖 Modo História</h1>
        <p className="text-zinc-500 text-sm mb-6">10 capítulos · suas escolhas moldam o destino</p>

        {/* Banner de Cap.1 */}
        {progress && !chapters.find(c => c.id === 1)?.isCompleted && (
          <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-amber-500/40 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-4xl animate-pulse">⚡</div>
              <div className="flex-1">
                <div className="font-bold text-amber-300 mb-1">Seu Elemento Aguarda</div>
                <p className="text-sm text-zinc-300 mb-2">
                  Complete o <strong>Capítulo 1</strong> e suas escolhas revelarão qual elemento irá despertar:{' '}
                  <span className="text-orange-400">🔥 Fogo</span>,{' '}
                  <span className="text-sky-400">💧 Água</span>,{' '}
                  <span className="text-green-400">🪨 Terra</span> ou{' '}
                  <span className="text-teal-300">🌬️ Ar</span>.
                </p>
                <p className="text-xs text-zinc-500">
                  ⚠️ Cada capítulo só pode ser jogado uma vez. Suas escolhas são definitivas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner para free (após Cap.1) */}
        {progress && progress.isPremium === false && chapters.find(c => c.id === 1)?.isCompleted && completedCount < chapters.length && (
          <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-amber-500/10 border-2 border-purple-500/30 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="text-3xl">💎</div>
              <div className="flex-1">
                <div className="font-bold text-purple-300 mb-1">
                  Free: Capítulos 1–{freeLimit} liberados · Cap. {freeLimit + 1}+ Premium
                </div>
                <p className="text-sm text-zinc-300 mb-3">
                  Você tem acesso aos primeiros {freeLimit} capítulos. Para desbloquear os próximos
                  com batalhas épicas, skills lendárias e o final da saga, vire Premium.
                </p>
                <a href="/plans" className="inline-block px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg text-sm font-bold">
                  Ver Planos →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ─── Banner de cooldown entre capítulos (30 min) ─── */}
        {cooldownNow > 0 && (
          <div className="bg-gradient-to-br from-sky-500/10 to-cyan-500/10 border border-sky-500/30 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">⏳</div>
              <div className="flex-1">
                <div className="font-bold text-sky-300 mb-1">Tempo de Reflexão</div>
                <p className="text-sm text-zinc-300 mb-2">
                  Entre cada capítulo da saga, é preciso meditar por 30 minutos antes de seguir adiante.
                </p>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-lg font-bold text-sky-400">{formatCooldown(cooldownNow)}</div>
                  <span className="text-xs text-zinc-500">para começar o próximo capítulo</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Perfil moral */}
        {totalChoices > 0 && (
          <div className="bg-zinc-900 border border-purple-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Seu Caminho</span>
              <span className={`text-xs font-bold ${PROFILE_COLOR[dominant]}`}>
                {PROFILE_ICON[dominant]} {PROFILE_NAME[dominant]} (dominante)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['wise', 'aggressive', 'fearful'].map(p => {
                const count = storyProfile[p] || 0;
                const pct = totalChoices > 0 ? Math.round((count / totalChoices) * 100) : 0;
                return (
                  <div key={p} className="bg-zinc-800 rounded-lg p-2 text-center">
                    <div className="text-2xl mb-1">{PROFILE_ICON[p]}</div>
                    <div className={`text-xs font-bold ${PROFILE_COLOR[p]}`}>{PROFILE_NAME[p]}</div>
                    <div className="text-xs text-zinc-500">{count} · {pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progresso */}
        {progress && (
          <div className="bg-zinc-900 border border-teal-500/20 rounded-2xl p-5 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold">Progresso da Saga</span>
              <span className="text-teal-400 font-bold">{completedCount}/{chapters.length} cap.</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all"
                   style={{ width: `${(completedCount / chapters.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Capítulos */}
        <div className="space-y-3 stagger">
          {chapters.map(ch => {
            const locked = ch.requiresPremium || (ch.id > (progress?.chapter || 1));
            const completed = ch.isCompleted;
            const inCurseChapter = ch.id === (progress?.chapter || 1) && (progress?.scene || 0) > 0;
            // Cooldown só bloqueia capítulos NOVOS (cena 0)
            const cooldownBlocks = cooldownNow > 0 && !completed && !locked && !inCurseChapter;
            const available = !locked && !completed && !cooldownBlocks;
            const hasBattles = ch.battleScenes > 0;
            const isCurrentNew = ch.id === (progress?.chapter || 1) && available && !inCurseChapter;

            return (
              <div key={ch.id}
                onClick={() => available && abrirCena(ch.id)}
                className={`bg-zinc-900 border rounded-2xl p-5 transition-all
                  ${available ? 'cursor-pointer hover:border-white/15 border-amber-500/25 lift' : ''}
                  ${completed ? 'border-teal-500/25 opacity-70' : ''}
                  ${cooldownBlocks ? 'border-sky-500/20 opacity-60 cursor-not-allowed' : ''}
                  ${locked && !completed ? 'opacity-40 border-white/5' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 relative
                    ${isCurrentNew ? 'pulse-ring' : ''}
                    ${completed ? 'bg-teal-500/20' : cooldownBlocks ? 'bg-sky-500/15' : available ? 'bg-amber-500/15' : 'bg-zinc-800'}`}>
                    {completed ? '✅' : cooldownBlocks ? '⏳' : ch.requiresPremium ? '💎' : available ? '▶️' : '🔒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold mb-1 flex items-center gap-2 flex-wrap">
                      Cap. {ch.id} — {ch.title}
                      {hasBattles && <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">⚔️ {ch.battleScenes} batalha{ch.battleScenes > 1 ? 's' : ''}</span>}
                    </div>
                    <div className="text-sm text-zinc-500 truncate">{ch.description}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-zinc-400">
                      <span>⚡ +{ch.rewardExp} EXP</span>
                      <span>💰 +{ch.rewardYuan} Yuan</span>
                      {ch.rewardSkill && <span>🌟 {ch.rewardSkill}</span>}
                    </div>
                  </div>
                  {completed && (
                    <span className="text-xs bg-teal-500/15 text-teal-400 px-2 py-1 rounded-full flex-shrink-0">
                      Concluído
                    </span>
                  )}
                  {cooldownBlocks && (
                    <span className="text-xs bg-sky-500/15 text-sky-300 px-2 py-1 rounded-full flex-shrink-0 font-mono">
                      ⏳ {formatCooldown(cooldownNow)}
                    </span>
                  )}
                  {ch.requiresPremium && !completed && (
                    <span className="text-xs bg-purple-500/15 text-purple-400 px-2 py-1 rounded-full flex-shrink-0">
                      Premium
                    </span>
                  )}
                  {available && !completed && (
                    <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-1 rounded-full flex-shrink-0">
                      {inCurseChapter ? 'Em curso' : 'Disponível'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overlay da cena */}
      {cenaAtiva && (
        <div className="fixed inset-0 z-50 bg-black/95 overflow-y-auto p-4">
          <div className="max-w-lg mx-auto pt-4 pb-8">
            <button onClick={fecharCena} className="mb-4 text-zinc-400 hover:text-white text-sm flex items-center gap-2">← Voltar</button>

            <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6 mb-4">
              <div className="text-xs text-amber-400 font-bold tracking-wider mb-2 flex items-center gap-2">
                <span>CAP. {cenaAtiva.chapter} · CENA {cenaAtiva.scene + 1}/{cenaAtiva.totalScenes}</span>
                {cenaAtiva.type === 'battle' && (
                  <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded text-[10px]">⚔️ BATALHA</span>
                )}
              </div>
              <h2 className="text-xl font-bold mb-4">{cenaAtiva.title}</h2>
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{cenaAtiva.text}</p>
            </div>

            {sceneLoading && <p className="text-center text-zinc-500 text-sm">Carregando...</p>}

            {/* Cena de BATALHA — mostra info do oponente e botão para iniciar */}
            {cenaAtiva.type === 'battle' && !sceneLoading && (
              <div className="bg-zinc-900 border border-red-500/30 rounded-2xl p-6">
                <div className="text-center mb-4">
                  <div className="text-6xl mb-2">{cenaAtiva.opponent.icon}</div>
                  <h3 className="text-xl font-bold text-red-400">{cenaAtiva.opponent.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Lv.{cenaAtiva.opponent.level} · {cenaAtiva.opponent.element}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-red-400 font-bold text-lg">{cenaAtiva.opponent.maxHp}</div>
                    <div className="text-zinc-500">HP</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-purple-400 font-bold text-lg">{cenaAtiva.opponent.maxChi}</div>
                    <div className="text-zinc-500">Chi</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-orange-400 font-bold text-lg">{cenaAtiva.opponent.attack}</div>
                    <div className="text-zinc-500">Ataque</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-sky-400 font-bold text-lg">{cenaAtiva.opponent.defense}</div>
                    <div className="text-zinc-500">Defesa</div>
                  </div>
                </div>

                <div className="bg-zinc-800/50 rounded-lg p-3 mb-4 text-xs text-zinc-400">
                  <div className="font-semibold text-amber-300 mb-1">💡 Recompensas</div>
                  <div>Vitória: +{cenaAtiva.rewardOnWin?.exp} EXP, +{cenaAtiva.rewardOnWin?.yuan} Yuan</div>
                  <div>Derrota: +{cenaAtiva.rewardOnLose?.exp} EXP, +{cenaAtiva.rewardOnLose?.yuan} Yuan</div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4 text-xs text-amber-200">
                  ⚠️ Use suas skills equipadas e poções da arena. Configure no <a href="/profile" className="underline">Perfil</a>.
                </div>

                <button onClick={iniciarBatalhaHistoria}
                  className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl hover:scale-[1.02] transition-all shadow-xl shadow-red-500/25">
                  ⚔️ INICIAR BATALHA
                </button>
              </div>
            )}

            {/* Cena de ESCOLHA */}
            {cenaAtiva.type === 'choice' && !resultado && !sceneLoading && (
              <div className="space-y-3">
                {cenaAtiva.choices.map((label, i) => (
                  <button key={i} onClick={() => escolher(i)}
                    className="w-full text-left p-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 hover:border-teal-400/30 rounded-xl text-sm font-semibold transition-all hover:translate-x-1">
                    {label}
                  </button>
                ))}
              </div>
            )}

            {resultado && (
              <div className="bg-zinc-900 border border-teal-500/20 rounded-2xl p-6">
                <p className="text-zinc-300 text-sm mb-3">
                  Você escolheu: <strong className="text-white">{resultado.escolha}</strong>
                </p>

                {resultado.choiceTag && (
                  <p className={`text-xs mb-3 ${PROFILE_COLOR[resultado.choiceTag]}`}>
                    {PROFILE_ICON[resultado.choiceTag]} Decisão {PROFILE_NAME[resultado.choiceTag]}
                  </p>
                )}

                {resultado.rewards && (
                  <div className="flex flex-wrap gap-4 text-sm mb-4">
                    <span className="text-amber-400">+{resultado.rewards.exp} EXP</span>
                    <span className="text-yellow-400">+{resultado.rewards.yuan} Yuan</span>
                    {resultado.rewards.consistency != null && resultado.isLastScene && (
                      <span className="text-purple-400">☯️ Consistência: {resultado.rewards.consistency}%</span>
                    )}
                  </div>
                )}

                {resultado.elementAssigned && (
                  <div className="bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-red-500/20 border-2 border-amber-500/40 rounded-xl p-5 mb-4 text-center">
                    <div className="text-xs text-amber-300 font-bold tracking-widest mb-2 animate-pulse">
                      ⚡ SEU ELEMENTO DESPERTOU ⚡
                    </div>
                    <div className="text-6xl mb-3 animate-bounce">
                      {ELEMENT_ICON[resultado.elementAssigned] || '✨'}
                    </div>
                    <div className="text-2xl font-bold text-white mb-2">
                      {resultado.elementAssigned}
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">
                      Suas escolhas revelaram sua afinidade elemental.
                    </p>
                    {resultado.baseSkillName && (
                      <div className="bg-white/5 rounded-lg p-2 mt-2">
                        <div className="text-xs text-teal-300">
                          🎯 Dobra aprendida: <strong>{resultado.baseSkillName}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {resultado.skillUnlocked && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
                    <div className="text-purple-400 font-bold mb-1">🌟 NOVA SKILL DESBLOQUEADA!</div>
                    <div className="text-sm text-zinc-300">{resultado.skillUnlockedName || resultado.skillUnlocked}</div>
                    <div className="text-xs text-zinc-500 mt-2">
                      💡 Vá para <a href="/profile" className="text-teal-300 underline">Perfil → Loadout</a> para equipar.
                    </div>
                  </div>
                )}

                {resultado.isLastScene ? (
                  <button onClick={() => {
                    fecharCena();
                    if (resultado.elementAssigned) {
                      window.location.reload();
                    } else {
                      loadProgress();
                    }
                  }}
                    className="w-full py-3 bg-teal-400 text-zinc-900 font-bold rounded-xl">
                    {resultado.isLastChapter ? '🎉 Saga Completa!' :
                     resultado.elementAssigned ? `⚡ Iniciar jornada como Dobrador de ${resultado.elementAssigned}!` :
                     '✅ Capítulo Concluído!'}
                  </button>
                ) : (
                  <button onClick={proximaCena}
                    className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 font-semibold rounded-xl transition-all">
                    Próxima Cena →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// COMPONENTE: Tela de Batalha de História
function StoryBattleScreen({ battle, onEnd, onClose }) {
  const [state, setState] = useState(null);
  const [skills, setSkills] = useState([]);
  const [log, setLog] = useState([]);
  const lastSeenLogIdRef = useRef(0);
  const [waiting, setWaiting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState(null);
  const endedRef = useRef(false);

  useEffect(() => {
    fetchState();
    loadSkills();
    addLog(`⚔️ ${battle.sceneTitle || 'Batalha'} contra ${battle.opponent.name}!`, 'info');
  }, []);

  const addLog = (msg, type = '') => {
    setLog(prev => [...prev.slice(-25), { msg, type, id: Date.now() + Math.random() }]);
  };

  const consumeLogs = (logs) => {
    if (!Array.isArray(logs) || logs.length === 0) return;
    const lastSeen = lastSeenLogIdRef.current;
    const fresh = logs.filter(l => typeof l.id === 'number' && l.id > lastSeen);
    if (fresh.length === 0) return;
    lastSeenLogIdRef.current = Math.max(lastSeen, ...fresh.map(l => l.id));

    for (const entry of fresh) {
      const attackerIsMe = entry.attackerSide === battle.mySide;
      if (entry.consumable) {
        const desc = entry.consumableEffect || 'efeito';
        addLog(
          attackerIsMe ? `🧪 Você ${entry.skillName.toLowerCase()} → ${desc}` : `🧪 ${entry.attackerName} ${entry.skillName.toLowerCase()} → ${desc}`,
          'cons'
        );
      } else if (entry.isStatusTick) {
        addLog(entry.statusMessage || 'Status tick', 'status');
      } else if (entry.turnSkipped) {
        addLog(
          attackerIsMe ? `⏭️ Você perdeu o turno!` : `⏭️ ${entry.attackerName} perdeu o turno!`,
          'status'
        );
      } else if (entry.defending) {
        addLog(attackerIsMe ? `🛡️ Você defendeu.` : `🛡️ ${entry.attackerName} está defendendo.`, 'def');
      } else if (entry.isDodge) {
        addLog(
          attackerIsMe
            ? `💨 ${entry.skillIcon} ${entry.skillName} — esquivado!`
            : `💨 ${entry.attackerName} usou ${entry.skillIcon} ${entry.skillName}, mas você esquivou!`,
          'dodge'
        );
      } else {
        const prefix = attackerIsMe ? '⚔️ Você usou' : `🔥 ${entry.attackerName} usou`;
        const critTag = entry.isCrit ? ' 💥CRÍTICO!' : '';
        const elemTag = entry.elementalMult > 1.0 ? ' 🔥 super-eficaz!'
          : entry.elementalMult < 1.0 ? ' 💢 pouco efetivo...' : '';
        const statusTag = entry.statusApplied
          ? ` ${entry.statusApplied.icon} ${entry.statusApplied.label} aplicado!` : '';
        addLog(
          `${prefix} ${entry.skillIcon} ${entry.skillName} — ${entry.damage} dano${critTag}${elemTag}${statusTag}`,
          entry.isCrit ? 'crit' : (attackerIsMe ? 'dmg' : 'enemy')
        );
      }
    }
  };

  const fetchState = async () => {
    try {
      const res = await fetch(`${API}/api/battle/state?battleId=${battle.battleId}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setState(data);
      consumeLogs(data.logs);
      if (data.outcome && !endedRef.current) {
        handleEnd(data.outcome === 'won');
      }
    } catch (e) {}
  };

  const loadSkills = async () => {
    try {
      const res = await fetch(`${API}/api/battle/skills?battleId=${battle.battleId}`, { headers: authHeaders() });
      const data = await res.json();
      setSkills(Array.isArray(data) ? data : []);
    } catch (e) { setSkills([]); }
  };

  const isMyTurn = state?.isMyTurn && !waiting && !ended;

  const useSkill = async (skill) => {
    if (!isMyTurn) return;
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
      await loadSkills();

      if (data.outcome === 'won') handleEnd(true);
      else if (data.outcome === 'lost') handleEnd(false);
    } finally { setWaiting(false); }
  };

  const useConsumable = async (cons) => {
    if (!isMyTurn || cons.quantity <= 0) return;
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
    } finally { setWaiting(false); }
  };

  const defendAction = async () => {
    if (!isMyTurn) return;
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
      await loadSkills();
      if (data.outcome === 'won') handleEnd(true);
      else if (data.outcome === 'lost') handleEnd(false);
    } finally { setWaiting(false); }
  };

  const handleEnd = (won) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    setResult(won ? 'win' : 'lose');
  };

  const myHp = state?.me?.hp ?? battle.player.hp;
  const myMaxHp = state?.me?.maxHp ?? battle.player.maxHp;
  const myChi = state?.me?.chi ?? battle.player.chi;
  const myMaxChi = state?.me?.maxChi ?? battle.player.maxChi;
  const oppHp = state?.opponent?.hp ?? battle.opponent.maxHp;
  const oppMaxHp = state?.opponent?.maxHp ?? battle.opponent.maxHp;
  const myConsumables = state?.me?.consumables || [];
  const myBuffs = state?.me?.buffs || [];
  const myStatus = state?.me?.statusEffects || [];
  const oppStatus = state?.opponent?.statusEffects || [];

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">📖 {battle.chapterTitle}</h1>
          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full">
            Cap.{battle.chapter} Cena {battle.scene + 1}
          </span>
        </div>

        {!ended && (
          <div className={`text-center mb-4 py-2 rounded-xl text-sm font-bold
            ${isMyTurn ? 'bg-teal-400/15 text-teal-300 border border-teal-400/30' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
            {waiting ? '⏳ Processando...' : isMyTurn ? `🎯 SEU TURNO (Turno ${state?.turnNumber || 1})` : `⏸️ Turno do oponente...`}
          </div>
        )}

        {/* VS cards */}
        <div className="grid grid-cols-3 gap-3 mb-5 items-center">
          <div className="bg-zinc-900 border border-teal-500/25 rounded-2xl p-4 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full border-2 border-teal-400 flex items-center justify-center text-4xl bg-zinc-800">
              {ELEMENT_ICON[battle.player.element] || '⚔️'}
            </div>
            <p className="text-teal-400 text-xs font-semibold truncate">Você · Lv.{battle.player.level}</p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>HP</span><span>{myHp}/{myMaxHp}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full ${ELEM_BAR[battle.player.element] || ELEM_BAR.Neutro}`}
                     style={{ width: `${(myHp / myMaxHp) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-zinc-500 mt-1 mb-0.5">
                <span>Chi</span><span>{myChi}/{myMaxChi}</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400" style={{ width: `${(myChi / myMaxChi) * 100}%` }} />
              </div>
            </div>
            {myBuffs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                {myBuffs.map((b, i) => (
                  <span key={i} className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">
                    {b.label} ({b.turnsRemaining}t)
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center font-black text-lg shadow-lg shadow-orange-500/30">VS</div>
          </div>

          <div className="bg-zinc-900 border border-red-500/25 rounded-2xl p-4 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full border-2 border-red-400 flex items-center justify-center text-4xl bg-zinc-800">
              {battle.opponent.icon}
            </div>
            <p className="text-red-400 text-xs font-semibold truncate">
              {battle.opponent.name} · Lv.{battle.opponent.level}
            </p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>HP</span><span>{oppHp}/{oppMaxHp}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full ${ELEM_BAR[battle.opponent.element] || ELEM_BAR.Neutro}`}
                     style={{ width: `${(oppHp / (oppMaxHp || 100)) * 100}%` }} />
              </div>
            </div>
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
            <p className="text-zinc-400 text-sm mb-4">
              {result === 'win'
                ? 'Você venceu o desafio da história! Continue a jornada.'
                : 'Você caiu, mas a história continua... Avance mesmo na derrota.'}
            </p>
            <button onClick={() => onEnd(result === 'win')}
              className="px-8 py-3 bg-gradient-to-r from-teal-400 to-cyan-400 text-zinc-900 font-bold rounded-xl">
              Continuar a Saga →
            </button>
          </div>
        ) : (
          <>
            {skills.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-zinc-500 mb-2">Suas ações</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {skills.map(skill => {
                    const onCooldown = skill.turnsRemaining > 0;
                    const lowChi = myChi < skill.chiCost;
                    const disabled = !isMyTurn || onCooldown || lowChi || waiting;
                    const isBasic = skill.id === 'ataque_basico';
                    const enabledStyle = isBasic
                      ? 'bg-zinc-700/40 hover:bg-zinc-600/50 border-zinc-500/40 text-zinc-100'
                      : 'bg-teal-400/10 hover:bg-teal-400/20 border-teal-400/25 text-teal-300';
                    return (
                      <button key={skill.id} onClick={() => useSkill(skill)} disabled={disabled}
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
                          <div className="text-red-400 text-[10px] mt-1">⏳ {skill.turnsRemaining}t</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {myConsumables.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-zinc-500 mb-2">🧪 Poções</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {myConsumables.map(cons => (
                    <button key={cons.inventoryId} onClick={() => useConsumable(cons)}
                      disabled={!isMyTurn || waiting || cons.quantity <= 0}
                      className={`p-2 rounded-xl border text-xs text-left transition-all
                        ${(!isMyTurn || waiting || cons.quantity <= 0)
                          ? 'bg-zinc-900/50 border-white/5 opacity-50 cursor-not-allowed'
                          : 'bg-purple-400/10 hover:bg-purple-400/20 border-purple-400/25 text-purple-300'}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-base">{cons.effect?.icon || '🧪'}</span>
                        <span className="font-bold truncate">{cons.itemName}</span>
                      </div>
                      <div className="text-zinc-500 text-[10px] truncate">{cons.effect?.label}</div>
                      <div className="text-zinc-400 text-[10px]">×{cons.quantity}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={defendAction} disabled={!isMyTurn || waiting}
              className={`w-full py-3 border rounded-xl text-sm font-semibold transition-all
                ${isMyTurn && !waiting
                  ? 'bg-zinc-900 hover:bg-sky-500/15 border-white/5 hover:border-sky-500/30 text-white'
                  : 'bg-zinc-900/50 border-white/5 text-zinc-500 cursor-not-allowed'}`}>
              🛡️ Defender
            </button>
          </>
        )}
      </div>
    </div>
  );
}
