// backend/src/routes/story.js
// - 10 capítulos
// - Plano FREE libera os 5 primeiros
// - Cenas podem ser de TIPO 'battle'
// - Batalhas usam battle-state
// - Sistema de clã: NPC temático, narrativa adaptada e recompensa específica por clã

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { STORY } from '../data/story-chapters.js';
import { STORY_CHAPTER_SKILLS, SKILLS } from '../lib/skills.js';
import { hasPremium } from '../lib/subscription-helper.js';
import { applyExpGain } from '../lib/progression.js';
import { computeEquipBonus, getEquippedConsumables } from './inventory.js';
import { getEffectiveClanBuff } from './loadout.js';
import {
  createBattle as createBattleState,
  getBattleState,
  endBattleState,
} from '../lib/battle-state.js';
import { getClanStoryReward } from '../lib/items-lookup.js';

const router = express.Router();

// Plano FREE: liberar capítulos 1-5
const FREE_CHAPTER_LIMIT = 5;
// Cooldown entre capítulos: 30 minutos
const CHAPTER_COOLDOWN_MS = 30 * 60 * 1000;

/**
 * Retorna o tempo restante (em ms) até o jogador poder começar um novo capítulo.
 * 0 = pode jogar agora.
 */
function chapterCooldownRemaining(character) {
  if (!character.lastChapterCompletedAt) return 0;
  const elapsed = Date.now() - new Date(character.lastChapterCompletedAt).getTime();
  return Math.max(0, CHAPTER_COOLDOWN_MS - elapsed);
}

// ─── Skills desbloqueadas conforme perfil dominante ───
const PROFILE_SKILLS = {
  wise: {
    1: null,
    2: 'tempestade',
    3: 'dobra_espirito',
    4: 'avatar_state',
    5: 'equilibrio_lendario',
    6: 'furia_dragao',
    7: 'cometa_sozin',
    8: 'guerreiro_eterno',
    9: 'julgamento_celestial',
    10: 'origem_universo',
  },
  aggressive: {
    1: null,
    2: 'tempestade',
    3: 'avatar_state',
    4: 'dobra_espirito',
    5: 'equilibrio_lendario',
    6: 'cometa_sozin',
    7: 'furia_dragao',
    8: 'guerreiro_eterno',
    9: 'julgamento_celestial',
    10: 'origem_universo',
  },
  fearful: {
    1: null,
    2: 'dobra_espirito',
    3: 'tempestade',
    4: 'avatar_state',
    5: 'equilibrio_lendario',
    6: 'furia_dragao',
    7: 'guerreiro_eterno',
    8: 'cometa_sozin',
    9: 'julgamento_celestial',
    10: 'origem_universo',
  },
};

function getDominantProfile(storyProfile) {
  const p = storyProfile || { wise: 0, aggressive: 0, fearful: 0 };
  const entries = Object.entries(p);
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function calculateElement(elementProfile, storyProfile) {
  const ep = elementProfile || { Fogo: 0, 'Água': 0, Terra: 0, Ar: 0 };
  const entries = Object.entries(ep);
  const max = Math.max(...entries.map(([, v]) => v));
  if (max === 0) return 'Ar';
  const tiedAtMax = entries.filter(([, v]) => v === max).map(([k]) => k);
  if (tiedAtMax.length === 1) return tiedAtMax[0];
  const sp = storyProfile || { wise: 0, aggressive: 0, fearful: 0 };
  const tagMax = Math.max(sp.wise, sp.aggressive, sp.fearful);
  if (sp.aggressive === tagMax && tiedAtMax.includes('Fogo')) return 'Fogo';
  if (sp.fearful === tagMax && tiedAtMax.includes('Terra')) return 'Terra';
  if (sp.wise === tagMax) {
    if (tiedAtMax.includes('Ar')) return 'Ar';
    if (tiedAtMax.includes('Água')) return 'Água';
  }
  return tiedAtMax.includes('Ar') ? 'Ar' : tiedAtMax[0];
}

function baseSkillForElement(element) {
  const map = {
    Fogo: 'dobra_fogo',
    Água: 'dobra_agua',
    Terra: 'dobra_terra',
    Ar: 'dobra_ar',
  };
  return map[element] || null;
}

// GET /api/story/progress
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    let progress = await prisma.storyProgress.findUnique({
      where: { characterId: character.id },
    });
    if (!progress) {
      progress = await prisma.storyProgress.create({
        data: { characterId: character.id, chapter: 1, scene: 0 },
      });
    }

    const isPremium = await hasPremium(req.userId);
    const completedChapters = Array.isArray(progress.choices?._completed)
      ? progress.choices._completed
      : [];

    const chapters = Object.entries(STORY).map(([id, data]) => {
      const chapterId = Number(id);
      const isCompleted = completedChapters.includes(chapterId);
      const requiresPremium = !isPremium && chapterId > FREE_CHAPTER_LIMIT;
      const battleScenes = data.scenes.filter(s => s.type === 'battle').length;

      return {
        id: chapterId,
        title: data.title,
        description: data.description,
        scenes: data.scenes.length,
        battleScenes,
        rewardExp: baseExpForChapter(chapterId),
        rewardYuan: baseYuanForChapter(chapterId),
        rewardSkill: skillNameForChapter(chapterId),
        isCompleted,
        requiresPremium,
      };
    });

    res.json({
      ...progress,
      chapters,
      completedChapters,
      isPremium,
      freeChapterLimit: FREE_CHAPTER_LIMIT,
      storyProfile: character.storyProfile || { wise: 0, aggressive: 0, fearful: 0 },
      chapterCooldownMs: CHAPTER_COOLDOWN_MS,
      cooldownRemainingMs: chapterCooldownRemaining(character),
      lastChapterCompletedAt: character.lastChapterCompletedAt,
    });
  } catch (error) {
    console.error('story/progress:', error);
    res.status(500).json({ error: 'Erro ao buscar progresso' });
  }
});

// ─── Busca o elemento do clã do jogador ────────────────────────────────
export async function getClanElement(userId, prisma) {
  try {
    const member = await prisma.clanMember.findUnique({
      where: { userId },
      include: { clan: { select: { element: true } } },
    });
    return member?.clan?.element || null;
  } catch {
    return null;
  }
}

// ─── NPCs inimigos por clã e capítulo ─────────────────────────────────
const CLAN_CHAPTER_NPCS = {
  Fogo: {
    2: { name: 'Almirante Zhao', element: 'Fogo', icon: '⚓', attack: 28, defense: 18, maxHp: 90, level: 3, personality: 'aggressive' },
    3: { name: 'Coronel Mongke', element: 'Fogo', icon: '🔥', attack: 34, defense: 22, maxHp: 100, level: 5, personality: 'aggressive' },
    4: { name: 'Azula', element: 'Fogo', icon: '⚡', attack: 42, defense: 20, maxHp: 115, level: 8, personality: 'aggressive' },
    5: { name: 'Senhor do Fogo Ozai', element: 'Fogo', icon: '👑', attack: 52, defense: 25, maxHp: 140, level: 12, personality: 'berserker' },
  },
  Água: {
    2: { name: 'Capitão da Guarda do Polo Norte', element: 'Água', icon: '❄️', attack: 26, defense: 20, maxHp: 88, level: 3, personality: 'defensive' },
    3: { name: 'Hama', element: 'Água', icon: '🩸', attack: 36, defense: 18, maxHp: 100, level: 5, personality: 'trickster' },
    4: { name: 'Mestre Pakku', element: 'Água', icon: '💧', attack: 38, defense: 28, maxHp: 115, level: 8, personality: 'wise' },
    5: { name: 'Espírito Aquático Corrompido', element: 'Água', icon: '🌊', attack: 50, defense: 30, maxHp: 140, level: 12, personality: 'wise' },
  },
  Terra: {
    2: { name: 'General da Muralha', element: 'Terra', icon: '🧱', attack: 24, defense: 28, maxHp: 95, level: 3, personality: 'defensive' },
    3: { name: 'Cavaleiro da Rocha', element: 'Terra', icon: '⛏️', attack: 32, defense: 26, maxHp: 108, level: 5, personality: 'berserker' },
    4: { name: 'Mestre Long Feng', element: 'Terra', icon: '🐍', attack: 36, defense: 30, maxHp: 120, level: 8, personality: 'trickster' },
    5: { name: 'Rei Bumi', element: 'Terra', icon: '👴', attack: 48, defense: 40, maxHp: 145, level: 12, personality: 'berserker' },
  },
  Ar: {
    2: { name: 'Espírito Irado do Templo', element: 'Ar', icon: '👻', attack: 22, defense: 16, maxHp: 85, level: 3, personality: 'trickster' },
    3: { name: 'Nômade Renegado', element: 'Ar', icon: '🌬️', attack: 30, defense: 20, maxHp: 98, level: 5, personality: 'trickster' },
    4: { name: 'Mestre do Ar Corrompido', element: 'Ar', icon: '🌪️', attack: 35, defense: 22, maxHp: 110, level: 8, personality: 'trickster' },
    5: { name: 'Avatar Corrompido (Fragmento)', element: 'Ar', icon: '⚡', attack: 46, defense: 24, maxHp: 138, level: 12, personality: 'wise' },
  },
  Neutro: {
    2: { name: 'Soldado da Nação do Fogo', element: 'Fogo', icon: '⚔️', attack: 25, defense: 18, maxHp: 85, level: 3, personality: 'aggressive' },
    3: { name: 'Mercenário Misterioso', element: 'Fogo', icon: '🗡️', attack: 32, defense: 20, maxHp: 98, level: 5, personality: 'trickster' },
    4: { name: 'Azula', element: 'Fogo', icon: '⚡', attack: 40, defense: 20, maxHp: 112, level: 8, personality: 'aggressive' },
    5: { name: 'Senhor do Fogo Ozai', element: 'Fogo', icon: '👑', attack: 50, defense: 24, maxHp: 138, level: 12, personality: 'berserker' },
  },
};

export function getClanNPC(clanElement, chapterNumber) {
  const element = clanElement || 'Neutro';
  const npcs = CLAN_CHAPTER_NPCS[element] || CLAN_CHAPTER_NPCS['Neutro'];
  const npc = npcs[chapterNumber] || CLAN_CHAPTER_NPCS['Neutro'][chapterNumber] || null;
  if (!npc) return null;

  return {
    ...npc,
    maxChi: npc.maxChi !== undefined ? npc.maxChi : 80 + Math.floor((npc.level || 0) * 4),
    chi: npc.maxChi !== undefined ? npc.maxChi : 80 + Math.floor((npc.level || 0) * 4),
  };
}

// ─── Variantes de texto por elemento do clã ───────────────────────────
const CHAPTER_INTRO_VARIANTS = {
  Fogo: {
    1: 'As chamas dentro de você pulsam com intensidade incomum. O monge nota isso.',
    2: 'Sua lealdade à Nação do Fogo é testada quando o conflito bate à porta.',
    3: 'As cinzas do confronto ainda fumegam enquanto você avança.',
    4: 'O poder do fogo que você carrega começa a revelar sua verdadeira natureza.',
    5: 'A chama que iniciou tudo agora ilumina o caminho final.',
  },
  Água: {
    1: 'A água que flui por você se move como memórias antigas. O monge percebe.',
    2: 'As ondas do destino te carregam para onde você precisa estar.',
    3: 'Como a maré, você recua para avançar com ainda mais força.',
    4: 'A lua guia seus passos enquanto a água dentro de você encontra seu rio.',
    5: 'O oceano de possibilidades se abre diante do caminho que você escolheu.',
  },
  Terra: {
    1: 'Você sente o peso da terra abaixo dos seus pés. Firme. Sólido. Você.',
    2: 'As muralhas podem cair, mas o espírito da terra permanece inabalável.',
    3: 'Como a rocha moldada por séculos, você se torna algo mais através da pressão.',
    4: 'A terra ao seu redor responde ao seu chi com um zumbido grave e poderoso.',
    5: 'O continente inteiro parece reconhecer o que você está prestes a se tornar.',
  },
  Ar: {
    1: 'O vento sussurra ao seu redor como se conhecesse seus pensamentos.',
    2: 'Livre como o ar, você navega por onde outros encontrariam barreiras.',
    3: 'A leveza do Ar não significa fragilidade — você aprende isso hoje.',
    4: 'O vento que você comanda começa a ressoar com algo muito maior que você.',
    5: 'No silêncio entre uma rajada e outra, você encontra a resposta que buscava.',
  },
};

export function getChapterIntroVariant(clanElement, chapterNumber) {
  const element = clanElement || 'Ar';
  const variants = CHAPTER_INTRO_VARIANTS[element] || CHAPTER_INTRO_VARIANTS['Ar'];
  return variants[chapterNumber] || '';
}

// ─── Recompensa do capítulo por clã ──────────────────────────────────
export async function grantChapterReward(characterId, userId, chapterNumber, prisma) {
  const member = await prisma.clanMember.findUnique({
    where: { userId },
    include: { clan: { select: { element: true } } },
  });
  const clanElement = member?.clan?.element || 'Neutro';

  const rewardItemName = getClanStoryReward(clanElement, chapterNumber);
  if (!rewardItemName) {
    console.warn(`grantChapterReward: sem recompensa para clã ${clanElement} cap ${chapterNumber}`);
    return null;
  }

  const existing = await prisma.inventoryItem.findFirst({
    where: { characterId, itemName: rewardItemName },
  });

  if (existing) {
    await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: 1 } },
    });
  } else {
    await prisma.inventoryItem.create({
      data: { characterId, itemName: rewardItemName, quantity: 1 },
    });
  }

  return {
    itemName: rewardItemName,
    clanElement,
    chapterNumber,
    message: `🎁 Recompensa do Clã ${clanElement}: ${rewardItemName}`,
  };
}

// GET /api/story/scene/:chapter/:scene
router.get('/scene/:chapter/:scene', authMiddleware, async (req, res) => {
  const ch = Number(req.params.chapter);
  const sc = Number(req.params.scene);
  const chapterData = STORY[ch];
  if (!chapterData) return res.status(404).json({ error: 'Capítulo não existe' });
  const scene = chapterData.scenes[sc];
  if (!scene) return res.status(404).json({ error: 'Cena não existe' });

  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const progress = await prisma.storyProgress.findUnique({ where: { characterId: character.id } });
    if (!progress) return res.status(404).json({ error: 'Progresso não encontrado' });

    if (ch > progress.chapter) return res.status(403).json({ error: 'Capítulo bloqueado' });

    const completedChapters = Array.isArray(progress.choices?._completed)
      ? progress.choices._completed
      : [];

    if (completedChapters.includes(ch)) {
      return res.status(403).json({ error: 'Você já concluiu este capítulo.', alreadyCompleted: true });
    }

    if (ch > FREE_CHAPTER_LIMIT) {
      const isPremium = await hasPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          error: `Apenas usuários Premium têm acesso aos capítulos ${FREE_CHAPTER_LIMIT + 1} em diante.`,
          requiresPremium: true,
        });
      }
    }

    const cooldownRemaining = chapterCooldownRemaining(character);
    const isStartingChapter = sc === 0 && progress.scene === 0;
    if (isStartingChapter && cooldownRemaining > 0 && completedChapters.length > 0) {
      return res.status(429).json({
        error: `Aguarde ${Math.ceil(cooldownRemaining / 60000)} minuto(s) antes de iniciar um novo capítulo.`,
        cooldownRemainingMs: cooldownRemaining,
        cooldown: true,
      });
    }

    const clanElement = await getClanElement(req.userId, prisma);

    if (scene.type === 'battle') {
      const npc = getClanNPC(clanElement, ch);
      const introVariant = getChapterIntroVariant(clanElement, ch);
      const battleText = introVariant ? `${introVariant}\n\n${scene.text}` : scene.text;
      const opponentData = npc || scene.opponent;

      return res.json({
        chapter: ch,
        scene: sc,
        type: 'battle',
        title: scene.title,
        text: battleText,
        opponent: opponentData,
        rewardOnWin: scene.rewardOnWin || { exp: 100, yuan: 50 },
        rewardOnLose: scene.rewardOnLose || { exp: 20, yuan: 5 },
        chapterTitle: chapterData.title,
        totalScenes: chapterData.scenes.length,
      });
    }

    res.json({
      chapter: ch,
      scene: sc,
      type: 'choice',
      title: scene.title,
      text: scene.text,
      choices: scene.choices.map(c => c.label),
      chapterTitle: chapterData.title,
      totalScenes: chapterData.scenes.length,
    });
  } catch (error) {
    console.error('story/scene:', error);
    res.status(500).json({ error: 'Erro ao buscar cena' });
  }
});

// POST /api/story/start-battle
router.post('/start-battle', authMiddleware, async (req, res) => {
  const { chapter, scene } = req.body;
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const chapterData = STORY[chapter];
    if (!chapterData) return res.status(400).json({ error: 'Capítulo inválido' });

    const sceneData = chapterData.scenes[scene];
    if (!sceneData || sceneData.type !== 'battle') {
      return res.status(400).json({ error: 'Esta cena não é de batalha' });
    }

    if (chapter > FREE_CHAPTER_LIMIT) {
      const isPremium = await hasPremium(req.userId);
      if (!isPremium) return res.status(403).json({ error: 'Premium necessário', requiresPremium: true });
    }

    const clanElement = await getClanElement(req.userId, prisma);
    const npc = getClanNPC(clanElement, chapter);
    const opp = npc || sceneData.opponent;

    const equipBonus = await computeEquipBonus(character.id);
    const clanBuff = await getEffectiveClanBuff(character.id, req.userId);
    const equippedConsumables = await getEquippedConsumables(character.id);
    const equippedSkillIds = Array.isArray(character.equippedSkills) ? character.equippedSkills : [];

    const fullMaxHp = character.maxHp + (equipBonus.hp || 0) + (clanBuff.hp || 0);
    const fullMaxChi = character.maxChi + (equipBonus.chi || 0) + (clanBuff.chi || 0);

    const battleId = `story-${chapter}-${scene}-${Date.now()}-${req.userId}`;

    createBattleState(battleId, {
      userId: req.userId,
      characterId: character.id,
      name: character.name,
      element: character.element,
      elo: character.elo,
      level: character.level,
      attack: character.attack,
      defense: character.defense,
      maxHp: fullMaxHp,
      hp: fullMaxHp,
      maxChi: fullMaxChi,
      chi: fullMaxChi,
      equipBonus,
      clanBuff,
      equippedSkillIds,
      consumables: equippedConsumables.map(c => ({
        inventoryId: c.id,
        itemName: c.itemName,
        quantity: c.quantity,
        effect: c.effect,
      })),
      isBot: false,
    }, {
      userId: null,
      name: opp.name,
      element: opp.element,
      level: opp.level,
      attack: opp.attack,
      defense: opp.defense,
      maxHp: opp.maxHp,
      hp: opp.maxHp,
      maxChi: opp.maxChi,
      chi: opp.maxChi,
      elo: 500 + opp.level * 50,
      equippedSkillIds: [],
      consumables: [],
      isBot: true,
    }, { isPvP: false });

    const state = getBattleState(battleId);
    if (state) {
      state.isStoryBattle = true;
      state.storyChapter = chapter;
      state.storyScene = scene;
    }

    res.json({
      battleId,
      mySide: 'A',
      type: 'story_battle',
      player: {
        name: character.name,
        element: character.element,
        level: character.level,
        elo: character.elo,
        attack: character.attack,
        defense: character.defense,
        hp: fullMaxHp,
        maxHp: fullMaxHp,
        chi: fullMaxChi,
        maxChi: fullMaxChi,
        equipBonus,
        clanBuff,
      },
      opponent: {
        ...opp,
        rank: { id: 'story', name: 'História', icon: '📖', badge: '#a855f7' },
      },
      chapter,
      scene,
      chapterTitle: chapterData.title,
      sceneTitle: sceneData.title,
    });
  } catch (error) {
    console.error('story/start-battle:', error);
    res.status(500).json({ error: 'Erro ao iniciar batalha de história' });
  }
});

// POST /api/story/finish-battle
router.post('/finish-battle', authMiddleware, async (req, res) => {
  const { battleId, chapter, scene, won } = req.body;
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const chapterData = STORY[chapter];
    if (!chapterData) return res.status(400).json({ error: 'Capítulo inválido' });

    const sceneData = chapterData.scenes[scene];
    if (!sceneData || sceneData.type !== 'battle') {
      return res.status(400).json({ error: 'Cena inválida' });
    }

    const reward = won ? sceneData.rewardOnWin : sceneData.rewardOnLose;
    const expReward = reward?.exp || 0;
    const yuanReward = reward?.yuan || 0;

    const progress = await prisma.storyProgress.findUnique({ where: { characterId: character.id } });

    // Sem isso, jogador podia clicar finish-battle múltiplas vezes
    // (replay de request) e ganhar EXP/Yuan repetidamente.
    const completedSafely = Array.isArray(progress?.choices?._completed)
      ? progress.choices._completed : [];
    if (completedSafely.includes(chapter)) {
      return res.status(403).json({ error: 'Capítulo já concluído.' });
    }
    if (!progress || chapter !== progress.chapter) {
      return res.status(403).json({ error: 'Capítulo não está em andamento.' });
    }
    if (scene !== progress.scene) {
      return res.status(409).json({
        error: 'Sincronização — esta batalha já foi resolvida.',
        currentScene: progress.scene,
        outOfSync: true,
      });
    }
    // Anti-replay extra: marca a chave da batalha. Se já existe, recusa.
    const battleKeyCheck = `c${chapter}s${scene}_battle`;
    if (progress.choices?.[battleKeyCheck]) {
      return res.status(403).json({ error: 'Esta batalha já foi finalizada.' });
    }

    const choices = progress.choices || {};
    const battleKey = battleKeyCheck;
    choices[battleKey] = { won, at: new Date().toISOString() };

    const nextScene = scene + 1;
    const isLastScene = nextScene >= chapterData.scenes.length;

    if (isLastScene) {
      const existingCompleted = Array.isArray(choices._completed) ? choices._completed : [];
      if (!existingCompleted.includes(chapter)) {
        choices._completed = [...existingCompleted, chapter];
      }
      const isLastChapter = chapter >= Object.keys(STORY).length;
      await prisma.storyProgress.update({
        where: { characterId: character.id },
        data: {
          choices,
          scene: 0,
          chapter: isLastChapter ? chapter : chapter + 1,
          completed: isLastChapter,
        },
      });
    } else {
      await prisma.storyProgress.update({
        where: { characterId: character.id },
        data: { choices, scene: nextScene },
      });
    }

    const progression = applyExpGain(character, expReward);
    const characterUpdateData = {
      exp: progression.newExp,
      level: progression.newLevel,
      attributePoints: progression.newAttributePoints,
      money: { increment: yuanReward },
    };
    // Se este finish-battle conclui o capítulo, marca o cooldown de 30min
    // (caso contrário o jogador poderia spammar capítulos que terminam em batalha).
    if (isLastScene) {
      characterUpdateData.lastChapterCompletedAt = new Date();
    }
    await prisma.character.update({
      where: { id: character.id },
      data: characterUpdateData,
    });

    // Recompensa de clã ao finalizar o capítulo
    let clanReward = null;
    if (isLastScene) {
      clanReward = await grantChapterReward(character.id, req.userId, chapter, prisma);
    }

    if (battleId) endBattleState(battleId);

    res.json({
      success: true,
      won,
      rewards: {
        exp: expReward,
        yuan: yuanReward,
        leveled: progression.leveled,
        levelsGained: progression.levelsGained,
        newLevel: progression.newLevel,
      },
      isLastScene,
      nextScene: isLastScene ? null : nextScene,
      clanReward,
    });
  } catch (error) {
    console.error('story/finish-battle:', error);
    res.status(500).json({ error: 'Erro ao finalizar batalha de história' });
  }
});

// POST /api/story/choice
router.post('/choice', authMiddleware, async (req, res) => {
  const { chapter, scene, choiceIndex } = req.body;
  try {
    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

    const progress = await prisma.storyProgress.findUnique({ where: { characterId: character.id } });
    if (!progress) return res.status(404).json({ error: 'Progresso não encontrado' });

    const chapterData = STORY[chapter];
    if (!chapterData) return res.status(400).json({ error: 'Capítulo inválido' });

    const completedChapters = Array.isArray(progress.choices?._completed)
      ? progress.choices._completed
      : [];

    if (completedChapters.includes(chapter)) {
      return res.status(403).json({ error: 'Você já concluiu este capítulo.', alreadyCompleted: true });
    }

    // Antes, a `scene` vinha do body sem validação contra `progress.scene`,
    // então um usuário podia repostar /choice com scene=0 várias vezes,
    // ganhando exp/yuan a cada chamada e voltando o estado na sequência
    // (porque updateProgress.scene era set para nextScene independente
    // da cena REAL atual).
    if (chapter !== progress.chapter) {
      return res.status(403).json({ error: 'Capítulo não está em andamento.' });
    }
    if (scene !== progress.scene) {
      return res.status(409).json({
        error: 'Sincronização — você já passou desta cena. Recarregue a história.',
        currentScene: progress.scene,
        outOfSync: true,
      });
    }

    if (chapter > FREE_CHAPTER_LIMIT) {
      const isPremium = await hasPremium(req.userId);
      if (!isPremium) {
        return res.status(403).json({
          error: `Apenas usuários Premium têm acesso aos capítulos ${FREE_CHAPTER_LIMIT + 1} em diante.`,
          requiresPremium: true,
        });
      }
    }

    const sceneData = chapterData.scenes[scene];
    if (!sceneData || sceneData.type === 'battle') {
      return res.status(400).json({ error: 'Cena inválida ou é de batalha' });
    }

    const choice = sceneData.choices[choiceIndex];
    if (!choice) return res.status(400).json({ error: 'Escolha inválida' });

    const key = `c${chapter}s${scene}`;
    const existingChoices = progress.choices || {};
    const existingCompleted = Array.isArray(existingChoices._completed) ? existingChoices._completed : [];
    const existingElementProfile = existingChoices._elementProfile || { Fogo: 0, 'Água': 0, Terra: 0, Ar: 0 };

    const choices = {
      ...existingChoices,
      [key]: { index: choiceIndex, tag: choice.tag, element: choice.element || null },
    };

    const profile = { ...(character.storyProfile || { wise: 0, aggressive: 0, fearful: 0 }) };
    profile[choice.tag] = (profile[choice.tag] || 0) + 1;

    const elementProfile = { ...existingElementProfile };
    if (choice.element) {
      const weight = choice.elementWeight || 1;
      elementProfile[choice.element] = (elementProfile[choice.element] || 0) + weight;
    }
    choices._elementProfile = elementProfile;

    const nextScene = scene + 1;
    const isLastScene = nextScene >= chapterData.scenes.length;

    if (isLastScene && !existingCompleted.includes(chapter)) {
      choices._completed = [...existingCompleted, chapter];
    } else {
      choices._completed = existingCompleted;
    }

    const updateProgress = {
      choices,
      scene: isLastScene ? 0 : nextScene,
    };

    let rewards = { exp: 30, yuan: 10 };
    let skillUnlocked = null;
    let newElement = null;
    let chosenTag = choice.tag;

    if (isLastScene) {
      const isLastChapter = chapter >= Object.keys(STORY).length;
      updateProgress.chapter = isLastChapter ? chapter : chapter + 1;
      updateProgress.completed = isLastChapter;

      const dominant = getDominantProfile(profile);
      const baseExp = baseExpForChapter(chapter);
      const baseYuan = baseYuanForChapter(chapter);
      const totalChoices = Object.values(profile).reduce((a, b) => a + b, 0);
      const consistency = totalChoices > 0 ? profile[dominant] / totalChoices : 0;
      const bonus = consistency > 0.6 ? 1.3 : consistency > 0.4 ? 1.15 : 1.0;

      rewards = {
        exp: Math.round(baseExp * bonus),
        yuan: Math.round(baseYuan * bonus),
        profile: dominant,
        consistency: Math.round(consistency * 100),
      };

      let elementAssigned = null;
      let baseSkillUnlocked = null;
      if (chapter === 1 && (!character.element || character.element === 'Nenhum')) {
        newElement = calculateElement(elementProfile, profile);
        elementAssigned = newElement;
        baseSkillUnlocked = baseSkillForElement(newElement);
      }

      const skillId = PROFILE_SKILLS[dominant]?.[chapter];
      if (skillId) {
        const unlocked = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
        if (!unlocked.includes(skillId)) {
          unlocked.push(skillId);
          skillUnlocked = skillId;
        }
      }

      const statBonus = chapter >= 6 ? 5 : chapter >= 3 ? 3 : 2;
      const statUpdates = {};
      if (dominant === 'aggressive') statUpdates.attack = { increment: statBonus };
      if (dominant === 'fearful') statUpdates.defense = { increment: statBonus };
      if (dominant === 'wise') {
        statUpdates.maxChi = { increment: statBonus * 5 };
        statUpdates.chi = { increment: statBonus * 5 };
      }

      const existingSkills = Array.isArray(character.unlockedSkills) ? character.unlockedSkills : [];
      const finalSkills = [...existingSkills];
      if (skillUnlocked && !finalSkills.includes(skillUnlocked)) finalSkills.push(skillUnlocked);
      if (baseSkillUnlocked && !finalSkills.includes(baseSkillUnlocked)) finalSkills.push(baseSkillUnlocked);

      const progression = applyExpGain(character, rewards.exp);
      const updateData = {
        exp: progression.newExp,
        level: progression.newLevel,
        attributePoints: progression.newAttributePoints,
        money: { increment: rewards.yuan },
        storyProfile: profile,
        lastChapterCompletedAt: new Date(),
        ...statUpdates,
      };

      rewards.leveled = progression.leveled;
      rewards.levelsGained = progression.levelsGained;
      rewards.newLevel = progression.newLevel;

      if (finalSkills.length !== existingSkills.length) {
        updateData.unlockedSkills = finalSkills;
      }
      if (elementAssigned) {
        updateData.element = elementAssigned;
      }

      await prisma.character.update({
        where: { id: character.id },
        data: updateData,
      });
      await prisma.storyProgress.update({
        where: { characterId: character.id },
        data: updateProgress,
      });

      // Recompensa de clã ao finalizar o capítulo
      const clanReward = await grantChapterReward(character.id, req.userId, chapter, prisma);

      const BASE_SKILL_NAMES = {
        dobra_fogo: 'Dobra de Fogo',
        dobra_agua: 'Dobra de Água',
        dobra_terra: 'Dobra de Terra',
        dobra_ar: 'Dobra de Ar',
      };

      const baseSkillName = baseSkillUnlocked ? (BASE_SKILL_NAMES[baseSkillUnlocked] || baseSkillUnlocked) : null;
      let skillUnlockedName = null;
      if (skillUnlocked) {
        const skill = SKILLS[skillUnlocked];
        skillUnlockedName = skill?.name || skillUnlocked;
      }

      return res.json({
        success: true,
        isLastScene: true,
        isLastChapter,
        rewards,
        skillUnlocked,
        skillUnlockedName,
        elementAssigned,
        baseSkillUnlocked,
        baseSkillName,
        dominantProfile: dominant,
        profileCounts: profile,
        choiceTag: chosenTag,
        clanReward,
      });
    }

    const tagBonus = choice.tag === 'wise' ? { exp: 40, yuan: 15 }
                    : choice.tag === 'aggressive' ? { exp: 35, yuan: 20 }
                    : { exp: 30, yuan: 12 };
    rewards = tagBonus;

    const intermediateProgression = applyExpGain(character, rewards.exp);
    await prisma.character.update({
      where: { id: character.id },
      data: {
        exp: intermediateProgression.newExp,
        level: intermediateProgression.newLevel,
        attributePoints: intermediateProgression.newAttributePoints,
        money: { increment: rewards.yuan },
        storyProfile: profile,
      },
    });
    await prisma.storyProgress.update({
      where: { characterId: character.id },
      data: updateProgress,
    });

    res.json({
      success: true,
      isLastScene: false,
      rewards: {
        ...rewards,
        leveled: intermediateProgression.leveled,
        levelsGained: intermediateProgression.levelsGained,
        newLevel: intermediateProgression.newLevel,
      },
      choiceTag: chosenTag,
      profileCounts: profile,
    });
  } catch (error) {
    console.error('story/choice:', error);
    res.status(500).json({ error: 'Erro ao salvar escolha' });
  }
});

// ─── Helpers ───
function baseExpForChapter(ch) {
  return {
    1: 500, 2: 800, 3: 1200, 4: 2000, 5: 3000,
    6: 4500, 7: 6500, 8: 9000, 9: 13000, 10: 20000,
  }[ch] || 500;
}

function baseYuanForChapter(ch) {
  return {
    1: 200, 2: 350, 3: 500, 4: 800, 5: 1500,
    6: 2500, 7: 4000, 8: 6000, 9: 9000, 10: 15000,
  }[ch] || 200;
}

function skillNameForChapter(ch) {
  const skillId = STORY_CHAPTER_SKILLS[ch];
  if (!skillId) return null;
  const skill = SKILLS[skillId];
  return skill?.name || null;
}

export default router;