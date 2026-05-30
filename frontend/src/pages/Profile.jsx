import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHeaders } from '../App';
import DiscordLinks from '../components/DiscordLinks';

const API = window.__API_URL__ || 'http://localhost:5000';

const ELEM_COLOR = { Fogo: 'text-orange-400', 'Água': 'text-sky-400', Terra: 'text-green-400', Ar: 'text-teal-300' };
const ELEM_ICON  = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' };

const RARITY_BORDER = {
  common:    'border-zinc-600/30',
  uncommon:  'border-teal-500/30',
  rare:      'border-purple-500/30',
  epic:      'border-amber-500/40',
  legendary: 'border-yellow-400/60',
};
const RARITY_COLOR = {
  common:    'text-zinc-400',
  uncommon:  'text-teal-400',
  rare:      'text-purple-400',
  epic:      'text-amber-400',
  legendary: 'text-yellow-300',
};
const TYPE_ICON = {
  weapon: '⚔️', armor: '🛡️', amulet: '📿',
  consumable: '🧪', material: '🧱', misc: '📦',
};

export default function Profile({ user, onLogout }) {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [battleHistory, setBattleHistory] = useState([]);
  const [tab, setTab] = useState('stats');
  const [crafting, setCrafting] = useState(null);
  const [equipBusy, setEquipBusy] = useState(null);
  const [equipBonus, setEquipBonus] = useState({ attack: 0, defense: 0, chi: 0, hp: 0 });
  const [consumableSlots, setConsumableSlots] = useState({ used: 0, max: 2, isPremium: false });
  const [loadout, setLoadout] = useState(null);
  const [clanBuff, setClanBuff] = useState(null);

  // ─── Craft livre ───
  const [craftMode, setCraftMode] = useState('free'); // 'free' | 'recipes'
  const [selectedIngredients, setSelectedIngredients] = useState([]); // [{ inventoryId, qty }]
  const [targetType, setTargetType] = useState('auto');
  const [craftResult, setCraftResult] = useState(null);
  const [craftBusy, setCraftBusy] = useState(false);

  const loadInventory = async () => {
    const [inv, equipped, slots] = await Promise.all([
      fetch(`${API}/api/inventory`, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
      fetch(`${API}/api/inventory/equipped`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({ bonus: {} })),
      fetch(`${API}/api/inventory/consumable-slots`, { headers: authHeaders() }).then(r => r.json()).catch(() => ({ used: 0, max: 2, isPremium: false })),
    ]);
    setInventory(Array.isArray(inv) ? inv : []);
    setEquipBonus(equipped.bonus || { attack: 0, defense: 0, chi: 0, hp: 0 });
    setConsumableSlots(slots);
  };

  const loadLoadout = async () => {
    const [lo, cb] = await Promise.all([
      fetch(`${API}/api/loadout`, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/loadout/clan-buff`, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
    ]);
    setLoadout(lo);
    setClanBuff(cb);
  };

  useEffect(() => {
    loadInventory();
    loadLoadout();
    fetch(`${API}/api/craft/recipes`).then(r => r.json()).then(setRecipes).catch(() => {});
    fetch(`${API}/api/battle/history`, { headers: authHeaders() })
      .then(r => r.json()).then(setBattleHistory).catch(() => {});
  }, []);

  const equipItem = async (item) => {
    setEquipBusy(item.id);
    try {
      const res = await fetch(`${API}/api/inventory/equip/${item.id}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) await loadInventory();
      else alert(`❌ ${data.error}`);
    } finally { setEquipBusy(null); }
  };

  const unequipItem = async (item) => {
    setEquipBusy(item.id);
    try {
      const res = await fetch(`${API}/api/inventory/unequip/${item.id}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) await loadInventory();
      else alert(`❌ ${data.error}`);
    } finally { setEquipBusy(null); }
  };

  const equipConsumable = async (item) => {
    setEquipBusy(item.id);
    try {
      const res = await fetch(`${API}/api/inventory/equip-consumable/${item.id}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) await loadInventory();
      else alert(`❌ ${data.error}`);
    } finally { setEquipBusy(null); }
  };

  const unequipConsumable = async (item) => {
    setEquipBusy(item.id);
    try {
      const res = await fetch(`${API}/api/inventory/unequip-consumable/${item.id}`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) await loadInventory();
      else alert(`❌ ${data.error}`);
    } finally { setEquipBusy(null); }
  };

  const equipSkill = async (skillId) => {
    setEquipBusy(skillId);
    try {
      const res = await fetch(`${API}/api/loadout/equip-skill`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ skillId }),
      });
      const data = await res.json();
      if (res.ok) await loadLoadout();
      else alert(`❌ ${data.error}`);
    } finally { setEquipBusy(null); }
  };

  const unequipSkill = async (skillId) => {
    setEquipBusy(skillId);
    try {
      const res = await fetch(`${API}/api/loadout/unequip-skill`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ skillId }),
      });
      const data = await res.json();
      if (res.ok) await loadLoadout();
      else alert(`❌ ${data.error}`);
    } finally { setEquipBusy(null); }
  };

  const toggleClanBuff = async () => {
    try {
      const res = await fetch(`${API}/api/loadout/toggle-clan-buff`, {
        method: 'POST', headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) await loadLoadout();
      else alert(`❌ ${data.error}`);
    } catch {}
  };

  const craftItem = async (recipe) => {
    setCrafting(recipe.id);
    try {
      const res = await fetch(`${API}/api/craft/craft`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ recipeId: recipe.id }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.item} criado com sucesso!`);
        await loadInventory();
      } else alert(`❌ ${data.error}`);
    } finally { setCrafting(null); }
  };

  // ─── Craft Livre ───
  const toggleIngredient = (inventoryId) => {
    setSelectedIngredients(prev => {
      const existing = prev.find(p => p.inventoryId === inventoryId);
      if (existing) return prev.filter(p => p.inventoryId !== inventoryId);
      if (prev.length >= 4) {
        alert('Máximo de 4 ingredientes por craft.');
        return prev;
      }
      return [...prev, { inventoryId, qty: 1 }];
    });
    setCraftResult(null);
  };

  const setIngredientQty = (inventoryId, qty) => {
    setSelectedIngredients(prev =>
      prev.map(p => p.inventoryId === inventoryId ? { ...p, qty: Math.max(1, parseInt(qty) || 1) } : p)
    );
  };

  const craftFree = async () => {
    if (selectedIngredients.length < 2) {
      alert('Selecione pelo menos 2 ingredientes.');
      return;
    }
    setCraftBusy(true);
    setCraftResult(null);
    try {
      const res = await fetch(`${API}/api/craft/craft-free`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          ingredients: selectedIngredients.map(i => ({ inventoryId: i.inventoryId, quantity: i.qty })),
          targetType: targetType === 'auto' ? null : targetType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCraftResult(data);
        setSelectedIngredients([]);
        await loadInventory();
      } else {
        alert(`❌ ${data.error}`);
      }
    } finally { setCraftBusy(false); }
  };

  const winRate = user?.wins + user?.losses > 0
    ? Math.round((user.wins / (user.wins + user.losses)) * 100)
    : 0;
  const expRequired = (user?.level || 1) * 200;
  const expPct = Math.min(100, Math.round(((user?.exp || 0) / expRequired) * 100)) || 0;

  const consumablesInInv = inventory.filter(i => i.consumable && i.quantity > 0);
  const equippedConsumables = consumablesInInv.filter(i => i.isConsumableEquipped);

  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen page-in">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 lg:py-6 stagger">

        {/* ═══ HERO CARD ═══ */}
        <div className="bg-zinc-900 rounded-2xl p-5 lg:p-6 border border-white/5 mb-4 lg:mb-6 relative overflow-hidden lift">
          {/* Elemental glow corner */}
          <div className="absolute -top-20 -right-20 w-60 h-60 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.15), transparent 70%)' }} />

          <div className="flex items-center gap-4 lg:gap-5 flex-wrap relative">
            {/* Avatar with rotating ring */}
            <div className="relative w-20 h-20 lg:w-24 lg:h-24 flex-shrink-0">
              <div className="avatar-ring"></div>
              <img src={user?.discordAvatar || 'https://via.placeholder.com/80'}
                className="w-full h-full rounded-2xl border-2 border-teal-400 shadow-lg shadow-teal-500/20 relative z-10"
                alt="avatar" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-xl lg:text-2xl font-bold truncate">{user?.discordUsername}</h1>
                <span className={`text-sm font-semibold ${ELEM_COLOR[user?.element] || 'text-zinc-400'}`}>
                  {ELEM_ICON[user?.element]} {user?.element || '—'}
                </span>
              </div>
              <p className="text-zinc-400 text-xs lg:text-sm">{user?.name} · Nível {user?.level}</p>
              <div className="flex gap-3 lg:gap-5 mt-3 flex-wrap">
                <div><span className="text-lg lg:text-xl font-bold text-teal-400">{user?.wins || 0}</span><span className="text-[10px] lg:text-xs text-zinc-500 ml-1">Vit.</span></div>
                <div><span className="text-lg lg:text-xl font-bold text-red-400">{user?.losses || 0}</span><span className="text-[10px] lg:text-xs text-zinc-500 ml-1">Der.</span></div>
                <div><span className="text-lg lg:text-xl font-bold text-amber-400">{winRate}%</span><span className="text-[10px] lg:text-xs text-zinc-500 ml-1">WR</span></div>
                <div><span className="text-lg lg:text-xl font-bold text-yellow-400">{user?.money || 0}</span><span className="text-[10px] lg:text-xs text-zinc-500 ml-1">💰</span></div>
              </div>
            </div>

            <button onClick={onLogout}
              className="hidden lg:block text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl transition-all">
              Sair
            </button>
          </div>

          {/* EXP/Chi bars with shimmer */}
          <div className="mt-4 lg:mt-5 space-y-2 relative">
            <div>
              <div className="flex justify-between text-[10px] lg:text-xs text-zinc-500 mb-1 font-mono">
                <span>EXP</span><span>{user?.exp || 0} / {(user?.level || 1) * 200}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden bar-shimmer">
                <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full transition-all"
                  style={{ width: `${expPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] lg:text-xs text-zinc-500 mb-1 font-mono">
                <span>Chi</span><span>{user?.chi || 0} / {user?.maxChi || 50}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full"
                  style={{ width: `${((user?.chi || 0) / (user?.maxChi || 1)) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ QUICK ACTIONS ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-4 lg:mb-6">
          <button onClick={() => navigate('/arena')}
            className="lift bg-zinc-900 border border-white/5 hover:border-orange-500/40 rounded-2xl p-3 lg:p-4 text-left relative overflow-hidden">
            <span className="glow-corner" style={{ background: 'rgba(249, 115, 22, 0.25)' }} />
            <div className="text-2xl lg:text-3xl mb-1.5 relative">⚔️</div>
            <div className="font-bold text-sm relative">Arena</div>
            <div className="text-[10px] lg:text-xs text-zinc-500 mt-0.5 relative">Batalhar agora</div>
          </button>
          <button onClick={() => navigate('/historia')}
            className="lift bg-zinc-900 border border-white/5 hover:border-amber-500/40 rounded-2xl p-3 lg:p-4 text-left relative overflow-hidden">
            <span className="glow-corner" style={{ background: 'rgba(251, 191, 36, 0.25)' }} />
            <div className="text-2xl lg:text-3xl mb-1.5 relative">📖</div>
            <div className="font-bold text-sm relative">História</div>
            <div className="text-[10px] lg:text-xs text-zinc-500 mt-0.5 relative">Continuar saga</div>
          </button>
          <button onClick={() => navigate('/quests')}
            className="lift bg-zinc-900 border border-white/5 hover:border-teal-500/40 rounded-2xl p-3 lg:p-4 text-left relative overflow-hidden">
            <span className="glow-corner" style={{ background: 'rgba(45, 212, 191, 0.25)' }} />
            <div className="text-2xl lg:text-3xl mb-1.5 relative">📜</div>
            <div className="font-bold text-sm relative">Missões</div>
            <div className="text-[10px] lg:text-xs text-zinc-500 mt-0.5 relative">Mural do dia</div>
          </button>
          <button onClick={() => navigate('/market')}
            className="lift bg-zinc-900 border border-white/5 hover:border-purple-500/40 rounded-2xl p-3 lg:p-4 text-left relative overflow-hidden">
            <span className="glow-corner" style={{ background: 'rgba(168, 85, 247, 0.25)' }} />
            <div className="text-2xl lg:text-3xl mb-1.5 relative">🏪</div>
            <div className="font-bold text-sm relative">Mercado</div>
            <div className="text-[10px] lg:text-xs text-zinc-500 mt-0.5 relative">Comprar / Trocar</div>
          </button>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
          {[
            ['stats',     '📊 Stats'],
            ['loadout',   '⚔️ Loadout'],
            ['inventory', '🎒 Inventário'],
            ['arena',     '🧪 Arena'],
            ['craft',     '🔨 Crafting'],
            ['history',   '📋 Histórico'],
          ].map(([k, v]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0
                ${tab === k ? 'bg-teal-400/15 text-teal-400 border border-teal-400/25' : 'bg-zinc-900 text-zinc-400 border border-white/5 hover:text-white'}`}>
              {v}
            </button>
          ))}
        </div>

        {/* ─── STATS ─── */}
        {tab === 'stats' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Ataque',  base: user?.attack,  bonus: equipBonus.attack,  color: 'text-orange-400', icon: '⚔️', tint: 'from-orange-500/8' },
                { label: 'Defesa',  base: user?.defense, bonus: equipBonus.defense, color: 'text-sky-400',    icon: '🛡️', tint: 'from-sky-500/8' },
                { label: 'HP',      base: user?.maxHp,   bonus: equipBonus.hp,      color: 'text-red-400',    icon: '❤️',  displayBase: user?.hp,  tint: 'from-red-500/8' },
                { label: 'Chi',     base: user?.maxChi,  bonus: equipBonus.chi,     color: 'text-purple-400', icon: '💜',  displayBase: user?.chi, tint: 'from-purple-500/8' },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900 border border-white/5 rounded-2xl p-5 text-center relative overflow-hidden lift">
                  <div className={`absolute inset-0 bg-gradient-to-br ${s.tint} to-transparent pointer-events-none`} />
                  <div className="text-3xl mb-1 relative">{s.icon}</div>
                  <div className={`text-2xl lg:text-3xl font-bold ${s.color} relative`}>
                    {s.displayBase !== undefined ? `${s.displayBase}/${s.base + (s.bonus || 0)}` : (s.base + (s.bonus || 0))}
                  </div>
                  {s.bonus > 0 && (
                    <div className="text-[10px] text-teal-400 mt-0.5 relative font-mono">
                      {s.base} <span className="text-teal-300">+{s.bonus}</span>
                    </div>
                  )}
                  <div className="text-xs text-zinc-500 mt-1 relative">{s.label}</div>
                </div>
              ))}
            </div>
            {(equipBonus.attack + equipBonus.defense + equipBonus.chi + equipBonus.hp) > 0 && (
              <p className="text-xs text-zinc-500 text-center">
                💡 Valores em <span className="text-teal-400">verde</span> são bônus dos itens equipados.
              </p>
            )}
          </>
        )}

        {/* ─── LOADOUT (skills + clan buff) ─── */}
        {tab === 'loadout' && loadout && (
          <div className="space-y-5">
            {/* Plano Free vs Premium */}
            <div className="bg-zinc-900 border border-teal-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold text-sm">⚔️ Slots de Skills</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Skills equipadas aparecem na arena. Ataque Básico é sempre disponível.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-teal-400">{loadout.slotsUsed}/{loadout.maxSlots}</div>
                  <div className="text-xs text-zinc-500">{loadout.isPremium ? 'Premium' : 'Free'}</div>
                </div>
              </div>
              {!loadout.isPremium && (
                <p className="text-xs text-purple-300 mt-2">
                  💎 Premium tem 6 slots (vs 3 no Free). <a href="/plans" className="underline">Ver Planos →</a>
                </p>
              )}
            </div>

            {/* Skills disponíveis */}
            <div>
              <h3 className="font-bold text-sm mb-2 text-zinc-300">📚 Skills Disponíveis</h3>
              {loadout.available.length === 0 && (
                <p className="text-zinc-500 text-sm py-4 text-center">
                  Você ainda não tem skills suficientes. Complete capítulos da história ou compre na Loja Yuan.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {loadout.available.map(skill => (
                  <div key={skill.id}
                    className={`bg-zinc-900 border-2 rounded-xl p-3 transition-all
                      ${skill.equipped ? 'border-teal-500/50 ring-1 ring-teal-500/30' : 'border-white/5'}`}>
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{skill.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {skill.name}
                          {skill.tier === 4 && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">LENDÁRIA</span>}
                        </div>
                        <div className="text-xs text-zinc-500">
                          🎯 {skill.baseDamageMin}-{skill.baseDamageMax} · 💜 {skill.chiCost} · ⏱️ {skill.baseCooldownTurns}t
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => skill.equipped ? unequipSkill(skill.id) : equipSkill(skill.id)}
                      disabled={equipBusy === skill.id}
                      className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all
                        ${skill.equipped
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                          : 'bg-teal-400/10 hover:bg-teal-400/20 text-teal-400 border border-teal-400/20'}`}>
                      {equipBusy === skill.id ? '⏳' : skill.equipped ? 'Desequipar' : 'Equipar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Clan buff */}
            {clanBuff && (
              <div className="bg-zinc-900 border border-purple-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">🏛️ Bônus de Clã (Colônia)</h3>
                  {clanBuff.hasClan ? (
                    <button onClick={toggleClanBuff}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        clanBuff.clanBuffActive
                          ? 'bg-teal-400 text-zinc-900'
                          : 'bg-zinc-700 text-zinc-300'
                      }`}>
                      {clanBuff.clanBuffActive ? '✓ Ativo' : 'Desativado'}
                    </button>
                  ) : null}
                </div>
                {!clanBuff.hasClan ? (
                  <p className="text-xs text-zinc-500">
                    Você não está em nenhum clã. Junte-se a um clã para ganhar bônus passivos na arena.
                  </p>
                ) : (
                  <>
                    <div className="text-xs text-zinc-400 mb-2">
                      Clã: <strong className="text-white">{clanBuff.clan.name}</strong> ({ELEM_ICON[clanBuff.clan.element]} {clanBuff.clan.element}, Lv {clanBuff.clan.level})
                    </div>
                    {clanBuff.clanBuffActive && (
                      <div className="flex flex-wrap gap-3 text-xs">
                        {clanBuff.buff.attack > 0  && <span className="text-orange-400">⚔️ +{clanBuff.buff.attack}</span>}
                        {clanBuff.buff.defense > 0 && <span className="text-sky-400">🛡️ +{clanBuff.buff.defense}</span>}
                        {clanBuff.buff.chi > 0     && <span className="text-purple-400">💜 +{clanBuff.buff.chi}</span>}
                        {clanBuff.buff.hp > 0      && <span className="text-red-400">❤️ +{clanBuff.buff.hp}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── INVENTORY (gear) ─── */}
        {tab === 'inventory' && (
          <div>
            {(equipBonus.attack + equipBonus.defense + equipBonus.chi + equipBonus.hp) > 0 && (
              <div className="bg-zinc-900 border border-teal-500/20 rounded-xl p-3 mb-4 flex flex-wrap gap-3 justify-center text-xs">
                <span className="text-zinc-500">Bônus equipados:</span>
                {equipBonus.attack > 0 && <span className="text-orange-400">⚔️ +{equipBonus.attack}</span>}
                {equipBonus.defense > 0 && <span className="text-sky-400">🛡️ +{equipBonus.defense}</span>}
                {equipBonus.hp > 0 && <span className="text-red-400">❤️ +{equipBonus.hp}</span>}
                {equipBonus.chi > 0 && <span className="text-purple-400">💜 +{equipBonus.chi}</span>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inventory.length === 0 && <p className="text-zinc-500 col-span-2 py-8 text-center">Inventário vazio.</p>}
              {inventory.filter(i => i.quantity > 0).map(item => {
                const rarity = item.rarity || 'common';
                const statsText = Object.entries(item.stats || {})
                  .map(([k, v]) => {
                    const icon = { attack: '⚔️', defense: '🛡️', chi: '💜', hp: '❤️' }[k] || k;
                    return `${icon} +${v}`;
                  }).join('  ');
                return (
                  <div key={item.id} className={`bg-zinc-900 border-2 rounded-xl p-4 transition-all
                    ${item.isEquipped ? 'border-teal-500/40 ring-2 ring-teal-500/20' : RARITY_BORDER[rarity]}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                        {TYPE_ICON[item.type] || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{item.itemName}</div>
                        <div className={`text-xs ${RARITY_COLOR[rarity]}`}>
                          {rarity} · ×{item.quantity}
                          {item.element && item.element !== 'Neutro' && ` · ${item.element}`}
                        </div>
                        {statsText && (
                          <div className="text-xs text-zinc-400 mt-1">{statsText}</div>
                        )}
                      </div>
                      {item.isEquipped && (
                        <span className="text-xs bg-teal-400/20 text-teal-400 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          ✓ Equipado
                        </span>
                      )}
                      {item.isConsumableEquipped && (
                        <span className="text-xs bg-purple-400/20 text-purple-300 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          🧪 Arena
                        </span>
                      )}
                    </div>

                    {item.equippable && (
                      <button
                        onClick={() => item.isEquipped ? unequipItem(item) : equipItem(item)}
                        disabled={equipBusy === item.id}
                        className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all
                          ${item.isEquipped
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                            : 'bg-teal-400/10 hover:bg-teal-400/20 text-teal-400 border border-teal-400/20'}`}>
                        {equipBusy === item.id ? '⏳' : item.isEquipped ? 'Desequipar' : 'Equipar'}
                      </button>
                    )}
                    {item.consumable && (
                      <button
                        onClick={() => item.isConsumableEquipped ? unequipConsumable(item) : equipConsumable(item)}
                        disabled={equipBusy === item.id}
                        className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all
                          ${item.isConsumableEquipped
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                            : 'bg-purple-400/10 hover:bg-purple-400/20 text-purple-300 border border-purple-400/20'}`}>
                        {equipBusy === item.id
                          ? '⏳'
                          : item.isConsumableEquipped
                            ? 'Tirar da Arena'
                            : item.effect?.label
                              ? `🧪 Equipar p/ Arena (${item.effect.label})`
                              : '🧪 Equipar p/ Arena'}
                      </button>
                    )}
                    {!item.equippable && !item.consumable && item.type !== 'misc' && (
                      <div className="text-[10px] text-zinc-500 text-center mt-1">
                        {item.type === 'material' ? 'Material' : 'Item misc'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── ARENA (consumíveis equipados) ─── */}
        {tab === 'arena' && (
          <div>
            <div className="bg-zinc-900 border border-purple-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-bold text-sm">🧪 Poções Prontas p/ Arena</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Estas poções podem ser usadas DURANTE a batalha. Uso instantâneo, não consome turno.
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-300">{consumableSlots.used}/{consumableSlots.max}</div>
                  <div className="text-xs text-zinc-500">{consumableSlots.isPremium ? 'Premium' : 'Free'}</div>
                </div>
              </div>
              {!consumableSlots.isPremium && (
                <p className="text-xs text-purple-300 mt-2">
                  💎 Premium tem 4 slots (vs 2 no Free).
                </p>
              )}
            </div>

            <h3 className="font-bold text-sm mb-2 text-zinc-300">Equipadas:</h3>
            {equippedConsumables.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4 text-center bg-zinc-900 rounded-xl border border-white/5">
                Nenhuma poção equipada. Vá para Inventário e equipe consumíveis.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {equippedConsumables.map(item => (
                  <div key={item.id} className="bg-zinc-900 border-2 border-purple-500/40 ring-1 ring-purple-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="text-3xl">{item.effect?.icon || '🧪'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{item.itemName}</div>
                        <div className="text-xs text-purple-300 mt-1">{item.effect?.label}</div>
                        <div className="text-xs text-zinc-500 mt-1">×{item.quantity} unidades</div>
                      </div>
                    </div>
                    <button onClick={() => unequipConsumable(item)} disabled={equipBusy === item.id}
                      className="w-full mt-2 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20">
                      {equipBusy === item.id ? '⏳' : 'Tirar da Arena'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h3 className="font-bold text-sm mb-2 text-zinc-300">Disponíveis no inventário:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {consumablesInInv.filter(i => !i.isConsumableEquipped).length === 0 && (
                <p className="text-zinc-500 text-sm py-4 text-center col-span-2">
                  Nenhuma poção disponível. Compre na Loja Yuan ou Loja Real.
                </p>
              )}
              {consumablesInInv.filter(i => !i.isConsumableEquipped).map(item => (
                <div key={item.id} className="bg-zinc-900 border-2 border-white/5 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="text-3xl">{item.effect?.icon || '🧪'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{item.itemName}</div>
                      <div className="text-xs text-zinc-400 mt-1">{item.effect?.label}</div>
                      <div className="text-xs text-zinc-500 mt-1">×{item.quantity} unidades</div>
                    </div>
                  </div>
                  <button onClick={() => equipConsumable(item)}
                    disabled={equipBusy === item.id || consumableSlots.used >= consumableSlots.max}
                    className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all
                      ${consumableSlots.used >= consumableSlots.max
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-purple-400/10 hover:bg-purple-400/20 text-purple-300 border border-purple-400/20'}`}>
                    {equipBusy === item.id ? '⏳' :
                      consumableSlots.used >= consumableSlots.max ? 'Sem slots' : '🧪 Equipar p/ Arena'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── CRAFT ─── */}
        {tab === 'craft' && (
          <div>
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => { setCraftMode('free'); setCraftResult(null); }}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${craftMode === 'free' ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
                🔮 Craft Livre
              </button>
              <button onClick={() => setCraftMode('recipes')}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${craftMode === 'recipes' ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30' : 'bg-zinc-900 text-zinc-400 border border-white/5'}`}>
                📜 Receitas Oficiais
              </button>
            </div>

            {/* ─── CRAFT LIVRE ─── */}
            {craftMode === 'free' && (
              <div>
                <div className="bg-zinc-900 border border-amber-500/20 rounded-xl p-4 mb-4 text-xs text-zinc-300">
                  💡 <strong className="text-amber-300">Sistema Livre:</strong> escolha 2-4 ingredientes do seu inventário e crie um item baseado neles.
                  Mais ingredientes do mesmo tipo/elemento/raridade = melhor resultado.
                </div>

                {/* Ingredientes selecionados */}
                <h3 className="font-bold text-sm mb-2 text-amber-300">
                  Ingredientes selecionados ({selectedIngredients.length}/4)
                </h3>
                {selectedIngredients.length === 0 ? (
                  <p className="text-zinc-500 text-sm py-3 text-center bg-zinc-900 rounded-xl border border-white/5 mb-4">
                    Clique em itens abaixo para adicionar.
                  </p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {selectedIngredients.map(sel => {
                      const item = inventory.find(i => i.id === sel.inventoryId);
                      if (!item) return null;
                      return (
                        <div key={sel.inventoryId} className="bg-zinc-900 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
                          <div className="text-2xl">{TYPE_ICON[item.type] || '📦'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{item.itemName}</div>
                            <div className="text-xs text-zinc-500">
                              {item.rarity || 'common'} · {item.element || 'Neutro'} · disponível: {item.quantity}
                            </div>
                          </div>
                          <input type="number" min="1" max={item.quantity}
                            value={sel.qty}
                            onChange={e => setIngredientQty(sel.inventoryId, e.target.value)}
                            className="w-16 bg-zinc-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-center" />
                          <button onClick={() => toggleIngredient(sel.inventoryId)}
                            className="text-red-400 hover:text-red-300 text-sm px-2">✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tipo desejado */}
                {selectedIngredients.length >= 2 && (
                  <div className="mb-4">
                    <label className="block text-xs text-zinc-400 mb-2">Tipo de item desejado:</label>
                    <select value={targetType} onChange={e => setTargetType(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm">
                      <option value="auto">🎯 Automático (baseado nos ingredientes)</option>
                      <option value="weapon">⚔️ Arma</option>
                      <option value="armor">🛡️ Armadura</option>
                      <option value="amulet">📿 Amuleto</option>
                      <option value="consumable">🧪 Consumível (poção)</option>
                    </select>
                  </div>
                )}

                {/* Botão craftar */}
                {selectedIngredients.length >= 2 && (
                  <button onClick={craftFree} disabled={craftBusy}
                    className="w-full py-3 mb-4 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-900 font-bold rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50">
                    {craftBusy ? '🔨 Craftando...' : `🔨 CRAFTAR (${selectedIngredients.length} ingrediente${selectedIngredients.length > 1 ? 's' : ''})`}
                  </button>
                )}

                {/* Resultado */}
                {craftResult && (
                  <div className="bg-gradient-to-br from-amber-500/15 to-orange-500/15 border-2 border-amber-500/40 rounded-2xl p-5 mb-4 text-center">
                    <div className="text-4xl mb-2">✨</div>
                    <div className="text-lg font-bold text-amber-300 mb-1">{craftResult.result.name}</div>
                    <div className="text-xs text-zinc-400 mb-2">
                      {craftResult.result.type} · {craftResult.result.element} · {craftResult.result.rarity}
                    </div>
                    {craftResult.result.stats && Object.keys(craftResult.result.stats).length > 0 && (
                      <div className="flex justify-center gap-3 text-xs mb-2">
                        {Object.entries(craftResult.result.stats).map(([k, v]) => {
                          const icon = { attack: '⚔️', defense: '🛡️', chi: '💜', hp: '❤️' }[k] || k;
                          return <span key={k} className="text-zinc-300">{icon} +{v}</span>;
                        })}
                      </div>
                    )}
                    <div className="text-xs text-yellow-400">−{craftResult.yuanSpent} Yuan</div>
                  </div>
                )}

                {/* Itens do inventário disponíveis */}
                <h3 className="font-bold text-sm mb-2 text-zinc-300">Seu inventário (clique para adicionar)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {inventory.filter(i => i.quantity > 0 && !i.isEquipped && !i.isConsumableEquipped).length === 0 && (
                    <p className="text-zinc-500 text-sm py-4 text-center col-span-3">
                      Nenhum item disponível para craft. (Itens equipados não podem ser usados.)
                    </p>
                  )}
                  {inventory
                    .filter(i => i.quantity > 0 && !i.isEquipped && !i.isConsumableEquipped)
                    .map(item => {
                      const isSelected = selectedIngredients.some(s => s.inventoryId === item.id);
                      return (
                        <button key={item.id}
                          onClick={() => toggleIngredient(item.id)}
                          className={`p-2 rounded-xl border-2 transition-all text-left
                            ${isSelected
                              ? 'border-amber-500/60 bg-amber-500/15'
                              : 'border-white/5 bg-zinc-900 hover:border-amber-500/30'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{TYPE_ICON[item.type] || '📦'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{item.itemName}</div>
                              <div className="text-[10px] text-zinc-500">
                                {item.rarity} · ×{item.quantity}
                              </div>
                            </div>
                            {isSelected && <span className="text-amber-300 text-xs">✓</span>}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ─── RECEITAS OFICIAIS ─── */}
            {craftMode === 'recipes' && (
              <div className="space-y-3">
                {recipes.length === 0 && (
                  <p className="text-zinc-500 text-sm py-8 text-center">Nenhuma receita oficial disponível.</p>
                )}
                {recipes.map(recipe => (
                  <div key={recipe.id} className="bg-zinc-900 border border-white/5 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold mb-1">{recipe.name}</div>
                        <div className="text-sm text-teal-300">→ {recipe.resultItem}</div>
                        <div className="text-xs text-zinc-500 mt-2">
                          Custo: {recipe.requiredYuan} Yuan ·
                          Requer: {Object.entries(recipe.requiredItems).map(([k, v]) => `${k} ×${v}`).join(', ')}
                        </div>
                      </div>
                      <button
                        onClick={() => craftItem(recipe)}
                        disabled={crafting === recipe.id}
                        className="px-5 py-2 bg-teal-400 hover:bg-teal-300 text-zinc-900 rounded-xl text-sm font-bold transition-all flex-shrink-0 disabled:opacity-50">
                        {crafting === recipe.id ? '...' : 'Craftar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── HISTORY ─── */}
        {tab === 'history' && (
          <div className="space-y-2">
            {battleHistory.length === 0 && <p className="text-zinc-500 py-8 text-center">Nenhuma batalha ainda.</p>}
            {battleHistory.map(b => (
              <div key={b.id} className={`bg-zinc-900 border rounded-xl p-4 flex items-center gap-3 ${b.result === 'win' ? 'border-teal-500/20' : 'border-red-500/20'}`}>
                <span className="text-2xl">{b.result === 'win' ? '🏆' : '💥'}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">vs {b.opponentName} ({b.opponentElement})</div>
                  <div className="text-xs text-zinc-500">{new Date(b.createdAt).toLocaleDateString('pt-BR')}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${b.result === 'win' ? 'text-teal-400' : 'text-red-400'}`}>{b.result === 'win' ? 'Vitória' : 'Derrota'}</div>
                  <div className="text-xs text-zinc-500">+{b.expGained} EXP</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {}
        <div className="mt-6">
          <DiscordLinks />
        </div>
      </div>
    </div>
  );
}
