import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} from 'discord.js';
import { baseEmbed, COLORS, navRow, fmtTimeLeft } from '../builders.js';
import { apiGet } from '../../api.js';
import { cached } from '../../cache.js';

const PLAN_NAME = {
  premium_user: 'Premium Usuário',
  premium_server: 'Premium Servidor',
};

export async function buildPremiumPayload(discordUser) {
  const userId = discordUser.id;

  const [plans, snapshot] = await Promise.all([
    cached('plans:list', () => apiGet('/api/subscription/plans'), 5 * 60_000),
    cached(`snapshot:${userId}:assinatura`, () =>
      apiGet(`/api/bot/snapshot/${userId}?fields=assinatura`)),
  ]);

  const sub = snapshot.assinatura;
  const isActive = sub && sub.status === 'active' &&
    (!sub.expiresAt || new Date(sub.expiresAt) > new Date());

  let header;
  if (isActive) {
    const planName = PLAN_NAME[sub.plan] || sub.plan;
    const exp = sub.expiresAt ? `\n⏰ Renova em ${fmtTimeLeft(sub.expiresAt)}` : '';
    header = `💎 **Plano ativo:** ${planName}${exp}\n\n`;
  } else {
    header = '🆓 Você está no plano **Free**.\n\n';
  }

  const paidPlans = (plans || []).filter(p => p.priceCents > 0);

  let desc = header;
  if (paidPlans.length === 0) {
    desc += '*Nenhum plano disponível no momento.*';
  } else {
    desc += paidPlans.map(p => {
      const features = (p.benefits || p.features || []).slice(0, 5).map(f => `   • ${f}`).join('\n');
      return `**${p.name}** — ${p.priceDisplay}\n${features}`;
    }).join('\n\n');
  }

  desc += '\n\n*Pagamento via Mercado Pago — finalize pelo site.*';

  const embed = baseEmbed({
    title: '💎 Planos e Premium',
    description: desc,
    color: COLORS.premium,
  });

  const components = [];
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Ver planos no site')
        .setEmoji('🌐')
        .setStyle(ButtonStyle.Link)
        .setURL(`${frontendUrl}/plans`),
    ));
  }
  components.push(navRow('premium', userId));
  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handlePremium(interaction, parsed) {
  if (parsed.action === 'open' || parsed.action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildPremiumPayload(interaction.user);
    await interaction.editReply(payload);
  }
}
