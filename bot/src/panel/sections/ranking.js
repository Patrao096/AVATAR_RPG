import { MessageFlags } from 'discord.js';
import { baseEmbed, COLORS, navRow, selectRow } from '../builders.js';
import { ELEMENT_ICON } from '../../config.js';
import { apiGet } from '../../api.js';
import { cached } from '../../cache.js';

const TAB_INFO = {
  players: { label: 'Jogadores', emoji: '👥', description: 'Top 10 por ELO' },
  clans:   { label: 'Clãs',      emoji: '🏛️', description: 'Top 10 por nível e vitórias' },
};

function tabSelect(userId, active) {
  return selectRow('ranking', 'tab', userId, {
    placeholder: 'Trocar ranking…',
    options: Object.entries(TAB_INFO).map(([key, info]) => ({
      value: key,
      label: info.label,
      emoji: info.emoji,
      description: info.description,
      default: key === active,
    })),
  });
}

export async function buildRankingPayload(discordUser, { tab = 'players' } = {}) {
  return tab === 'clans' ? buildClansRanking(discordUser) : buildPlayersRanking(discordUser);
}

async function buildPlayersRanking(discordUser) {
  const userId = discordUser.id;
  const ranking = await cached('ranking:players', () => apiGet('/api/character/ranking'), 60_000);
  const top = ranking.slice(0, 10);

  let desc;
  if (top.length === 0) {
    desc = '*Sem jogadores ranqueados ainda.*';
  } else {
    desc = top.map((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
      const elem = ELEMENT_ICON[r.element] || '⚔️';
      return `${medal} ${elem} **${r.name}** · ${r.elo} ELO · Nível ${r.level}\n` +
             `   ${r.wins}V/${r.losses}D · ${r.discordUsername}`;
    }).join('\n\n');
  }

  const me = ranking.find(r => r.discordId === discordUser.id || r.discordUsername === discordUser.username);
  if (me) desc += `\n\n📍 Sua posição: **#${ranking.indexOf(me) + 1}**`;

  const embed = baseEmbed({
    title: '🏆 Ranking Global · Jogadores',
    description: desc,
    color: COLORS.warning,
  });

  return {
    embeds: [embed],
    components: [tabSelect(userId, 'players'), navRow('ranking', userId)],
    flags: MessageFlags.Ephemeral,
  };
}

async function buildClansRanking(discordUser) {
  const userId = discordUser.id;
  const list = await cached('clans:list', () => apiGet('/api/clan'), 60_000);
  const top = list.slice(0, 10);

  let desc;
  if (top.length === 0) {
    desc = '*Sem clãs ainda.*';
  } else {
    desc = top.map((c, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
      const elem = ELEMENT_ICON[c.element] || '⚔️';
      const champion = c.championBadges > 0 ? ` 🏆×${c.championBadges}` : '';
      return `${medal} ${elem} **${c.name}**${champion}\n` +
             `   Nível ${c.level} · ${c.wins} vitórias · ${c.memberCount}/${c.maxMembers} membros`;
    }).join('\n\n');
  }

  const embed = baseEmbed({
    title: '🏆 Ranking Global · Clãs',
    description: desc,
    color: COLORS.warning,
  });

  return {
    embeds: [embed],
    components: [tabSelect(userId, 'clans'), navRow('ranking', userId)],
    flags: MessageFlags.Ephemeral,
  };
}

export async function handleRanking(interaction, parsed) {
  const { action } = parsed;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildRankingPayload(interaction.user, { tab: 'players' });
    await interaction.editReply(payload);
    return;
  }

  if (action === 'tab' && interaction.isStringSelectMenu()) {
    const tab = interaction.values[0];
    await interaction.deferUpdate();
    const payload = await buildRankingPayload(interaction.user, { tab });
    await interaction.editReply(payload);
  }
}
