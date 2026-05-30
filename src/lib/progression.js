// backend/src/lib/progression.js
//
// REGRA DE EXP: N * 200 para subir do nível N para N+1
//   Lv 1 → 2: 200 exp
//   Lv 2 → 3: 400 exp
//   Lv 3 → 4: 600 exp
//
//   A cada level up, o personagem ganha +1 Ponto de Atributo (PA)
//   PA é usado para desbloquear nós da árvore de talentos.
//   O campo `attributePoints` no Character é incrementado aqui.

const MAX_LEVEL = 100;

export function expRequiredForLevel(level) {
  return level * 200;
}

/**
 * Aplica ganho de EXP a um personagem.
 *
 * @param {{level: number, exp: number, attributePoints?: number}} character
 * @param {number} expGained
 * @returns {{ newExp, newLevel, levelsGained, expGainedTotal, leveled, expRequired, newAttributePoints }}
 */
export function applyExpGain(character, expGained) {
  let level = character.level;
  let exp = character.exp + expGained;
  let levelsGained = 0;

  while (level < MAX_LEVEL && exp >= expRequiredForLevel(level)) {
    exp -= expRequiredForLevel(level);
    level += 1;
    levelsGained += 1;
  }

  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    exp = Math.min(exp, expRequiredForLevel(MAX_LEVEL) - 1);
  }

  // +1 PA por nível ganho
  const newAttributePoints = (character.attributePoints || 0) + levelsGained;

  return {
    newExp: exp,
    newLevel: level,
    levelsGained,
    expGainedTotal: expGained,
    leveled: levelsGained > 0,
    expRequired: expRequiredForLevel(level),
    newAttributePoints,   // ← NOVO: PA total após o level up
    apGained: levelsGained, // ← quantos PA ganhou nesta progressão
  };
}

export function totalExpAcrossLevels(character) {
  let total = 0;
  for (let l = 1; l < character.level; l++) total += expRequiredForLevel(l);
  return total + character.exp;
}

/**
 * Helper: aplica o resultado do applyExpGain no Prisma.
 * Chame isso após calcular a progressão para salvar no banco.
 *
 * Uso em battle.js / story.js / quest.js:
 *
 *   const progression = applyExpGain(character, expGained);
 *   await applyProgressionToDB(character.id, progression, prisma);
 *
 * @param {string} characterId
 * @param {object} progression - retorno de applyExpGain
 * @param {object} prisma - instância do Prisma
 */
export async function applyProgressionToDB(characterId, progression, prisma) {
  const updateData = {
    exp: progression.newExp,
    level: progression.newLevel,
    attributePoints: progression.newAttributePoints,
  };

  // Se subiu de nível, também aumenta atributos base (HP max, Chi max)
  if (progression.leveled) {
    // +5 HP máx e +2 Chi máx por nível ganho
    updateData.maxHp = { increment: progression.levelsGained * 5 };
    updateData.maxChi = { increment: progression.levelsGained * 2 };
  }

  return prisma.character.update({
    where: { id: characterId },
    data: updateData,
  });
}