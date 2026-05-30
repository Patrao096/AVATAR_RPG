import { MessageFlags } from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, fmtTimeLeft, progressBar, selectRow,
} from '../builders.js';
import { apiGet, apiPost, getUserJwt } from '../../api.js';
import { cached, invalidate } from '../../cache.js';

export async function buildQuestsPayload(discordUser) {
  const userId = discordUser.id;

  const data = await cached(`quests:${userId}`, async () => {
    const jwt = await getUserJwt(discordUser);
    return apiGet('/api/quest/all', { jwt });
  });

  const quests = data.quests || [];
  const isPremium = data.isPremium;
  const remaining = data.remainingDaily;

  let desc;
  if (quests.length === 0) {
    desc = '*Nenhuma missão ativa. Aceite missões no mural ou complete as diárias automáticas.*';
  } else {
    desc = quests.map(q => {
      const bar = progressBar(q.progress, q.maxProgress, 8);
      const done = q.progress >= q.maxProgress;
      const checkmark = done ? '✅' : '⏳';
      const exp = q.expiresAt ? ` · ⏰ ${fmtTimeLeft(q.expiresAt)}` : '';
      const reward = `💰 ${q.rewardYuan || q.rewardMoney || 0} Yuan` +
        (q.rewardExp ? ` · 📈 ${q.rewardExp} EXP` : '') +
        (q.rewardItem ? ` · 🎁 ${q.rewardItem}` : '');
      return `${checkmark} **${q.title || q.questType}**\n` +
             `   ${bar} \`${q.progress}/${q.maxProgress}\`${exp}\n` +
             `   ${reward}`;
    }).join('\n\n');
  }

  if (!isPremium && remaining !== null && remaining !== undefined) {
    desc += `\n\n📅 Você pode resgatar **${remaining}** missão(ões) hoje.`;
  } else if (isPremium) {
    desc += '\n\n💎 Premium · resgates ilimitados';
  }

  const ready = quests.filter(q => q.progress >= q.maxProgress);

  const embed = baseEmbed({
    title: '📜 Missões',
    description: desc,
    color: COLORS.info,
    footer: `${quests.length} ativa(s) · ${ready.length} pronta(s) para resgatar`,
  });

  const components = [];
  if (ready.length > 0) {
    components.push(selectRow('quests', 'claim', userId, {
      placeholder: 'Resgatar missão concluída…',
      options: ready.slice(0, 25).map(q => ({
        label: (q.title || q.questType).slice(0, 90),
        description: `Resgatar · 💰 ${q.rewardYuan || q.rewardMoney || 0} Yuan`.slice(0, 95),
        value: q.id,
        emoji: '✅',
      })),
    }));
  }

  components.push(navRow('quests', userId));
  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handleQuests(interaction, parsed) {
  const { action } = parsed;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildQuestsPayload(interaction.user);
    await interaction.editReply(payload);
    return;
  }

  if (action === 'claim' && interaction.isStringSelectMenu()) {
    const questId = interaction.values[0];
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(interaction.user);
      const result = await apiPost(`/api/quest/${questId}/complete`, {}, { jwt });
      invalidate(`quests:${interaction.user.id}`);
      invalidate(`snapshot:${interaction.user.id}`);

      const payload = await buildQuestsPayload(interaction.user);
      const reward = result.reward || result;
      payload.content = `✅ Missão concluída! Recebeu ${reward.rewardYuan || reward.money || 0} Yuan` +
        (reward.rewardExp || reward.exp ? ` e ${reward.rewardExp || reward.exp} EXP` : '') + '.';
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao resgatar'));
    }
  }
}
