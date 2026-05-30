// backend/src/lib/training-bosses.js
// 40 bosses curados — 10 por nação — baseados no universo de Avatar
//
// Cada boss tem:
//   - id, name, icon, description (flavor)
//   - nation, tier (1-10)
//   - personality: 'aggressive' | 'defensive' | 'wise' | 'trickster' | 'berserker'
//   - statMultiplier: ajusta stats sobre o player-level
//   - skillIds: skills que ele pode usar
//   - rewards: EXP/Yuan base + drop especial em tier 5 e 10

export const BOSS_PERSONALITIES = {
  aggressive: { label: 'Agressivo', desc: 'Ataca sempre com a skill mais forte disponível' },
  defensive:  { label: 'Defensivo', desc: 'Defende quando HP < 50%, prefere skills com debuff' },
  wise:       { label: 'Sábio',     desc: 'Avalia o melhor caminho a cada turno' },
  trickster:  { label: 'Trapaceiro', desc: 'Usa status, dot e CC preferencialmente' },
  berserker:  { label: 'Bersek',    desc: 'Mais perigoso quanto mais ferido' },
};

// 🌬️ TEMPLOS DO AR (1-10)
const AIR_BOSSES = [
  { id: 'air_1_aprendiz',  name: 'Aprendiz Monge',    icon: '🧒', tier: 1,  personality: 'defensive',  statMul: 0.85,
    desc: 'Um jovem em treinamento. Movimentos hesitantes, mas precisos.',
    skillIds: ['ataque_basico', 'rajada_de_vento'] },
  { id: 'air_2_acolito',   name: 'Acólito Gyatso',    icon: '🧘', tier: 2,  personality: 'wise',       statMul: 0.95,
    desc: 'Ensina por meio do exemplo. Cada movimento é uma lição.',
    skillIds: ['ataque_basico', 'rajada_de_vento', 'tempestade'] },
  { id: 'air_3_vento',     name: 'Mestre dos Ventos', icon: '💨', tier: 3,  personality: 'aggressive', statMul: 1.05,
    desc: 'Movimenta-se mais rápido que os olhos podem seguir.',
    skillIds: ['rajada_de_vento', 'tempestade', 'ataque_basico'] },
  { id: 'air_4_planador',  name: 'Mestre Planador',   icon: '🪂', tier: 4,  personality: 'trickster',  statMul: 1.15,
    desc: 'Usa o ar para enganar e desorientar.',
    skillIds: ['rajada_de_vento', 'tempestade', 'dobra_espirito'] },
  { id: 'air_5_pasku',     name: 'Mestre Pasku',      icon: '🌪️', tier: 5,  personality: 'wise',       statMul: 1.30,
    desc: 'Líder do Templo do Ar Oriental. Calmo como o céu.',
    skillIds: ['rajada_de_vento', 'tempestade', 'avatar_state'] },
  { id: 'air_6_jinora',    name: 'Espírito Jinora',   icon: '👻', tier: 6,  personality: 'trickster',  statMul: 1.40,
    desc: 'Sua presença espiritual transcende corpo e mente.',
    skillIds: ['dobra_espirito', 'tempestade', 'avatar_state'] },
  { id: 'air_7_gyatso',    name: 'Mestre Gyatso',     icon: '🧙', tier: 7,  personality: 'wise',       statMul: 1.55,
    desc: 'Preceptor do Avatar Aang. Sábio e poderoso.',
    skillIds: ['tempestade', 'avatar_state', 'equilibrio_lendario'] },
  { id: 'air_8_tenzin',    name: 'Mestre Tenzin',     icon: '🦝', tier: 8,  personality: 'defensive',  statMul: 1.70,
    desc: 'Filho de Aang, herdeiro do legado dos Nômades do Ar.',
    skillIds: ['tempestade', 'avatar_state', 'equilibrio_lendario'] },
  { id: 'air_9_aang',      name: 'Avatar Aang',       icon: '🌬️', tier: 9,  personality: 'wise',       statMul: 1.90,
    desc: 'O último Nômade do Ar e Avatar do Ciclo. Equilíbrio puro.',
    skillIds: ['avatar_state', 'tempestade', 'equilibrio_lendario', 'cometa_sozin'] },
  { id: 'air_10_yangchen', name: 'Avatar Yangchen',   icon: '👑', tier: 10, personality: 'wise',       statMul: 2.20,
    desc: 'Avatar lendária. Sua sabedoria perdura por gerações.',
    skillIds: ['avatar_state', 'tempestade', 'equilibrio_lendario', 'cometa_sozin', 'furia_dragao'] },
];

// 💧 TRIBO DA ÁGUA (1-10)
const WATER_BOSSES = [
  { id: 'water_1_cacador', name: 'Caçador Novato',    icon: '🥶', tier: 1,  personality: 'aggressive', statMul: 0.85,
    desc: 'Pesca peixes, mas treina com gelo nas horas vagas.',
    skillIds: ['ataque_basico', 'dobra_agua'] },
  { id: 'water_2_guarda',  name: 'Guarda da Tribo',   icon: '🛡️', tier: 2,  personality: 'defensive',  statMul: 0.95,
    desc: 'Protege a vila com escudos de gelo.',
    skillIds: ['ataque_basico', 'dobra_agua', 'cura_espiritual'] },
  { id: 'water_3_pescador',name: 'Pescador Mestre',   icon: '🎣', tier: 3,  personality: 'wise',       statMul: 1.05,
    desc: 'Aprendeu a dobrar mais peixes que homens.',
    skillIds: ['dobra_agua', 'cura_espiritual', 'tsunami_katara'] },
  { id: 'water_4_kuruk',   name: 'Sokka Veterano',    icon: '🪃', tier: 4,  personality: 'trickster',  statMul: 1.15,
    desc: 'Nem todos são dobradores. Alguns só precisam de um bumerangue.',
    skillIds: ['ataque_basico', 'dobra_agua', 'cura_espiritual'] },
  { id: 'water_5_katara',  name: 'Mestra Katara',     icon: '💧', tier: 5,  personality: 'wise',       statMul: 1.30,
    desc: 'Mestre dobradora de água do Polo Sul. Cura e ataca igualmente bem.',
    skillIds: ['dobra_agua', 'cura_espiritual', 'tsunami_katara', 'dobra_espirito'] },
  { id: 'water_6_pakku',   name: 'Mestre Pakku',      icon: '❄️', tier: 6,  personality: 'defensive',  statMul: 1.40,
    desc: 'Mestre do Polo Norte. Tradicionalista e mortal.',
    skillIds: ['dobra_agua', 'tsunami_katara', 'cura_espiritual'] },
  { id: 'water_7_yue',     name: 'Princesa Yue',      icon: '🌙', tier: 7,  personality: 'wise',       statMul: 1.55,
    desc: 'Espírito da Lua. Comanda as marés e a noite.',
    skillIds: ['tsunami_katara', 'dobra_espirito', 'cura_espiritual', 'avatar_state'] },
  { id: 'water_8_korra',   name: 'Avatar Korra',      icon: '🌊', tier: 8,  personality: 'aggressive', statMul: 1.70,
    desc: 'Avatar nascida na tribo. Bruta, direta e poderosa.',
    skillIds: ['avatar_state', 'tsunami_katara', 'cometa_sozin'] },
  { id: 'water_9_hama',    name: 'Hama, Anciã',       icon: '🩸', tier: 9,  personality: 'trickster',  statMul: 1.90,
    desc: 'Inventou a dobra de sangue. Velha, mas terrivelmente poderosa.',
    skillIds: ['dobra_espirito', 'tsunami_katara', 'avatar_state', 'equilibrio_lendario'] },
  { id: 'water_10_kuruk',  name: 'Avatar Kuruk',      icon: '🐳', tier: 10, personality: 'berserker',  statMul: 2.20,
    desc: 'Avatar que perdeu o amor. Caça espíritos por toda eternidade.',
    skillIds: ['avatar_state', 'tsunami_katara', 'furia_dragao', 'equilibrio_lendario', 'cometa_sozin'] },
];

// 🪨 REINO DA TERRA (1-10)
const EARTH_BOSSES = [
  { id: 'earth_1_recruta', name: 'Recruta Daofei',    icon: '⛏️', tier: 1,  personality: 'aggressive', statMul: 0.85,
    desc: 'Bandido de estrada. Ainda aprendendo a dobrar pedras.',
    skillIds: ['ataque_basico', 'projetil_pedra'] },
  { id: 'earth_2_dailee',  name: 'Agente Dai Li',     icon: '🕴️', tier: 2,  personality: 'trickster',  statMul: 0.95,
    desc: 'Polícia secreta de Ba Sing Se. Silencioso e mortal.',
    skillIds: ['ataque_basico', 'projetil_pedra', 'muro_de_terra'] },
  { id: 'earth_3_haru',    name: 'Mineiro Haru',      icon: '⚒️', tier: 3,  personality: 'defensive',  statMul: 1.05,
    desc: 'Trabalhou nas minas e descobriu o poder da terra.',
    skillIds: ['projetil_pedra', 'muro_de_terra', 'terremoto'] },
  { id: 'earth_4_sandbender', name: 'Dobrador de Areia', icon: '🏜️', tier: 4, personality: 'trickster', statMul: 1.15,
    desc: 'Não usa pedras — usa o deserto inteiro.',
    skillIds: ['projetil_pedra', 'terremoto', 'dobra_espirito'] },
  { id: 'earth_5_toph',    name: 'Mestra Toph',       icon: '🦯', tier: 5,  personality: 'aggressive', statMul: 1.30,
    desc: 'Cega desde o nascimento, "vê" pelas vibrações da terra.',
    skillIds: ['projetil_pedra', 'muro_de_terra', 'terremoto', 'tempestade'] },
  { id: 'earth_6_long',    name: 'Long Feng',         icon: '🐉', tier: 6,  personality: 'trickster',  statMul: 1.40,
    desc: 'Líder dos Dai Li. Mestre da manipulação mental.',
    skillIds: ['projetil_pedra', 'terremoto', 'dobra_espirito'] },
  { id: 'earth_7_rei',     name: 'Rei Kuei',          icon: '👑', tier: 7,  personality: 'defensive',  statMul: 1.55,
    desc: 'O lendário rei urso de Ba Sing Se. Bosco também ataca.',
    skillIds: ['terremoto', 'muro_de_terra', 'avatar_state'] },
  { id: 'earth_8_metal',   name: 'Suyin Metalbender', icon: '⚙️', tier: 8,  personality: 'wise',       statMul: 1.70,
    desc: 'Mestra da metaldobra. Forja e destrói com a mesma arte.',
    skillIds: ['terremoto', 'muro_de_terra', 'avatar_state', 'equilibrio_lendario'] },
  { id: 'earth_9_bumi',    name: 'Rei Bumi',          icon: '👴', tier: 9,  personality: 'berserker',  statMul: 1.90,
    desc: 'Lúcido como uma flor de pêssego, mortal como uma avalanche.',
    skillIds: ['terremoto', 'projetil_pedra', 'avatar_state', 'equilibrio_lendario'] },
  { id: 'earth_10_kyoshi', name: 'Avatar Kyoshi',     icon: '🎭', tier: 10, personality: 'wise',       statMul: 2.20,
    desc: 'Avatar de 230 anos. Criou as Ilhas Kyoshi com um único movimento.',
    skillIds: ['avatar_state', 'terremoto', 'equilibrio_lendario', 'furia_dragao', 'cometa_sozin'] },
];

// 🔥 NAÇÃO DO FOGO (1-10)
const FIRE_BOSSES = [
  { id: 'fire_1_recruta',  name: 'Recruta da Nação',  icon: '🔰', tier: 1,  personality: 'aggressive', statMul: 0.85,
    desc: 'Faísca pequena, mas em chamas.',
    skillIds: ['ataque_basico', 'dobra_fogo'] },
  { id: 'fire_2_soldado',  name: 'Soldado Imperial',  icon: '🪖', tier: 2,  personality: 'defensive',  statMul: 0.95,
    desc: 'Disciplinado e sem medo. Defende a Caldera.',
    skillIds: ['ataque_basico', 'dobra_fogo', 'circulo_de_fogo'] },
  { id: 'fire_3_yuyan',    name: 'Arqueiro Yuyan',    icon: '🏹', tier: 3,  personality: 'trickster',  statMul: 1.05,
    desc: 'Os melhores atiradores da Nação. Não erram um alvo.',
    skillIds: ['dobra_fogo', 'circulo_de_fogo', 'dobra_espirito'] },
  { id: 'fire_4_zhao',     name: 'Almirante Zhao',    icon: '⚓', tier: 4,  personality: 'aggressive', statMul: 1.15,
    desc: 'Ambicioso a ponto de desafiar a própria Lua.',
    skillIds: ['dobra_fogo', 'circulo_de_fogo', 'tempestade'] },
  { id: 'fire_5_iroh',     name: 'General Iroh',      icon: '🍵', tier: 5,  personality: 'wise',       statMul: 1.30,
    desc: 'O Dragão do Oeste. Sábio, gentil — e absolutamente devastador quando precisa.',
    skillIds: ['dobra_fogo', 'circulo_de_fogo', 'tempestade', 'avatar_state'] },
  { id: 'fire_6_mai',      name: 'Mai',               icon: '🗡️', tier: 6,  personality: 'trickster',  statMul: 1.40,
    desc: 'Não dobra fogo. Não precisa. Suas adagas voam mais rápido.',
    skillIds: ['dobra_fogo', 'tempestade', 'dobra_espirito'] },
  { id: 'fire_7_combust',  name: 'Homem Combustão',   icon: '💥', tier: 7,  personality: 'aggressive', statMul: 1.55,
    desc: 'Dobra fogo pela mente. Cada raio é uma execução.',
    skillIds: ['dobra_fogo', 'avatar_state', 'cometa_sozin'] },
  { id: 'fire_8_zuko',     name: 'Senhor do Fogo Zuko', icon: '🔥', tier: 8, personality: 'wise',      statMul: 1.70,
    desc: 'Príncipe banido virou Senhor do Fogo. Domina relâmpagos.',
    skillIds: ['dobra_fogo', 'tempestade', 'avatar_state', 'cometa_sozin'] },
  { id: 'fire_9_azula',    name: 'Princesa Azula',    icon: '⚡', tier: 9,  personality: 'berserker',  statMul: 1.90,
    desc: 'Genialidade absoluta, fogo azul. Quase imbatível antes da queda.',
    skillIds: ['dobra_fogo', 'avatar_state', 'cometa_sozin', 'furia_dragao'] },
  { id: 'fire_10_sozin',   name: 'Senhor do Fogo Sozin', icon: '☄️', tier: 10, personality: 'wise',    statMul: 2.20,
    desc: 'O homem que iniciou a Guerra de 100 Anos. Devastador como o cometa.',
    skillIds: ['avatar_state', 'cometa_sozin', 'furia_dragao', 'equilibrio_lendario', 'tempestade'] },
];

// ─── Catálogo completo ───
export const TRAINING_BOSSES = {
  Ar:    AIR_BOSSES,
  'Água': WATER_BOSSES,
  Terra: EARTH_BOSSES,
  Fogo:  FIRE_BOSSES,
};

// Lookup rápido
const _bossById = {};
[...AIR_BOSSES, ...WATER_BOSSES, ...EARTH_BOSSES, ...FIRE_BOSSES].forEach(b => {
  _bossById[b.id] = b;
});

export function getBossById(id) { return _bossById[id] || null; }
export function getBossesByNation(nation) { return TRAINING_BOSSES[nation] || []; }
export function getAllBosses() { return Object.values(TRAINING_BOSSES).flat(); }

// ─── Cálculo de stats do boss em função do nível do player ───
// Player Lv 10 enfrentando boss tier 5 (mul 1.30) → boss "Lv 13" com stats proporcionais
export function computeBossStats(boss, playerLevel) {
  const effectiveLevel = Math.max(1, Math.round(playerLevel * boss.statMul));
  // Fórmulas baseadas no character escalado
  return {
    level: effectiveLevel,
    elo: 500 + (boss.tier * 200),
    attack:  Math.round(20 + effectiveLevel * 2.0 * boss.statMul),
    defense: Math.round(15 + effectiveLevel * 1.6 * boss.statMul),
    maxHp:   Math.round(100 + effectiveLevel * 25 * boss.statMul),
    maxChi:  Math.round(50 + effectiveLevel * 5),
  };
}

// ─── Recompensas escaladas pelo tier + decrescente em re-vitórias ───
export function computeRewards(boss, totalWinsBefore = 0) {
  const baseExp = 30 + (boss.tier * 15);   // tier 1 = 45, tier 10 = 180
  const baseYuan = 15 + (boss.tier * 8);
  // Decrescente: 1ª vitória = 100%, 2ª = 60%, 3ª = 40%, 4ª+ = 25%
  const decay = totalWinsBefore === 0 ? 1.0
              : totalWinsBefore === 1 ? 0.6
              : totalWinsBefore === 2 ? 0.4
              : 0.25;
  return {
    exp:   Math.round(baseExp * decay),
    yuan:  Math.round(baseYuan * decay),
    isFirstWin: totalWinsBefore === 0,
    isMilestone: (boss.tier === 5 || boss.tier === 10) && totalWinsBefore === 0,
    decayFactor: decay,
  };
}

// ─── Gate de desbloqueio ───
// Boss tier N só fica disponível quando o boss tier (N-1) da MESMA nação foi derrotado
export function isBossUnlocked(boss, defeatedBossIds, playerLevel) {
  if (boss.tier === 1) return true; // primeiros sempre liberados
  const sameNation = getBossesByNation(boss.nation || guessNation(boss));
  const previousTier = sameNation.find(b => b.tier === boss.tier - 1);
  if (!previousTier) return true;
  return defeatedBossIds.includes(previousTier.id);
}

function guessNation(boss) {
  if (boss.id.startsWith('air_'))   return 'Ar';
  if (boss.id.startsWith('water_')) return 'Água';
  if (boss.id.startsWith('earth_')) return 'Terra';
  if (boss.id.startsWith('fire_'))  return 'Fogo';
  return 'Ar';
}

// Adiciona o nation ao cada boss (derivado do prefixo do id)
[...AIR_BOSSES].forEach(b => b.nation = 'Ar');
[...WATER_BOSSES].forEach(b => b.nation = 'Água');
[...EARTH_BOSSES].forEach(b => b.nation = 'Terra');
[...FIRE_BOSSES].forEach(b => b.nation = 'Fogo');
