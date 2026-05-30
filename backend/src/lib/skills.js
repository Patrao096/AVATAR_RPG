// backend/src/lib/skills.js
//
// ESTRUTURA:
//   - 20 skills por elemento (Fogo, Água, Terra, Ar) — SEM skills neutras
//   - Cada elemento dividido em 2 caminhos de 10 skills
//   - Skills têm níveis 1–5 com escalagem via `getLeveledSkill(id, level)`
//   - Campo `passiveEffect` descreve efeito de status aplicado
//   - Skill ULTIMATE (custo >= 80 Chi) é a última de cada caminho
//
// CAMINHOS:
//   Fogo  → A: Intensidade  | B: Controle (Azula)
//   Água  → A: Agressão     | B: Suporte/Cura (Katara)
//   Terra → A: Tank         | B: Sismo (Toph)
//   Ar    → A: Velocidade   | B: Poder (Aang)
//
// UPGRADE (skillUpgrades no Character):
//   Nível 1 → base (desbloqueado)
//   Nível 2 → +15% dano, efeito dura +1 turno
//   Nível 3 → +30% dano, custo Chi reduz 10%
//   Nível 4 → +50% dano, efeito secundário ativa
//   Nível 5 → +70% dano, efeito único maximizado

// ─── ATAQUE BÁSICO (mantido para fallback da arena) ────────────────────
export const ATTACK_BASIC = {
  id: 'ataque_basico',
  name: 'Soco',
  element: 'Neutro',
  icon: '👊',
  path: null,
  baseDamageMin: 8,
  baseDamageMax: 15,
  chiCost: 0,
  baseCooldownTurns: 0,
  tier: 0,
  minLevel: 1,
  passiveEffect: null,
  effectDuration: 0,
  description: 'Soco básico. Sempre disponível, sem chi nem cooldown. Use quando precisar de uma jogada simples.',
  alwaysAvailable: true,
};

// 🔥 FOGO — 20 Skills

const FOGO_SKILLS = {

  // ─── CAMINHO A: INTENSIDADE (dano puro, explosão, fogo ofensivo) ───────

  dobra_fogo: {
    id: 'dobra_fogo', name: 'Dobra de Fogo', element: 'Fogo', path: 'A',
    icon: '🔥', tier: 1, minLevel: 1,
    baseDamageMin: 20, baseDamageMax: 32, chiCost: 12, baseCooldownTurns: 1,
    passiveEffect: null, effectDuration: 0,
    description: 'Projeta uma chama concentrada. Dano direto sem efeito extra.',
  },
  chamas_duplas: {
    id: 'chamas_duplas', name: 'Chamas Duplas', element: 'Fogo', path: 'A',
    icon: '🤲🔥', tier: 1, minLevel: 3,
    baseDamageMin: 18, baseDamageMax: 26, chiCost: 18, baseCooldownTurns: 2,
    passiveEffect: 'multi_hit', effectDuration: 0,
    description: 'Ataca 2x no mesmo turno. Cada hit causa dano separado. No nível 5: 3 hits.',
  },
  explosao_solar: {
    id: 'explosao_solar', name: 'Explosão Solar', element: 'Fogo', path: 'A',
    icon: '💥', tier: 2, minLevel: 6,
    baseDamageMin: 35, baseDamageMax: 50, chiCost: 22, baseCooldownTurns: 2,
    passiveEffect: 'burn', effectDuration: 2,
    description: 'Explosão de calor. Aplica Queimadura por 2 turnos (-8 HP/turno). Nível 5: 4 turnos.',
  },
  rajada_continua: {
    id: 'rajada_continua', name: 'Rajada Contínua', element: 'Fogo', path: 'A',
    icon: '🌊🔥', tier: 2, minLevel: 9,
    baseDamageMin: 28, baseDamageMax: 40, chiCost: 20, baseCooldownTurns: 1,
    passiveEffect: 'momentum', effectDuration: 3,
    description: 'Dano aumenta 10% a cada turno consecutivo que usar. Nível 5: bônus dobrado (+20%/turno).',
  },
  circulo_de_fogo: {
    id: 'circulo_de_fogo', name: 'Círculo de Fogo', element: 'Fogo', path: 'A',
    icon: '🔴', tier: 2, minLevel: 12,
    baseDamageMin: 25, baseDamageMax: 38, chiCost: 24, baseCooldownTurns: 3,
    passiveEffect: 'fire_zone', effectDuration: 2,
    description: 'Cria zona de chamas por 2 turnos. Inimigo leva dano se atacar corpo-a-corpo. Nível 5: 4 turnos.',
  },
  fogo_dancante: {
    id: 'fogo_dancante', name: 'Fogo Dançante', element: 'Fogo', path: 'A',
    icon: '💃🔥', tier: 2, minLevel: 15,
    baseDamageMin: 30, baseDamageMax: 44, chiCost: 25, baseCooldownTurns: 2,
    passiveEffect: 'dodge_boost', effectDuration: 1,
    description: 'Ataca enquanto esquiva. Garante +20% esquiva no turno de uso. Nível 5: +40%.',
  },
  pulso_ardente: {
    id: 'pulso_ardente', name: 'Pulso Ardente', element: 'Fogo', path: 'A',
    icon: '📡🔥', tier: 3, minLevel: 18,
    baseDamageMin: 42, baseDamageMax: 58, chiCost: 32, baseCooldownTurns: 2,
    passiveEffect: 'armor_break', effectDuration: 3,
    description: 'Queima e rompe a armadura. Aplica -20% DEF do inimigo por 3 turnos. Nível 5: -40% DEF.',
  },
  fogo_dragao: {
    id: 'fogo_dragao', name: 'Fogo Dragão', element: 'Fogo', path: 'A',
    icon: '🐉', tier: 3, minLevel: 22,
    baseDamageMin: 20, baseDamageMax: 30, chiCost: 35, baseCooldownTurns: 2,
    passiveEffect: 'triple_hit', effectDuration: 0,
    description: 'Dispara 3 projéteis de fogo independentes. Nível 5: 5 projéteis.',
  },
  meteoro_de_fogo: {
    id: 'meteoro_de_fogo', name: 'Meteoro de Fogo', element: 'Fogo', path: 'A',
    icon: '☄️🔥', tier: 3, minLevel: 28,
    baseDamageMin: 60, baseDamageMax: 88, chiCost: 45, baseCooldownTurns: 3,
    passiveEffect: 'charge_ignore_def', effectDuration: 0,
    description: 'Carrega 1 turno, lança meteoro devastador. Nível 5: ignora 30% da DEF do inimigo.',
  },
  cometa_sozin: {
    id: 'cometa_sozin', name: 'Cometa de Sozin', element: 'Fogo', path: 'A',
    icon: '☄️', tier: 4, minLevel: 38,
    baseDamageMin: 130, baseDamageMax: 180, chiCost: 90, baseCooldownTurns: 5,
    passiveEffect: 'burn', effectDuration: 5,
    description: 'ULTIMATE — Poder cósmico do cometa. Dano absoluto + Queimadura 5 turnos. Requer 90 Chi.',
  },

  // ─── CAMINHO B: CONTROLE (Azula — precisão, debuffs, chi drain) ────────

  raio_preciso: {
    id: 'raio_preciso', name: 'Raio Preciso', element: 'Fogo', path: 'B',
    icon: '⚡', tier: 1, minLevel: 1,
    baseDamageMin: 22, baseDamageMax: 34, chiCost: 14, baseCooldownTurns: 2,
    passiveEffect: 'stun', effectDuration: 1,
    description: 'Relâmpago que atordoa. Aplica Stun por 1 turno (inimigo perde ação). Nível 5: 2 turnos.',
  },
  chama_azul: {
    id: 'chama_azul', name: 'Chama Azul', element: 'Fogo', path: 'B',
    icon: '🔵🔥', tier: 1, minLevel: 3,
    baseDamageMin: 25, baseDamageMax: 38, chiCost: 16, baseCooldownTurns: 2,
    passiveEffect: 'ignore_defense', effectDuration: 0,
    description: 'Fogo azul intenso. Ignora 20% da defesa do inimigo. Nível 5: ignora 50%.',
  },
  corrente_eletrica: {
    id: 'corrente_eletrica', name: 'Corrente Elétrica', element: 'Fogo', path: 'B',
    icon: '🔌⚡', tier: 2, minLevel: 7,
    baseDamageMin: 20, baseDamageMax: 30, chiCost: 18, baseCooldownTurns: 2,
    passiveEffect: 'chi_drain', effectDuration: 0,
    description: 'Drena 15 Chi do inimigo ao acertar. Nível 5: drena 30 Chi.',
  },
  fogo_supressor: {
    id: 'fogo_supressor', name: 'Fogo Supressor', element: 'Fogo', path: 'B',
    icon: '🚫🔥', tier: 2, minLevel: 10,
    baseDamageMin: 18, baseDamageMax: 28, chiCost: 22, baseCooldownTurns: 3,
    passiveEffect: 'silence', effectDuration: 1,
    description: 'Chama que inibe o chi inimigo. Inimigo não pode usar skills por 1 turno. Nível 5: 2 turnos.',
  },
  pressao_termica: {
    id: 'pressao_termica', name: 'Pressão Térmica', element: 'Fogo', path: 'B',
    icon: '🌡️', tier: 2, minLevel: 13,
    baseDamageMin: 28, baseDamageMax: 40, chiCost: 24, baseCooldownTurns: 2,
    passiveEffect: 'attack_debuff', effectDuration: 2,
    description: 'Calor sufocante. Reduz ATK do inimigo em 25% por 2 turnos. Nível 5: -50% ATK.',
  },
  redirecionamento: {
    id: 'redirecionamento', name: 'Redirecionamento', element: 'Fogo', path: 'B',
    icon: '🔄⚡', tier: 2, minLevel: 16,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 26, baseCooldownTurns: 3,
    passiveEffect: 'reflect', effectDuration: 1,
    description: 'Redireciona o próximo ataque do inimigo de volta. Reflete 40% do dano. Nível 5: 70%.',
  },
  raio_encadeado: {
    id: 'raio_encadeado', name: 'Raio Encadeado', element: 'Fogo', path: 'B',
    icon: '⛓️⚡', tier: 3, minLevel: 20,
    baseDamageMin: 35, baseDamageMax: 50, chiCost: 32, baseCooldownTurns: 2,
    passiveEffect: 'stacked_debuff', effectDuration: 2,
    description: 'Raio que acumula debuffs. Aplica Queimadura + Lentidão simultaneamente. Nível 5: 3 debuffs.',
  },
  calor_sufocante: {
    id: 'calor_sufocante', name: 'Calor Sufocante', element: 'Fogo', path: 'B',
    icon: '🌋😮‍💨', tier: 3, minLevel: 24,
    baseDamageMin: 25, baseDamageMax: 38, chiCost: 28, baseCooldownTurns: 2,
    passiveEffect: 'chi_burn', effectDuration: 3,
    description: 'Inimigo perde 6 Chi por turno por 3 turnos. Nível 5: 10 Chi por turno.',
  },
  tempestade_eletrica: {
    id: 'tempestade_eletrica', name: 'Tempestade Elétrica', element: 'Fogo', path: 'B',
    icon: '🌩️', tier: 3, minLevel: 30,
    baseDamageMin: 55, baseDamageMax: 75, chiCost: 42, baseCooldownTurns: 3,
    passiveEffect: 'aoe_debuff', effectDuration: 2,
    description: 'Tempestade elétrica. Reduz Chi + ATK do inimigo. Nível 5: também aplica Stun 1 turno.',
  },
  relampago_ozai: {
    id: 'relampago_ozai', name: 'Relâmpago de Ozai', element: 'Fogo', path: 'B',
    icon: '👑⚡', tier: 4, minLevel: 38,
    baseDamageMin: 110, baseDamageMax: 160, chiCost: 85, baseCooldownTurns: 5,
    passiveEffect: 'burn_stun', effectDuration: 3,
    description: 'ULTIMATE — Técnica suprema do Senhor do Fogo. Stun + Dano massivo + Queimadura 3 turnos.',
  },
};

// 💧 ÁGUA — 20 Skills

const AGUA_SKILLS = {

  // ─── CAMINHO A: AGRESSÃO (Pakku — controle ofensivo, gelo) ─────────────

  dobra_agua: {
    id: 'dobra_agua', name: 'Dobra de Água', element: 'Água', path: 'A',
    icon: '💧', tier: 1, minLevel: 1,
    baseDamageMin: 18, baseDamageMax: 28, chiCost: 10, baseCooldownTurns: 1,
    passiveEffect: null, effectDuration: 0,
    description: 'Controla água para atacar diretamente. Dano limpo sem efeito extra.',
  },
  chicote_de_gelo: {
    id: 'chicote_de_gelo', name: 'Chicote de Gelo', element: 'Água', path: 'A',
    icon: '❄️', tier: 1, minLevel: 3,
    baseDamageMin: 20, baseDamageMax: 30, chiCost: 14, baseCooldownTurns: 1,
    passiveEffect: 'slow', effectDuration: 2,
    description: 'Chicote de água congelada. Aplica Lentidão por 2 turnos (-1 ação do inimigo). Nível 5: 3 turnos.',
  },
  laminas_aquaticas: {
    id: 'laminas_aquaticas', name: 'Lâminas Aquáticas', element: 'Água', path: 'A',
    icon: '🗡️💧', tier: 2, minLevel: 6,
    baseDamageMin: 16, baseDamageMax: 24, chiCost: 18, baseCooldownTurns: 2,
    passiveEffect: 'double_hit', effectDuration: 0,
    description: 'Dispara 2 lâminas de água independentes. Nível 5: 3 lâminas.',
  },
  esfera_de_gelo: {
    id: 'esfera_de_gelo', name: 'Esfera de Gelo', element: 'Água', path: 'A',
    icon: '🔵❄️', tier: 2, minLevel: 9,
    baseDamageMin: 28, baseDamageMax: 40, chiCost: 20, baseCooldownTurns: 2,
    passiveEffect: 'freeze', effectDuration: 1,
    description: 'Esfera de gelo maciça. Congela o inimigo por 1 turno (perde a ação). Nível 5: 2 turnos.',
  },
  mare_furiosa: {
    id: 'mare_furiosa', name: 'Maré Furiosa', element: 'Água', path: 'A',
    icon: '🌊', tier: 2, minLevel: 12,
    baseDamageMin: 38, baseDamageMax: 54, chiCost: 26, baseCooldownTurns: 2,
    passiveEffect: 'knockback', effectDuration: 0,
    description: 'Onda gigante que empurra. Inimigo perde próxima ação por knockback. Nível 5: perde 2 ações.',
  },
  geiser_polar: {
    id: 'geiser_polar', name: 'Gêiser Polar', element: 'Água', path: 'A',
    icon: '⛲❄️', tier: 2, minLevel: 15,
    baseDamageMin: 32, baseDamageMax: 46, chiCost: 28, baseCooldownTurns: 3,
    passiveEffect: 'fall_damage', effectDuration: 0,
    description: 'Lança o inimigo. Causa dano adicional na queda (+15 dano fixo). Nível 5: dano na queda +40.',
  },
  corrente_subaquatica: {
    id: 'corrente_subaquatica', name: 'Corrente Subaquática', element: 'Água', path: 'A',
    icon: '🌀💧', tier: 3, minLevel: 18,
    baseDamageMin: 22, baseDamageMax: 32, chiCost: 30, baseCooldownTurns: 2,
    passiveEffect: 'hp_drain', effectDuration: 2,
    description: 'Drena vida do inimigo. Causa dano e cura você em 30% do dano por 2 turnos. Nível 5: 50%.',
  },
  onda_de_choque_aquatica: {
    id: 'onda_de_choque_aquatica', name: 'Onda de Choque Aquática', element: 'Água', path: 'A',
    icon: '💥💧', tier: 3, minLevel: 22,
    baseDamageMin: 44, baseDamageMax: 62, chiCost: 34, baseCooldownTurns: 2,
    passiveEffect: 'armor_break', effectDuration: 3,
    description: 'Onda penetrante. Reduz DEF do inimigo em 20% por 3 turnos. Nível 5: -40% DEF.',
  },
  prisao_de_gelo: {
    id: 'prisao_de_gelo', name: 'Prisão de Gelo', element: 'Água', path: 'A',
    icon: '🧊🔒', tier: 3, minLevel: 28,
    baseDamageMin: 30, baseDamageMax: 45, chiCost: 40, baseCooldownTurns: 3,
    passiveEffect: 'freeze_shatter', effectDuration: 2,
    description: 'Prende o inimigo em gelo por 2 turnos. Ao descongelar, causa dano bônus (+30). Nível 5: +70.',
  },
  tsunami_katara: {
    id: 'tsunami_katara', name: 'Tsunami de Katara', element: 'Água', path: 'A',
    icon: '🌕🌊', tier: 4, minLevel: 38,
    baseDamageMin: 120, baseDamageMax: 165, chiCost: 88, baseCooldownTurns: 5,
    passiveEffect: 'knockback_slow', effectDuration: 2,
    description: 'ULTIMATE — Tsunami lunar devastador. Knockback + Lentidão 2 turnos + dano massivo.',
  },

  // ─── CAMINHO B: SUPORTE/CURA (Katara — cura, escudo, remoção de debuffs) ──

  cura_espiritual: {
    id: 'cura_espiritual', name: 'Cura Espiritual', element: 'Água', path: 'B',
    icon: '💚', tier: 1, minLevel: 1,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 14, baseCooldownTurns: 2,
    passiveEffect: 'heal', effectDuration: 0,
    description: 'Recupera 30 HP próprio. Nível 5: 55 HP.',
  },
  escudo_aquatico: {
    id: 'escudo_aquatico', name: 'Escudo Aquático', element: 'Água', path: 'B',
    icon: '🛡️💧', tier: 1, minLevel: 3,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 16, baseCooldownTurns: 2,
    passiveEffect: 'absorb_shield', effectDuration: 1,
    description: 'Cria escudo de 25 HP que absorve o próximo ataque. Nível 5: escudo de 55 HP.',
  },
  nevoa_de_gelo: {
    id: 'nevoa_de_gelo', name: 'Névoa de Gelo', element: 'Água', path: 'B',
    icon: '🌫️❄️', tier: 2, minLevel: 6,
    baseDamageMin: 14, baseDamageMax: 22, chiCost: 18, baseCooldownTurns: 2,
    passiveEffect: 'blind', effectDuration: 2,
    description: 'Névoa que cega o inimigo. Reduz precisão em 30% por 2 turnos (mais chance de errar). Nível 5: 50%.',
  },
  cura_profunda: {
    id: 'cura_profunda', name: 'Cura Profunda', element: 'Água', path: 'B',
    icon: '💚✨', tier: 2, minLevel: 9,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 22, baseCooldownTurns: 3,
    passiveEffect: 'heal_cleanse', effectDuration: 0,
    description: 'Cura 45 HP e remove 1 debuff ativo. Nível 5: cura 80 HP e remove todos os debuffs.',
  },
  agua_sagrada: {
    id: 'agua_sagrada', name: 'Água Sagrada', element: 'Água', path: 'B',
    icon: '✨💧', tier: 2, minLevel: 12,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 20, baseCooldownTurns: 3,
    passiveEffect: 'full_cleanse', effectDuration: 0,
    description: 'Remove TODOS os debuffs ativos de uma vez. Nível 5: também restaura 20 HP por debuff removido.',
  },
  veu_de_lua: {
    id: 'veu_de_lua', name: 'Véu de Lua', element: 'Água', path: 'B',
    icon: '🌙💧', tier: 2, minLevel: 15,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 24, baseCooldownTurns: 3,
    passiveEffect: 'chi_regen_boost', effectDuration: 3,
    description: 'Lua potencializa o chi. Recupera +8 Chi por turno por 3 turnos. Nível 5: +14 Chi/turno.',
  },
  barreira_de_gelo: {
    id: 'barreira_de_gelo', name: 'Barreira de Gelo', element: 'Água', path: 'B',
    icon: '🧊🔰', tier: 3, minLevel: 18,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 30, baseCooldownTurns: 3,
    passiveEffect: 'reflect_shield', effectDuration: 2,
    description: 'Escudo de gelo que devolve 30% do dano ao quebrar. Nível 5: devolve 60%.',
  },
  pulso_de_cura: {
    id: 'pulso_de_cura', name: 'Pulso de Cura', element: 'Água', path: 'B',
    icon: '💓💧', tier: 3, minLevel: 22,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 28, baseCooldownTurns: 2,
    passiveEffect: 'regen', effectDuration: 3,
    description: 'Pulso de cura contínua. Recupera 15 HP por turno por 3 turnos. Nível 5: 28 HP/turno.',
  },
  laco_de_sangue: {
    id: 'laco_de_sangue', name: 'Laço de Sangue', element: 'Água', path: 'B',
    icon: '🩸🌀', tier: 3, minLevel: 28,
    baseDamageMin: 40, baseDamageMax: 60, chiCost: 45, baseCooldownTurns: 4,
    passiveEffect: 'root', effectDuration: 1,
    description: 'Técnica proibida. Imobiliza inimigo 1 turno + dano considerável. Nível 5: 2 turnos + drena Chi.',
  },
  vortice_espirito_lua: {
    id: 'vortice_espirito_lua', name: 'Vórtice do Espírito da Lua', element: 'Água', path: 'B',
    icon: '🌕🌀', tier: 4, minLevel: 38,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 82, baseCooldownTurns: 5,
    passiveEffect: 'full_restore_shield', effectDuration: 0,
    description: 'ULTIMATE — Canaliza a Princesa Yue. Cura TOTAL + remove todos debuffs + escudo de 60 HP.',
  },
};

// 🪨 TERRA — 20 Skills

const TERRA_SKILLS = {

  // ─── CAMINHO A: TANK (Kyoshi — defesa, resistência, contra-ataque) ──────

  projetil_pedra: {
    id: 'projetil_pedra', name: 'Projétil de Pedra', element: 'Terra', path: 'A',
    icon: '🪨', tier: 1, minLevel: 1,
    baseDamageMin: 22, baseDamageMax: 34, chiCost: 12, baseCooldownTurns: 1,
    passiveEffect: null, effectDuration: 0,
    description: 'Bloco de pedra arremessado com força. Dano físico direto sem efeito.',
  },
  muro_de_terra: {
    id: 'muro_de_terra', name: 'Muro de Terra', element: 'Terra', path: 'A',
    icon: '🧱', tier: 1, minLevel: 3,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 16, baseCooldownTurns: 2,
    passiveEffect: 'defense_boost', effectDuration: 2,
    description: 'Ergue muralha defensiva. +25% DEF por 2 turnos. Nível 5: +50% DEF.',
  },
  rocha_deslizante: {
    id: 'rocha_deslizante', name: 'Rocha Deslizante', element: 'Terra', path: 'A',
    icon: '🪨💨', tier: 2, minLevel: 6,
    baseDamageMin: 26, baseDamageMax: 38, chiCost: 20, baseCooldownTurns: 2,
    passiveEffect: 'stun', effectDuration: 1,
    description: 'Rocha em alta velocidade. Atordoa o inimigo por 1 turno. Nível 5: 2 turnos.',
  },
  escudo_solido: {
    id: 'escudo_solido', name: 'Escudo Sólido', element: 'Terra', path: 'A',
    icon: '🛡️🪨', tier: 2, minLevel: 8,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 22, baseCooldownTurns: 3,
    passiveEffect: 'full_block', effectDuration: 1,
    description: 'Escudo de rocha maciça. Absorve o próximo ataque COMPLETAMENTE (sem dano). Nível 5: bloqueia 2 ataques.',
  },
  armadura_quartzo: {
    id: 'armadura_quartzo', name: 'Armadura de Quartzo', element: 'Terra', path: 'A',
    icon: '💎🛡️', tier: 2, minLevel: 11,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 26, baseCooldownTurns: 3,
    passiveEffect: 'heavy_defense', effectDuration: 3,
    description: 'Armadura de quartzo puro. +50% DEF por 3 turnos. Nível 5: +80% DEF.',
  },
  contragolpe_terroso: {
    id: 'contragolpe_terroso', name: 'Contragolpe Terroso', element: 'Terra', path: 'A',
    icon: '🪨↩️', tier: 3, minLevel: 14,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 28, baseCooldownTurns: 3,
    passiveEffect: 'thorns', effectDuration: 2,
    description: 'Retorna 40% do próximo dano recebido ao atacante por 2 turnos. Nível 5: 70%.',
  },
  malha_de_metal: {
    id: 'malha_de_metal', name: 'Malha de Metal', element: 'Terra', path: 'A',
    icon: '⛓️', tier: 3, minLevel: 17,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 30, baseCooldownTurns: 3,
    passiveEffect: 'status_immunity', effectDuration: 2,
    description: 'Malha metálica cobrindo o corpo. Imune a efeitos de status por 2 turnos. Nível 5: 3 turnos.',
  },
  fortaleza_viva: {
    id: 'fortaleza_viva', name: 'Fortaleza Viva', element: 'Terra', path: 'A',
    icon: '🏯', tier: 3, minLevel: 21,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 32, baseCooldownTurns: 3,
    passiveEffect: 'regen_defense', effectDuration: 2,
    description: 'Recupera 20 HP por turno por 2 turnos + +20% DEF simultaneamente. Nível 5: 35 HP/turno.',
  },
  nucleo_granito: {
    id: 'nucleo_granito', name: 'Núcleo de Granito', element: 'Terra', path: 'A',
    icon: '🔘🪨', tier: 3, minLevel: 26,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 38, baseCooldownTurns: 4,
    passiveEffect: 'half_damage', effectDuration: 1,
    description: 'Concentra a energia da terra. Reduz TODO dano recebido em 50% por 1 turno. Nível 5: 2 turnos.',
  },
  muro_imortal: {
    id: 'muro_imortal', name: 'Muro Imortal', element: 'Terra', path: 'A',
    icon: '🏔️', tier: 4, minLevel: 38,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 80, baseCooldownTurns: 5,
    passiveEffect: 'invulnerable_regen', effectDuration: 2,
    description: 'ULTIMATE — Imune a todo dano por 2 turnos + cura 40 HP por turno. A defesa suprema da Terra.',
  },

  // ─── CAMINHO B: SISMO (Toph — offensivo, área, sangramento) ────────────

  terremoto: {
    id: 'terremoto', name: 'Terremoto', element: 'Terra', path: 'B',
    icon: '🌋', tier: 1, minLevel: 1,
    baseDamageMin: 24, baseDamageMax: 36, chiCost: 14, baseCooldownTurns: 2,
    passiveEffect: 'stun', effectDuration: 1,
    description: 'Tremor localizado. Atordoa o inimigo por 1 turno. Nível 5: 2 turnos.',
  },
  chuva_de_pedras: {
    id: 'chuva_de_pedras', name: 'Chuva de Pedras', element: 'Terra', path: 'B',
    icon: '🌧️🪨', tier: 1, minLevel: 3,
    baseDamageMin: 14, baseDamageMax: 20, chiCost: 16, baseCooldownTurns: 2,
    passiveEffect: 'triple_hit', effectDuration: 0,
    description: 'Bombardeio de fragmentos. Causa 3 hits separados. Nível 5: 5 hits.',
  },
  avalanche: {
    id: 'avalanche', name: 'Avalanche', element: 'Terra', path: 'B',
    icon: '⛰️💥', tier: 2, minLevel: 7,
    baseDamageMin: 40, baseDamageMax: 56, chiCost: 24, baseCooldownTurns: 2,
    passiveEffect: 'knockback', effectDuration: 0,
    description: 'Avalanche de rocha e terra. Knockback — inimigo perde próxima ação. Nível 5: 2 ações perdidas.',
  },
  espinhos_de_rocha: {
    id: 'espinhos_de_rocha', name: 'Espinhos de Rocha', element: 'Terra', path: 'B',
    icon: '🌵🪨', tier: 2, minLevel: 10,
    baseDamageMin: 30, baseDamageMax: 44, chiCost: 22, baseCooldownTurns: 2,
    passiveEffect: 'bleed', effectDuration: 3,
    description: 'Espinhos emergem do solo. Aplica Sangramento por 3 turnos (-6 HP/turno). Nível 5: -12 HP/turno.',
  },
  dobra_de_metal: {
    id: 'dobra_de_metal', name: 'Dobra de Metal', element: 'Terra', path: 'B',
    icon: '⛓️🪨', tier: 2, minLevel: 13,
    baseDamageMin: 35, baseDamageMax: 50, chiCost: 28, baseCooldownTurns: 3,
    passiveEffect: 'permanent_armor_break', effectDuration: 99,
    description: 'Técnica de Toph: quebra qualquer armadura. Reduz DEF inimigo em 30% permanentemente no combate. Nível 5: -50%.',
  },
  fissura_tectonica: {
    id: 'fissura_tectonica', name: 'Fissura Tectônica', element: 'Terra', path: 'B',
    icon: '🌍💢', tier: 3, minLevel: 17,
    baseDamageMin: 38, baseDamageMax: 54, chiCost: 32, baseCooldownTurns: 3,
    passiveEffect: 'terrain_damage', effectDuration: 3,
    description: 'Abre fissura no campo. Inimigo perde 10 HP por turno por 3 turnos (efeito de terreno). Nível 5: 20 HP/turno.',
  },
  fragmentos_cristal: {
    id: 'fragmentos_cristal', name: 'Fragmentos de Cristal', element: 'Terra', path: 'B',
    icon: '💎🩸', tier: 3, minLevel: 20,
    baseDamageMin: 28, baseDamageMax: 40, chiCost: 28, baseCooldownTurns: 2,
    passiveEffect: 'stacking_bleed', effectDuration: 3,
    description: 'Cristais cortantes. Sangramento ACUMULÁVEL — cada aplicação adiciona -4 HP/turno. Nível 5: -8 HP/turno.',
  },
  pilar_de_rocha: {
    id: 'pilar_de_rocha', name: 'Pilar de Rocha', element: 'Terra', path: 'B',
    icon: '🗿', tier: 3, minLevel: 24,
    baseDamageMin: 50, baseDamageMax: 70, chiCost: 36, baseCooldownTurns: 3,
    passiveEffect: 'launch_bonus', effectDuration: 0,
    description: 'Pilar lança o inimigo. +20 dano fixo de queda. Nível 5: +55 dano de queda.',
  },
  golpe_de_toph: {
    id: 'golpe_de_toph', name: 'Golpe de Toph', element: 'Terra', path: 'B',
    icon: '👊🪨', tier: 3, minLevel: 28,
    baseDamageMin: 55, baseDamageMax: 110, chiCost: 40, baseCooldownTurns: 3,
    passiveEffect: 'chaos_damage', effectDuration: 0,
    description: 'Técnica imprevisível de Toph. Dano aleatório entre 80-150% do base. Nível 5: entre 80-200% do base.',
  },
  continente_desperto: {
    id: 'continente_desperto', name: 'Continente Desperto', element: 'Terra', path: 'B',
    icon: '🌍⚡', tier: 4, minLevel: 38,
    baseDamageMin: 125, baseDamageMax: 170, chiCost: 86, baseCooldownTurns: 5,
    passiveEffect: 'terrain_stun_bleed', effectDuration: 3,
    description: 'ULTIMATE — A terra responde ao chamado. Dano massivo + Stun + Fissura 3 turnos + Sangramento.',
  },
};

// 🌪️ AR — 20 Skills

const AR_SKILLS = {

  // ─── CAMINHO A: VELOCIDADE (evasão, mobilidade, contra-ataques rápidos) ─

  rajada_de_vento: {
    id: 'rajada_de_vento', name: 'Rajada de Vento', element: 'Ar', path: 'A',
    icon: '🌬️', tier: 1, minLevel: 1,
    baseDamageMin: 16, baseDamageMax: 26, chiCost: 8, baseCooldownTurns: 1,
    passiveEffect: null, effectDuration: 0,
    description: 'Explosão de ar comprimido. Dano direto básico do elemento Ar.',
  },
  passo_do_vento: {
    id: 'passo_do_vento', name: 'Passo do Vento', element: 'Ar', path: 'A',
    icon: '💨👣', tier: 1, minLevel: 2,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 10, baseCooldownTurns: 2,
    passiveEffect: 'dodge_boost', effectDuration: 2,
    description: 'Movimento de evasão. +30% esquiva por 2 turnos. Nível 5: +55% esquiva.',
  },
  lamina_de_vento: {
    id: 'lamina_de_vento', name: 'Lâmina de Vento', element: 'Ar', path: 'A',
    icon: '🌬️🗡️', tier: 2, minLevel: 5,
    baseDamageMin: 24, baseDamageMax: 36, chiCost: 16, baseCooldownTurns: 2,
    passiveEffect: 'bleed', effectDuration: 2,
    description: 'Corte de ar concentrado. Aplica Sangramento por 2 turnos (-6 HP/turno). Nível 5: -12 HP/turno.',
  },
  redemoinho_pessoal: {
    id: 'redemoinho_pessoal', name: 'Redemoinho Pessoal', element: 'Ar', path: 'A',
    icon: '🌀', tier: 2, minLevel: 8,
    baseDamageMin: 20, baseDamageMax: 30, chiCost: 18, baseCooldownTurns: 2,
    passiveEffect: 'dodge_and_damage', effectDuration: 1,
    description: 'Gira criando escudo e dano. +15% esquiva + causa dano a qualquer ataque corpo-a-corpo recebido. Nível 5: +30%.',
  },
  corrente_de_ar: {
    id: 'corrente_de_ar', name: 'Corrente de Ar', element: 'Ar', path: 'A',
    icon: '💨✨', tier: 2, minLevel: 11,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 20, baseCooldownTurns: 3,
    passiveEffect: 'force_miss', effectDuration: 1,
    description: 'Corrente de ar desorientante. Inimigo ERRA o próximo ataque garantidamente. Nível 5: 2 ataques errados.',
  },
  vortice_ascendente: {
    id: 'vortice_ascendente', name: 'Vórtice Ascendente', element: 'Ar', path: 'A',
    icon: '⬆️🌪️', tier: 2, minLevel: 14,
    baseDamageMin: 30, baseDamageMax: 44, chiCost: 24, baseCooldownTurns: 3,
    passiveEffect: 'knockback_delay', effectDuration: 0,
    description: 'Lança inimigo ao ar. Knockback + atrasa próxima ação do inimigo em 1 turno. Nível 5: 2 turnos de atraso.',
  },
  danca_do_nomade: {
    id: 'danca_do_nomade', name: 'Dança do Nômade', element: 'Ar', path: 'A',
    icon: '💃🌬️', tier: 3, minLevel: 17,
    baseDamageMin: 18, baseDamageMax: 26, chiCost: 30, baseCooldownTurns: 3,
    passiveEffect: 'double_action', effectDuration: 0,
    description: 'Ataca 2x no mesmo turno com movimentos de dança. Nível 5: 3 ações no turno.',
  },
  invisivel_no_vento: {
    id: 'invisivel_no_vento', name: 'Invisível no Vento', element: 'Ar', path: 'A',
    icon: '👻🌬️', tier: 3, minLevel: 21,
    baseDamageMin: 0, baseDamageMax: 0, chiCost: 32, baseCooldownTurns: 4,
    passiveEffect: 'phase', effectDuration: 1,
    description: 'Torna-se intangível por 1 turno. Imune a ataques físicos e de skills. Nível 5: 2 turnos.',
  },
  rajada_sonica: {
    id: 'rajada_sonica', name: 'Rajada Sônica', element: 'Ar', path: 'A',
    icon: '📢💥', tier: 3, minLevel: 26,
    baseDamageMin: 44, baseDamageMax: 62, chiCost: 36, baseCooldownTurns: 3,
    passiveEffect: 'stun_blind', effectDuration: 2,
    description: 'Frequência sônica devastadora. Stun 1 turno + Cegueira 2 turnos (precisão -40%). Nível 5: Stun 2 turnos.',
  },
  libertacao_do_avatar: {
    id: 'libertacao_do_avatar', name: 'Libertação do Avatar', element: 'Ar', path: 'A',
    icon: '⚡🌬️', tier: 4, minLevel: 38,
    baseDamageMin: 100, baseDamageMax: 140, chiCost: 82, baseCooldownTurns: 5,
    passiveEffect: 'dodge_stun_bonus', effectDuration: 0,
    description: 'ULTIMATE — Esquiva garantida + dano explosivo + Stun 2 turnos. O poder do Avatar canalizado no Ar.',
  },

  // ─── CAMINHO B: PODER (Aang Estado Avatar — dano puro de ar, destruição) ─

  esfera_de_ar: {
    id: 'esfera_de_ar', name: 'Esfera de Ar', element: 'Ar', path: 'B',
    icon: '💠', tier: 1, minLevel: 1,
    baseDamageMin: 20, baseDamageMax: 32, chiCost: 10, baseCooldownTurns: 1,
    passiveEffect: null, effectDuration: 0,
    description: 'Esfera de pressão de ar concentrada. Dano médio limpo sem efeito.',
  },
  tornado: {
    id: 'tornado', name: 'Tornado', element: 'Ar', path: 'B',
    icon: '🌪️', tier: 1, minLevel: 3,
    baseDamageMin: 28, baseDamageMax: 42, chiCost: 16, baseCooldownTurns: 2,
    passiveEffect: 'knockback', effectDuration: 0,
    description: 'Tornado devastador. Knockback — inimigo perde próxima ação. Nível 5: perde 2 ações.',
  },
  pressao_de_ar: {
    id: 'pressao_de_ar', name: 'Pressão de Ar', element: 'Ar', path: 'B',
    icon: '⬇️💨', tier: 2, minLevel: 6,
    baseDamageMin: 22, baseDamageMax: 34, chiCost: 18, baseCooldownTurns: 2,
    passiveEffect: 'attack_debuff', effectDuration: 2,
    description: 'Pressão de ar sufocante. Reduz ATK do inimigo em 20% por 2 turnos. Nível 5: -40%.',
  },
  onda_de_choque_ar: {
    id: 'onda_de_choque_ar', name: 'Onda de Choque', element: 'Ar', path: 'B',
    icon: '💥🌬️', tier: 2, minLevel: 9,
    baseDamageMin: 34, baseDamageMax: 48, chiCost: 22, baseCooldownTurns: 2,
    passiveEffect: 'partial_ignore_def', effectDuration: 0,
    description: 'Onda de choque de ar. Ignora 15% da defesa do inimigo. Nível 5: ignora 35%.',
  },
  tempestade_do_nomade: {
    id: 'tempestade_do_nomade', name: 'Tempestade do Nômade', element: 'Ar', path: 'B',
    icon: '⛈️🌬️', tier: 2, minLevel: 12,
    baseDamageMin: 20, baseDamageMax: 28, chiCost: 24, baseCooldownTurns: 2,
    passiveEffect: 'multi_slow', effectDuration: 2,
    description: 'Tempestade dos Mestres do Ar. Multi-hit (2 ataques) + Lentidão 2 turnos. Nível 5: 3 ataques.',
  },
  esfera_giroscopica: {
    id: 'esfera_giroscopica', name: 'Esfera Giroscópica', element: 'Ar', path: 'B',
    icon: '🔄💠', tier: 2, minLevel: 15,
    baseDamageMin: 38, baseDamageMax: 54, chiCost: 28, baseCooldownTurns: 2,
    passiveEffect: 'attack_dodge_combo', effectDuration: 0,
    description: 'A esfera de voo de Aang usada como arma. Ataca e concede +15% esquiva no mesmo turno. Nível 5: +30%.',
  },
  dobra_de_som: {
    id: 'dobra_de_som', name: 'Dobra de Som', element: 'Ar', path: 'B',
    icon: '🔊💥', tier: 3, minLevel: 18,
    baseDamageMin: 48, baseDamageMax: 66, chiCost: 35, baseCooldownTurns: 3,
    passiveEffect: 'stun', effectDuration: 2,
    description: 'Frequência sônica intensa. Atordoa o inimigo por 2 turnos. Nível 5: 3 turnos de Stun.',
  },
  furacao_concentrado: {
    id: 'furacao_concentrado', name: 'Furacão Concentrado', element: 'Ar', path: 'B',
    icon: '🌪️💢', tier: 3, minLevel: 22,
    baseDamageMin: 45, baseDamageMax: 65, chiCost: 36, baseCooldownTurns: 2,
    passiveEffect: 'bonus_on_debuff', effectDuration: 0,
    description: 'Mais forte quando inimigo tem debuff. +25% dano por debuff ativo no inimigo. Nível 5: +45%.',
  },
  golpe_espiritual: {
    id: 'golpe_espiritual', name: 'Golpe Espiritual', element: 'Ar', path: 'B',
    icon: '👁️🌬️', tier: 3, minLevel: 28,
    baseDamageMin: 60, baseDamageMax: 84, chiCost: 44, baseCooldownTurns: 3,
    passiveEffect: 'true_damage', effectDuration: 0,
    description: 'Golpe de energia espiritual. Ignora COMPLETAMENTE o escudo e a defesa do inimigo. Nível 5: +30% dano adicional.',
  },
  estado_avatar: {
    id: 'estado_avatar', name: 'Estado Avatar', element: 'Ar', path: 'B',
    icon: '⚡👁️', tier: 4, minLevel: 38,
    baseDamageMin: 140, baseDamageMax: 200, chiCost: 100, baseCooldownTurns: 6,
    passiveEffect: 'true_damage_multi', effectDuration: 0,
    description: 'ULTIMATE — O dano máximo do jogo. Ignora toda defesa + escudo. Requer 100 Chi. Nível 5: +50% dano base.',
  },
};

// SKILLS LENDÁRIAS (Recompensas do Modo História — mantidas)

const LENDARIAS_SKILLS = {
  tempestade: {
    id: 'tempestade', name: 'Tempestade', element: 'Ar', path: null,
    icon: '⛈️', tier: 4, minLevel: 10,
    baseDamageMin: 90, baseDamageMax: 130, chiCost: 55, baseCooldownTurns: 4,
    passiveEffect: 'all_debuff', effectDuration: 1,
    description: 'Cap. 2 — Chuva elemental que aplica Lentidão + Queimadura simultaneamente.',
  },
  dobra_espirito: {
    id: 'dobra_espirito', name: 'Dobra do Espírito', element: 'Ar', path: null,
    icon: '👻', tier: 4, minLevel: 15,
    baseDamageMin: 100, baseDamageMax: 145, chiCost: 60, baseCooldownTurns: 4,
    passiveEffect: 'true_damage', effectDuration: 0,
    description: 'Cap. 3 — Energia espiritual pura que ignora toda defesa.',
  },
  avatar_state: {
    id: 'avatar_state', name: 'Avatar State', element: 'Ar', path: null,
    icon: '⚡', tier: 4, minLevel: 20,
    baseDamageMin: 140, baseDamageMax: 200, chiCost: 80, baseCooldownTurns: 5,
    passiveEffect: 'true_damage_multi', effectDuration: 0,
    description: 'Cap. 4 — Poder absoluto do Avatar. Ignora defesa + multi-hit.',
  },
  equilibrio_lendario: {
    id: 'equilibrio_lendario', name: 'Equilíbrio Lendário', element: 'Ar', path: null,
    icon: '☯️', tier: 4, minLevel: 25,
    baseDamageMin: 180, baseDamageMax: 260, chiCost: 100, baseCooldownTurns: 6,
    passiveEffect: 'all_debuff_true', effectDuration: 2,
    description: 'Cap. 5 — Todos os elementos em harmonia. Aplica todos os debuffs + dano colossal.',
  },
  furia_dragao: {
    id: 'furia_dragao', name: 'Fúria do Dragão', element: 'Fogo', path: null,
    icon: '🐉', tier: 4, minLevel: 28,
    baseDamageMin: 200, baseDamageMax: 280, chiCost: 110, baseCooldownTurns: 6,
    passiveEffect: 'burn', effectDuration: 5,
    description: 'Cap. 6 — Poder ancestral dos dragões. Queimadura 5 turnos + dano absoluto.',
  },
  cometa_sozin_lendario: {
    id: 'cometa_sozin_lendario', name: 'Cometa de Sozin (Lendário)', element: 'Fogo', path: null,
    icon: '☄️', tier: 4, minLevel: 32,
    baseDamageMin: 230, baseDamageMax: 320, chiCost: 120, baseCooldownTurns: 7,
    passiveEffect: 'burn_stun', effectDuration: 3,
    description: 'Cap. 7 — Energia cósmica do Cometa. Queimadura + Stun 3 turnos.',
  },
  guerreiro_eterno: {
    id: 'guerreiro_eterno', name: 'Guerreiro Eterno', element: 'Terra', path: null,
    icon: '🗡️', tier: 4, minLevel: 35,
    baseDamageMin: 260, baseDamageMax: 360, chiCost: 130, baseCooldownTurns: 7,
    passiveEffect: 'triple_hit', effectDuration: 0,
    description: 'Cap. 8 — Combo lendário: 3 hits + dano colossal em cada um.',
  },
  julgamento_celestial: {
    id: 'julgamento_celestial', name: 'Julgamento Celestial', element: 'Água', path: null,
    icon: '⚖️', tier: 4, minLevel: 38,
    baseDamageMin: 290, baseDamageMax: 400, chiCost: 140, baseCooldownTurns: 8,
    passiveEffect: 'all_debuff_true', effectDuration: 3,
    description: 'Cap. 9 — Os espíritos celestiais julgam. Todos os debuffs + dano absoluto + verdadeiro.',
  },
  origem_universo: {
    id: 'origem_universo', name: 'Origem do Universo', element: 'Ar', path: null,
    icon: '🌌', tier: 4, minLevel: 45,
    baseDamageMin: 350, baseDamageMax: 500, chiCost: 160, baseCooldownTurns: 8,
    passiveEffect: 'true_damage_all_debuff', effectDuration: 3,
    description: 'Cap. 10 — O poder primordial da criação. Dano verdadeiro + todos os debuffs + ignora tudo.',
  },
};

// EXPORT UNIFICADO

export const SKILLS = {
  ataque_basico: ATTACK_BASIC,
  ...FOGO_SKILLS,
  ...AGUA_SKILLS,
  ...TERRA_SKILLS,
  ...AR_SKILLS,
  ...LENDARIAS_SKILLS,
};

// SISTEMA DE UPGRADE — getLeveledSkill(skillId, level)
//
// Retorna a skill com stats ajustados para o nível dado.
// Salvo em Character.skillUpgrades: { "dobra_fogo": 3, "raio_azul": 1 }

const LEVEL_DAMAGE_MULTIPLIERS = [1.0, 1.15, 1.30, 1.50, 1.70];
const LEVEL_CHI_DISCOUNT       = [0,   0,    0.10, 0.10, 0.10];

export function getLeveledSkill(skillId, level = 1) {
  const base = SKILLS[skillId];
  if (!base) return null;

  const idx = Math.max(0, Math.min(4, level - 1));
  const dmgMult    = LEVEL_DAMAGE_MULTIPLIERS[idx];
  const chiDisc    = LEVEL_CHI_DISCOUNT[idx];

  // Efeito de duração: +1 turno a cada 2 níveis acima do 1
  const extraDuration = Math.floor((level - 1) / 2);

  return {
    ...base,
    level,
    baseDamageMin: Math.round(base.baseDamageMin * dmgMult),
    baseDamageMax: Math.round(base.baseDamageMax * dmgMult),
    chiCost:       Math.max(0, Math.round(base.chiCost * (1 - chiDisc))),
    effectDuration: (base.effectDuration || 0) + extraDuration,
    // Efeitos especiais por nível máximo (5)
    maxLevel: level >= 5,
  };
}

// HELPERS — mantidos compatíveis com código existente

export function getSkillsByElement(element) {
  return Object.values(SKILLS).filter(s => s.element === element);
}

export function getSkillsByPath(element, path) {
  return Object.values(SKILLS).filter(s => s.element === element && s.path === path);
}

export function getEquippedSkillsForBattle(character) {
  const equipped = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];
  const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
  const upgrades = (typeof character.skillUpgrades === 'object' && character.skillUpgrades)
    ? character.skillUpgrades : {};

  // Skill base do elemento é sempre permitida (após cap. 1 ela vem em unlocked,
  // mas pra retrocompatibilidade deixamos passar mesmo se não estiver).
  const baseSkillForCharElement = ({
    Fogo: 'dobra_fogo', 'Água': 'dobra_agua', Terra: 'projetil_pedra', Ar: 'rajada_de_vento',
  })[character.element];

  return equipped
    .filter(id => {
      if (id === baseSkillForCharElement) return true; // base liberada
      return unlocked.includes(id);
    })
    .map(id => {
      const lvl = upgrades[id] || 1;
      return getLeveledSkill(id, lvl);
    })
    .filter(Boolean);
}

// Roda → Fogo > Ar > Terra > Água > Fogo
const ELEMENT_ADVANTAGE = {
  Fogo: 'Ar',
  Ar:   'Terra',
  Terra: 'Água',
  'Água': 'Fogo',
};

/**
 * Retorna o multiplicador elemental:
 *   1.20 → atacante tem vantagem (+20% dano)
 *   0.90 → atacante em desvantagem (−10% dano, suave)
 *   1.00 → neutro (mesmo elemento, ou sem dado)
 */
export function getElementalMultiplier(attackerElement, defenderElement) {
  if (!attackerElement || !defenderElement) return 1.0;
  if (attackerElement === defenderElement) return 1.0;
  if (ELEMENT_ADVANTAGE[attackerElement] === defenderElement) return 1.20;
  if (ELEMENT_ADVANTAGE[defenderElement] === attackerElement) return 0.90;
  return 1.0;
}

const CRIT_BASE_CHANCE = 0.10;     // 10% base de crítico
const CRIT_MULTIPLIER  = 1.5;      // crítico causa 1.5x dano
const DODGE_BASE_CHANCE = 0.05;    // 5% base de esquiva
const DODGE_LEVEL_BONUS = 0.003;   // +0.3% por nível do defensor (cap 8% no nível 10)

/**
 * Calcula chance de crítico. Skills com passiveEffect 'crit_boost'
 * ou árvore de talento 'combate' aumentam a chance.
 */
function getCritChance(attacker, skill) {
  let chance = CRIT_BASE_CHANCE;
  if (skill?.passiveEffect === 'crit_boost') chance += 0.10;
  const combateLvl = attacker.talentTree?.combate || 0;
  chance += combateLvl * 0.01; // +1% por ponto em "combate"
  const critBuff = (attacker.buffs || []).find(b => b.type === 'crit');
  if (critBuff) chance += (critBuff.value || 0) / 100;
  return Math.min(0.5, chance); // cap 50%
}

/**
 * Calcula chance de esquiva do defensor.
 */
function getDodgeChance(defender) {
  let chance = DODGE_BASE_CHANCE;
  chance += (defender.level || 1) * DODGE_LEVEL_BONUS;
  // Buff de evasão (caso alguma poção dê isso no futuro)
  const evasionBuff = (defender.buffs || []).find(b => b.type === 'evasion');
  if (evasionBuff) chance += (evasionBuff.value || 0) / 100;
  return Math.min(0.30, chance); // cap 30%
}

export function calculateCooldownTurns(skill, character) {
  const base = skill.baseCooldownTurns || 0;
  // Bônus de redução de cooldown via árvore de talento (campo talentTree)
  const talentTree = character?.talentTree || {};
  const cooldownReduction = talentTree.espirito >= 4 ? 1 : 0;
  return Math.max(0, base - cooldownReduction);
}

export function calculateDamageDetailed(skill, attacker, defender, activeBuffs = []) {
  if (!skill || (skill.baseDamageMax || 0) === 0) {
    return { damage: 0, isCrit: false, isDodge: false, elementalMult: 1, raw: 0 };
  }

  // ── 1. Esquiva do defensor (skills "true_damage" ignoram esquiva) ──
  const ignoresDodge = skill.passiveEffect === 'true_damage' ||
                       skill.passiveEffect === 'true_damage_multi' ||
                       skill.passiveEffect === 'true_damage_all_debuff' ||
                       skill.id === 'ataque_basico';
  if (!ignoresDodge) {
    const dodgeChance = getDodgeChance(defender);
    if (Math.random() < dodgeChance) {
      return { damage: 0, isCrit: false, isDodge: true, elementalMult: 1, raw: 0 };
    }
  }

  const lvl = skill.level || 1;
  const rawDmg = skill.baseDamageMin +
    Math.floor(Math.random() * (skill.baseDamageMax - skill.baseDamageMin + 1));

  // Ataque base do atacante
  const atkTotal = (attacker.attack || 25)
    + (attacker.equipBonus?.attack || 0)
    + (attacker.clanBuff?.attack || 0);

  // Defesa base do defensor
  const defTotal = (defender.defense || 20)
    + (defender.equipBonus?.defense || 0)
    + (defender.clanBuff?.defense || 0);

  // Buff de ataque temporário (de poções ou skills)
  const atkBuffValue = (activeBuffs || [])
    .filter(b => b.type === 'buff_attack' && b.turnsRemaining > 0)
    .reduce((sum, b) => sum + (b.value || 0), 0);

  // Buff de defesa temporário do defensor
  const defBuffValue = (defender.buffs || [])
    .filter(b => b.type === 'defense' && b.turnsRemaining > 0)
    .reduce((sum, b) => sum + (b.value || 0), 0);

  // Armor break aplicado ao defensor
  const armorBreakMult = (defender.armorBroken) ? 0.7 : 1.0;
  const effectiveDefense = Math.max(0, (defTotal + defBuffValue) * armorBreakMult);

  let damage = Math.max(1,
    rawDmg + Math.floor(atkTotal / 2) + atkBuffValue - Math.floor(effectiveDefense / 3)
  );

  // Skill ignore_defense
  if (skill.passiveEffect === 'ignore_defense' || skill.passiveEffect === 'true_damage' ||
      skill.passiveEffect === 'true_damage_multi' || skill.passiveEffect === 'true_damage_all_debuff') {
    damage = Math.max(1, rawDmg + Math.floor(atkTotal / 2) + atkBuffValue);
  }

  // Ignore def parcial (chama_azul, etc.)
  if (skill.passiveEffect === 'partial_ignore_def') {
    const ignoredDef = Math.floor(effectiveDefense * (lvl >= 5 ? 0.65 : 0.35));
    damage = Math.max(1, rawDmg + Math.floor(atkTotal / 2) + atkBuffValue - Math.floor((effectiveDefense - ignoredDef) / 3));
  }

  // Bonus_on_debuff (furacão_concentrado)
  if (skill.passiveEffect === 'bonus_on_debuff' && defender.activeDebuffs?.length > 0) {
    const bonusPerDebuff = lvl >= 5 ? 0.12 : 0.08;
    damage = Math.round(damage * (1 + bonusPerDebuff * defender.activeDebuffs.length));
  }

  // ── 2. Vantagem elemental ──
  const elementalMult = getElementalMultiplier(attacker.element, defender.element);
  damage = Math.round(damage * elementalMult);

  // ── 3. "Defender" — se defensor está em postura defensiva, dano é metade ──
  if (defender.defending) {
    damage = Math.max(1, Math.floor(damage * 0.5));
  }

  // ── 4. Crítico (rolado por último para somar em cima de tudo) ──
  let isCrit = false;
  // Ataque básico não pode crit (evita estragar PvE no início do jogo)
  if (skill.id !== 'ataque_basico' && Math.random() < getCritChance(attacker, skill)) {
    damage = Math.round(damage * CRIT_MULTIPLIER);
    isCrit = true;
  }

  return {
    damage: Math.max(1, Math.round(damage)),
    isCrit,
    isDodge: false,
    elementalMult,
    raw: rawDmg,
  };
}

/**
 * Versão "simples" — retorna só o número de dano.
 * Mantida para retrocompatibilidade com código que ainda chama assim.
 */
export function calculateDamage(skill, attacker, defender, activeBuffs = []) {
  return calculateDamageDetailed(skill, attacker, defender, activeBuffs).damage;
}

// Apenas estas 4 strings causam status (burn/freeze/stun/slow). Outros
// passiveEffect (multi_hit, momentum, etc.) são tratados em outros
// lugares e NÃO aplicam status persistentes.
const STATUS_PASSIVE_MAP = {
  burn:   'burn',
  freeze: 'freeze',
  stun:   'stun',
  slow:   'slow',
};

// Chance base de aplicar o status. Pode ser ajustado por nível da skill.
const STATUS_BASE_CHANCE = {
  burn:   0.65,  // queimar é o mais "frequente" — Fogo
  freeze: 0.45,  // congelar é forte (chance de pular turno) — Água
  stun:   0.50,  // atordoar é determinístico se aplicar — Terra
  slow:   0.70,  // lentidão é o "menos punitivo" — Ar
};

/**
 * Decide se uma skill aplica status no alvo. Chamado pelo battle.js
 * DEPOIS do calculateDamageDetailed (não aplica em dodge). Retorna:
 *   { statusId, duration }   ou null
 *
 * Considera o nível da skill: a partir do nível 5, chance +15%.
 */
export function rollStatusApplication(skill) {
  if (!skill || !skill.passiveEffect) return null;
  const statusId = STATUS_PASSIVE_MAP[skill.passiveEffect];
  if (!statusId) return null;

  const lvl = skill.level || 1;
  const baseChance = STATUS_BASE_CHANCE[statusId] ?? 0.5;
  const chance = baseChance + (lvl >= 5 ? 0.15 : 0);
  if (Math.random() >= chance) return null;

  // Duração vem do effectDuration da skill, ou da default do status
  const duration = skill.effectDuration && skill.effectDuration > 0
    ? skill.effectDuration
    : undefined; // o status-effects.js usa default
  return { statusId, duration };
}

// Skills disponíveis para compra por elemento e nível do personagem
export function getAvailableSkillsForShop(element, characterLevel) {
  return Object.values(SKILLS)
    .filter(s => s.element === element && s.path !== null && (s.minLevel || 1) <= characterLevel)
    .sort((a, b) => (a.minLevel || 1) - (b.minLevel || 1));
}

// Custo de upgrade de skill
export function getSkillUpgradeCost(skillId, currentLevel) {
  const costs = [0, 200, 500, 1200, 3000]; // custo para ir do nível atual para o próximo
  return costs[Math.min(currentLevel, 4)] || 0;
}

// STORY_CHAPTER_SKILLS — mantido para compatibilidade
export { LENDARIAS_SKILLS as STORY_CHAPTER_SKILLS };