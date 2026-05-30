import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} from 'discord.js';
import { baseEmbed, COLORS, navRow } from '../builders.js';
import { apiGet } from '../../api.js';
import { cached } from '../../cache.js';

export async function buildStoryPayload(discordUser) {
  const userId = discordUser.id;

  let progress = null;
  try {
    progress = await cached(`story:${userId}`, () => apiGet(`/api/bot/story/${userId}`), 60_000);
  } catch { /* sem progresso */ }

  let desc;
  if (!progress || !progress.chapter) {
    desc = 'Você ainda não começou o modo história.\n\n' +
           'A campanha narrativa fica no site, com escolhas, batalhas com diálogos e skills exclusivas.';
  } else {
    desc = `📖 **Capítulo ${progress.chapter}** · Cena ${progress.scene || 1}\n\n` +
           'Para continuar, abra o site abaixo.';
  }

  const embed = baseEmbed({
    title: '📖 Modo História',
    description: desc,
    color: COLORS.info,
    footer: 'O modo história roda no site, com diálogos e cenas',
  });

  const components = [];
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Abrir história no site')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(`${frontendUrl}/historia`),
    ));
  }
  components.push(navRow('story', userId));
  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handleStory(interaction, parsed) {
  if (parsed.action === 'open' || parsed.action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildStoryPayload(interaction.user);
    await interaction.editReply(payload);
  }
}
