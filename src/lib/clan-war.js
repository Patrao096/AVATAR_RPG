// backend/src/lib/clan-war.js
//
// Pontuação:
//   - 10 pts pelo clã do vencedor
//   - 3 pts pelo clã do derrotado (participação)
//
// Como funciona:
//   1. Admin lança um ClanWarEvent com status='active'
//   2. Quando uma batalha PvP termina (battle.js → /end), chamamos
//      registerClanWarBattle() — se ambos jogadores tem clã e os clãs
//      são DIFERENTES, atualiza o scoreboard do evento.
//   3. Quando admin marca evento como 'finished', chamamos
//      finalizeClanWarEvent() — distribui prêmios pro clã líder.
//
// Recompensas pro campeão:
//   - 50.000 Yuan no baú do clã
//   - Badge "🏆 Campeão · {nomeEvento}" no array championBadges
//   - Buff +5% EXP/Yuan por 7 dias (buffType='exp_yuan_boost')

import prisma from './prisma.js';

const POINTS_WIN = 10;
const POINTS_LOSS = 3;
const CHAMPION_YUAN_PRIZE = 50000;
const CHAMPION_BUFF_DAYS = 7;
const CHAMPION_BUFF_VALUE = 0.05; // +5%

let _activeCache = { event: null, fetchedAt: 0 };
const ACTIVE_CACHE_MS = 30_000; // 30s

export async function getActiveEvent() {
  const now = Date.now();
  if (_activeCache.event && (now - _activeCache.fetchedAt) < ACTIVE_CACHE_MS) {
    return _activeCache.event;
  }
  const event = await prisma.clanWarEvent.findFirst({
    where: { status: 'active' },
    orderBy: { startsAt: 'desc' },
  });
  _activeCache = { event, fetchedAt: now };
  return event;
}

export function invalidateActiveCache() {
  _activeCache = { event: null, fetchedAt: 0 };
}

/**
 * Chamado por /battle/end quando uma batalha PvP termina.
 *
 * Args: { winnerUserId, loserUserId } — os dois userIds.
 *
 * Lógica:
 *   1. Busca evento ativo. Se não houver, no-op.
 *   2. Busca os clãs de cada um. Se algum não tem clã ou os clãs são
 *      iguais (sparring interno), no-op.
 *   3. Atualiza o scoreboard JSON: +10 pro vencedor, +3 pro derrotado.
 *   4. Mantém a contagem de batalhas e nome de cada clã no scoreboard.
 *
 * Retorna { applied: boolean, eventId, winnerClan, loserClan, points } ou null.
 */
export async function registerClanWarBattle({ winnerUserId, loserUserId }) {
  if (!winnerUserId || !loserUserId) return null;

  const event = await getActiveEvent();
  if (!event) return null;

  // Buscamos as memberships dos dois jogadores
  const [winnerMember, loserMember] = await Promise.all([
    prisma.clanMember.findUnique({
      where: { userId: winnerUserId },
      include: { clan: true },
    }),
    prisma.clanMember.findUnique({
      where: { userId: loserUserId },
      include: { clan: true },
    }),
  ]);

  if (!winnerMember?.clan || !loserMember?.clan) return null;
  if (winnerMember.clan.id === loserMember.clan.id) return null; // mesmo clã

  // Atualiza scoreboard: { [clanId]: { name, element, points, wins, losses } }
  const board = (event.scoreboard && typeof event.scoreboard === 'object')
    ? { ...event.scoreboard } : {};

  const wId = winnerMember.clan.id;
  const lId = loserMember.clan.id;

  if (!board[wId]) board[wId] = { name: winnerMember.clan.name, element: winnerMember.clan.element, points: 0, wins: 0, losses: 0 };
  if (!board[lId]) board[lId] = { name: loserMember.clan.name, element: loserMember.clan.element, points: 0, wins: 0, losses: 0 };

  board[wId].points += POINTS_WIN;
  board[wId].wins += 1;
  board[wId].name = winnerMember.clan.name; // garante atualizado
  board[lId].points += POINTS_LOSS;
  board[lId].losses += 1;
  board[lId].name = loserMember.clan.name;

  await prisma.clanWarEvent.update({
    where: { id: event.id },
    data: { scoreboard: board },
  });

  return {
    applied: true,
    eventId: event.id,
    eventName: event.name,
    winnerClan: { id: wId, name: winnerMember.clan.name, points: board[wId].points },
    loserClan:  { id: lId, name: loserMember.clan.name, points: board[lId].points },
    pointsAwarded: { win: POINTS_WIN, loss: POINTS_LOSS },
  };
}

/**
 * Determina o clã campeão do scoreboard (maior pontos, desempate por wins).
 * Retorna { id, name, points, wins } ou null se vazio.
 */
export function getEventChampion(event) {
  const board = event?.scoreboard || {};
  const entries = Object.entries(board);
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
    return (b[1].wins || 0) - (a[1].wins || 0);
  });
  const [id, data] = entries[0];
  return { id, ...data };
}

/**
 * Retorna o leaderboard ordenado (público).
 */
export function getLeaderboard(event) {
  const board = event?.scoreboard || {};
  return Object.entries(board)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.wins || 0) - (a.wins || 0);
    });
}

/**
 * Aplicado quando admin marca evento como 'finished'.
 * Distribui:
 *   - 50.000 Yuan ao baú do clã líder
 *   - Badge no array championBadges
 *   - Buff +5% EXP/Yuan por 7 dias
 *
 * Idempotente: se o evento já tem `championAwarded` no scoreboard, não repete.
 */
export async function finalizeClanWarEvent(eventId) {
  const event = await prisma.clanWarEvent.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, error: 'Evento não encontrado' };
  if (event.scoreboard?.championAwarded) {
    return { ok: false, error: 'Recompensas já foram distribuídas para este evento' };
  }

  const champion = getEventChampion(event);
  if (!champion) {
    // Marca como concluído mesmo sem campeão (ninguém lutou)
    await prisma.clanWarEvent.update({
      where: { id: eventId },
      data: {
        status: 'finished',
        scoreboard: { ...event.scoreboard, championAwarded: true, championAwardedAt: new Date().toISOString() },
      },
    });
    invalidateActiveCache();
    return { ok: true, champion: null, message: 'Evento encerrado sem campeão (nenhuma batalha entre clãs).' };
  }

  // Carrega clã campeão p/ atualizar
  const clan = await prisma.clan.findUnique({ where: { id: champion.id } });
  if (!clan) {
    return { ok: false, error: 'Clã campeão não existe mais' };
  }

  const badges = Array.isArray(clan.championBadges) ? [...clan.championBadges] : [];
  badges.push({
    eventId: event.id,
    eventName: event.name,
    awardedAt: new Date().toISOString(),
  });

  const buffExpiresAt = new Date(Date.now() + CHAMPION_BUFF_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.clan.update({
      where: { id: clan.id },
      data: {
        treasury: { increment: CHAMPION_YUAN_PRIZE },
        championBadges: badges,
        buffType: 'exp_yuan_boost',
        buffValue: CHAMPION_BUFF_VALUE,
        buffExpiresAt,
      },
    }),
    prisma.clanWarEvent.update({
      where: { id: event.id },
      data: {
        status: 'finished',
        scoreboard: {
          ...event.scoreboard,
          championAwarded: true,
          championAwardedAt: new Date().toISOString(),
          championClanId: clan.id,
          championClanName: clan.name,
        },
      },
    }),
  ]);

  invalidateActiveCache();

  return {
    ok: true,
    champion: { id: clan.id, name: clan.name, points: champion.points, wins: champion.wins },
    rewards: {
      yuan: CHAMPION_YUAN_PRIZE,
      buff: { type: 'exp_yuan_boost', value: CHAMPION_BUFF_VALUE, days: CHAMPION_BUFF_DAYS },
      badge: `🏆 Campeão · ${event.name}`,
    },
  };
}

/**
 * Helper pra outros lugares (battle.js, quest.js): retorna o multiplicador
 * de EXP/Yuan ativo do clã do usuário (se houver buff válido).
 *
 * Retorna 1.0 (sem buff) ou 1.05 (com buff).
 */
export async function getClanEventBuffMultiplier(userId) {
  if (!userId) return 1.0;
  try {
    const member = await prisma.clanMember.findUnique({
      where: { userId },
      include: { clan: { select: { buffType: true, buffValue: true, buffExpiresAt: true } } },
    });
    const clan = member?.clan;
    if (!clan?.buffType) return 1.0;
    if (clan.buffType !== 'exp_yuan_boost') return 1.0;
    if (clan.buffExpiresAt && new Date(clan.buffExpiresAt) < new Date()) return 1.0;
    return 1.0 + (clan.buffValue || 0);
  } catch {
    return 1.0;
  }
}
