import { MessageFlags, ButtonStyle } from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, selectRow, textModal,
  fmtYuan, fmtTimeLeft, rarityLabel, buttonRow, actionButton,
} from '../builders.js';
import { ELEMENT_ICON } from '../../config.js';
import { apiGet, apiPost, getUserJwt } from '../../api.js';
import { cached, invalidate } from '../../cache.js';

const TYPE_LABEL = {
  skill: '🎯 Skill',
  item: '⚔️ Item',
  consumable: '🧪 Poção',
};

export async function buildShopPayload(discordUser) {
  const userId = discordUser.id;

  const data = await cached(`shop:${userId}`, async () => {
    const jwt = await getUserJwt(discordUser);
    return apiGet('/api/yuanstore/today', { jwt });
  });

  const products = data.products || [];
  const myYuan = data.characterMoney ?? 0;

  let desc = `💰 Saldo: **${fmtYuan(myYuan)}**\n\n`;
  if (products.length === 0) {
    desc += '*Loja vazia agora. Volte mais tarde.*';
  } else {
    desc += products.map((p, i) => {
      const elemIcon = p.element && p.element !== 'Neutro' ? (ELEMENT_ICON[p.element] || '') : '';
      const typeIcon = p.icon || TYPE_LABEL[p.type]?.split(' ')[0] || '📦';
      const price = p.priceYuan ?? p.price ?? 0;
      const canAfford = myYuan >= price;
      const priceStr = canAfford
        ? `**${price.toLocaleString('pt-BR')}** Yuan`
        : `~~${price.toLocaleString('pt-BR')} Yuan~~ *(insuficiente)*`;
      const owned = p.alreadyOwned ? ' ✅ *já possui*' : '';
      return `${i + 1}. ${typeIcon} **${p.name}** ${elemIcon}\n` +
             `   ${rarityLabel(p.rarity)} · ${TYPE_LABEL[p.type] || p.type}\n` +
             `   💰 ${priceStr}${owned}`;
    }).join('\n\n');
  }

  const embed = baseEmbed({
    title: '💰 Loja Yuan · Hoje',
    description: desc,
    color: COLORS.warning,
    footer: data.nextRefreshAt
      ? `Renova em ${fmtTimeLeft(data.nextRefreshAt)}`
      : 'Renova diariamente',
  });

  const components = [];

  if (products.length > 0) {
    components.push(selectRow('shop', 'pick', userId, {
      placeholder: 'Escolher um produto para comprar…',
      options: products.map(p => {
        const price = p.priceYuan ?? p.price ?? 0;
        return {
          label: p.name.slice(0, 90),
          description: `${price.toLocaleString('pt-BR')} Yuan · ${rarityLabel(p.rarity)}`.slice(0, 95),
          value: `${p.dailyId}:${p.type}`,
        };
      }),
    }));
  }

  components.push(buttonRow(
    actionButton('inventory', 'open', userId, { label: 'Inventário', emoji: '📦', style: ButtonStyle.Secondary }),
    ...navRow('shop', userId).components,
  ));

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handleShop(interaction, parsed) {
  const { action } = parsed;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildShopPayload(interaction.user);
    await interaction.editReply(payload);
    return;
  }

  if (action === 'pick' && interaction.isStringSelectMenu()) {
    const [dailyId, type] = interaction.values[0].split(':');

    const data = await cached(`shop:${interaction.user.id}`, async () => {
      const jwt = await getUserJwt(interaction.user);
      return apiGet('/api/yuanstore/today', { jwt });
    });
    const product = (data.products || []).find(p => String(p.dailyId) === String(dailyId));

    if (type === 'skill') {
      await interaction.deferUpdate();
      await doBuy(interaction, { dailyId, type, quantity: 1 });
      return;
    }

    await interaction.showModal(textModal({
      section: 'shop',
      action: 'buyqty',
      userId: interaction.user.id,
      title: `Comprar: ${(product?.name || 'item').slice(0, 30)}`,
      extra: `${dailyId}:${type}`,
      inputs: [{
        id: 'qty',
        label: 'Quantidade',
        placeholder: '1',
        value: '1',
        minLength: 1,
        maxLength: 3,
      }],
    }));
    return;
  }

  if (action === 'buyqty' && interaction.isModalSubmit()) {
    const [dailyId, type] = (parsed.extra || '').split(':');
    const raw = parseInt(interaction.fields.getTextInputValue('qty'), 10);
    const quantity = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 99) : 1;

    await interaction.deferUpdate();
    await doBuy(interaction, { dailyId, type, quantity });
  }
}

async function doBuy(interaction, { dailyId, type, quantity }) {
  try {
    const jwt = await getUserJwt(interaction.user);
    const result = await apiPost('/api/yuanstore/buy-daily', { dailyId, type, quantity }, { jwt });

    invalidate(`shop:${interaction.user.id}`);
    invalidate(`inv:${interaction.user.id}`);
    invalidate(`skills:${interaction.user.id}`);
    invalidate(`snapshot:${interaction.user.id}`);

    const payload = await buildShopPayload(interaction.user);
    payload.content = `✅ ${result.message || 'Compra realizada!'}`;
    await interaction.editReply(payload);
  } catch (err) {
    await interaction.editReply(errorReply(err.message || 'Erro na compra'));
  }
}
