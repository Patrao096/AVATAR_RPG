import { MessageFlags, ButtonStyle } from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, selectRow, buttonRow, actionButton,
} from '../builders.js';
import { ELEMENT_ICON } from '../../config.js';
import { apiGet, apiPost, getUserJwt } from '../../api.js';
import { cached, invalidate } from '../../cache.js';

const SOURCE_LABEL = {
  elemental_base: 'Base do elemento',
  elemental:      'Elemental',
  story:          'História',
  unlocked:       'Comprada',
};

export async function buildSkillsPayload(discordUser) {
  const userId = discordUser.id;

  const data = await cached(`skills:${userId}`, async () => {
    const jwt = await getUserJwt(discordUser);
    return apiGet('/api/loadout', { jwt });
  });

  const { available, slotsUsed, maxSlots, isPremium } = data;

  let desc;
  if (!available || available.length === 0) {
    desc = '*Nenhuma skill disponível. Avance na história ou compre na Loja Yuan.*';
  } else {
    const lines = available.slice(0, 12).map(s => {
      const icon = ELEMENT_ICON[s.element] || '⚔️';
      const eqMark = s.equipped ? '✅' : '⚪';
      const cd = s.baseCooldownTurns > 0 ? ` · CD ${s.baseCooldownTurns}T` : '';
      const chi = s.chiCost > 0 ? ` · ${s.chiCost} Chi` : ' · grátis';
      const tier = s.tier ? ` T${s.tier}` : '';
      return `${eqMark} ${icon} **${s.name}**${tier} (${SOURCE_LABEL[s.source] || s.source})\n` +
             `   ${s.baseDamageMin}-${s.baseDamageMax} dmg${chi}${cd}`;
    });
    desc = lines.join('\n');
    if (available.length > 12) desc += `\n\n*…e mais ${available.length - 12} skills*`;
  }

  const embed = baseEmbed({
    title: '🎯 Skills',
    description: desc,
    color: COLORS.primary,
    footer: `Slots: ${slotsUsed}/${maxSlots}` + (isPremium ? ' · Premium' : ''),
  });

  const components = [];

  if (available && available.length > 0) {
    components.push(selectRow('skills', 'toggle', userId, {
      placeholder: 'Equipar ou desequipar skill…',
      options: available.slice(0, 25).map(s => ({
        label: s.name.slice(0, 90),
        description: `${s.equipped ? 'Equipada' : 'Disponível'} · ${s.baseDamageMin}-${s.baseDamageMax} dmg`.slice(0, 95),
        value: `${s.id}:${s.equipped ? 'unequip' : 'equip'}`,
        emoji: s.equipped ? '✅' : '🟢',
      })),
    }));
  }

  components.push(buttonRow(
    actionButton('combat', 'open', userId, { label: 'Combate', emoji: '⚔️', style: ButtonStyle.Secondary }),
    ...navRow('skills', userId).components,
  ));

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handleSkills(interaction, parsed) {
  const { action } = parsed;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildSkillsPayload(interaction.user);
    await interaction.editReply(payload);
    return;
  }

  if (action === 'toggle' && interaction.isStringSelectMenu()) {
    const [skillId, op] = interaction.values[0].split(':');

    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(interaction.user);
      const endpoint = op === 'equip' ? '/api/loadout/equip-skill' : '/api/loadout/unequip-skill';
      await apiPost(endpoint, { skillId }, { jwt });
      invalidate(`skills:${interaction.user.id}`);
      const payload = await buildSkillsPayload(interaction.user);
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao alterar skill'));
    }
  }
}
