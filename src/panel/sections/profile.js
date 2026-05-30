import {
  ActionRowBuilder, UserSelectMenuBuilder, MessageFlags, ButtonStyle,
} from 'discord.js';
import {
  baseEmbed, COLORS, navRow, progressBar, fmtYuan, buttonRow, actionButton,
} from '../builders.js';
import { build as buildId } from '../../utils/customId.js';
import { ELEMENT_ICON } from '../../config.js';
import { apiGet } from '../../api.js';
import { cached } from '../../cache.js';

export async function buildProfilePayload(discordUser, { targetDiscordId } = {}) {
  const userId = discordUser.id;
  const target = targetDiscordId || userId;
  const isSelf = target === userId;

  let c;
  try {
    c = await cached(`profile:${target}`, () => apiGet(`/api/bot/character/${target}`));
  } catch (err) {
    return {
      content: `❌ ${err.message}`,
      embeds: [], components: [navRow('home', userId)],
      flags: MessageFlags.Ephemeral,
    };
  }

  if (!c || !c.id) {
    return {
      content: isSelf
        ? '👋 Você ainda não tem personagem. Acesse o site para criar um.'
        : '❌ Este jogador ainda não tem personagem.',
      embeds: [], components: [navRow('home', userId)],
      flags: MessageFlags.Ephemeral,
    };
  }

  const elemIcon = ELEMENT_ICON[c.element] || '⚔️';
  const total = c.wins + c.losses;
  const winrate = total > 0 ? Math.round((c.wins / total) * 100) : 0;
  const displayName = c.discordUsername || c.name || 'Jogador';
  const avatarHash = c.discordAvatar;

  const embed = baseEmbed({
    title: `${elemIcon} ${displayName}`,
    description:
      `**${c.element || 'Nenhum'}** · Nível ${c.level}\n` +
      `📈 EXP: ${(c.exp || 0).toLocaleString('pt-BR')}\n\n` +
      `❤️ ${progressBar(c.hp, c.maxHp)} \`${c.hp}/${c.maxHp}\`\n` +
      `💜 ${progressBar(c.chi, c.maxChi)} \`${c.chi}/${c.maxChi}\`\n` +
      `⚔️ Ataque **${c.attack}** · 🛡️ Defesa **${c.defense}**\n\n` +
      `🏆 ${c.elo} ELO (pico ${c.peakElo}) · ${c.rankTier}\n` +
      `⚡ ${c.wins}V / ${c.losses}D · ${winrate}% de vitórias\n` +
      `💰 ${fmtYuan(c.money)}`,
    color: COLORS.primary,
    thumbnail: avatarHash
      ? `https://cdn.discordapp.com/avatars/${target}/${avatarHash}.png`
      : null,
  });

  const components = [];

  if (isSelf) {
    components.push(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(buildId('profile', 'view', userId))
        .setPlaceholder('Ver o perfil de outro jogador…')
        .setMinValues(1).setMaxValues(1),
    ));
    components.push(buttonRow(
      actionButton('skills', 'open', userId, { label: 'Skills', emoji: '🎯', style: ButtonStyle.Secondary }),
      actionButton('inventory', 'open', userId, { label: 'Inventário', emoji: '📦', style: ButtonStyle.Secondary }),
      ...navRow('profile', userId).components,
    ));
  } else {
    components.push(buttonRow(
      actionButton('profile', 'open', userId, { label: 'Meu perfil', emoji: '👤', style: ButtonStyle.Primary }),
      ...navRow('profile', userId).components,
    ));
  }

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handleProfile(interaction, parsed) {
  const { action } = parsed;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildProfilePayload(interaction.user);
    await interaction.editReply(payload);
    return;
  }

  if (action === 'view' && interaction.isUserSelectMenu()) {
    const targetId = interaction.values[0];
    await interaction.deferUpdate();
    const payload = await buildProfilePayload(interaction.user, { targetDiscordId: targetId });
    await interaction.editReply(payload);
  }
}
