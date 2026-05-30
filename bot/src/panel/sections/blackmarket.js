import { MessageFlags, ButtonStyle } from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, fmtYuan, selectRow, textModal,
  buttonRow, actionButton,
} from '../builders.js';
import { apiGet, apiPost, getUserJwt } from '../../api.js';
import { cached, invalidate } from '../../cache.js';
import { hasActivePremium } from '../../utils/permissions.js';

const TAB_INFO = {
  buy:  { label: 'Comprar', emoji: '🛒', description: 'Ofertas de outros jogadores' },
  sell: { label: 'Vender',  emoji: '💸', description: 'Anuncie seus itens (Premium)' },
};

function tabSelect(userId, active) {
  return selectRow('blackmarket', 'tab', userId, {
    placeholder: 'Trocar de aba…',
    options: Object.entries(TAB_INFO).map(([key, info]) => ({
      value: key,
      label: info.label,
      emoji: info.emoji,
      description: info.description,
      default: key === active,
    })),
  });
}

export async function buildBlackMarketPayload(discordUser, { tab = 'buy' } = {}) {
  return tab === 'sell' ? buildSellTab(discordUser) : buildBuyTab(discordUser);
}

async function buildBuyTab(discordUser) {
  const userId = discordUser.id;
  const listings = await cached('market:listings', () => apiGet('/api/market'), 60_000);

  let desc;
  if (listings.length === 0) {
    desc = '*Nada à venda agora. Volte mais tarde.*';
  } else {
    desc = listings.slice(0, 12).map(l => {
      const seller = l.seller?.username || 'Vendedor';
      return `**${l.itemName}** ×${l.quantity} · ${fmtYuan(l.priceMoney)}\n   por ${seller}`;
    }).join('\n');
    if (listings.length > 12) desc += `\n\n*…e mais ${listings.length - 12} ofertas*`;
  }

  const embed = baseEmbed({
    title: '🛒 Mercado · Comprar',
    description: desc,
    color: COLORS.warning,
    footer: `${listings.length} ofertas ativas`,
  });

  const components = [tabSelect(userId, 'buy')];

  if (listings.length > 0) {
    components.push(selectRow('blackmarket', 'buy_select', userId, {
      placeholder: 'Escolher um item para comprar…',
      options: listings.slice(0, 25).map(l => ({
        label: `${l.itemName} ×${l.quantity}`.slice(0, 90),
        description: `${fmtYuan(l.priceMoney)} · ${l.seller?.username || 'Vendedor'}`.slice(0, 95),
        value: l.id,
      })),
    }));
  }

  components.push(navRow('blackmarket', userId));
  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

async function buildSellTab(discordUser) {
  const userId = discordUser.id;
  const isPremium = await hasActivePremium(userId);

  if (!isPremium) {
    return {
      embeds: [baseEmbed({
        title: '💸 Mercado · Vender',
        description:
          '🔒 **Vender no Mercado é exclusivo Premium.**\n\n' +
          'Você ainda pode comprar livremente. Para anunciar seus itens, faça upgrade em **💎 Planos**.',
        color: COLORS.premium,
      })],
      components: [
        tabSelect(userId, 'sell'),
        buttonRow(
          actionButton('premium', 'open', userId, { label: 'Ver planos', emoji: '💎', style: ButtonStyle.Primary }),
          ...navRow('blackmarket', userId).components,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    };
  }

  const inv = await cached(`inv:${userId}`, () => apiGet(`/api/bot/inventory/${userId}`));
  const sellable = (Array.isArray(inv) ? inv : []).filter(i => !i.equipped && i.type !== 'material');

  const desc = sellable.length === 0
    ? '*Você não tem itens vendáveis. Itens equipados e materiais não podem ser vendidos.*'
    : `Você tem **${sellable.length}** item(ns) para vender. Escolha um e informe o preço.`;

  const embed = baseEmbed({
    title: '💸 Mercado · Vender',
    description: desc,
    color: COLORS.warning,
    footer: '💎 Premium',
  });

  const components = [tabSelect(userId, 'sell')];

  if (sellable.length > 0) {
    components.push(selectRow('blackmarket', 'sell_pick', userId, {
      placeholder: 'Escolher o item para vender…',
      options: sellable.slice(0, 25).map(i => ({
        label: `${i.itemName}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`.slice(0, 90),
        description: String(i.type).slice(0, 95),
        value: i.itemName,
      })),
    }));
  }

  components.push(navRow('blackmarket', userId));
  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handleBlackMarket(interaction, parsed) {
  const { action, userId, extra } = parsed;
  const user = interaction.user;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    invalidate('market:listings');
    const payload = await buildBlackMarketPayload(user, { tab: 'buy' });
    await interaction.editReply(payload);
    return;
  }

  if (action === 'tab' && interaction.isStringSelectMenu()) {
    const tab = interaction.values[0];
    await interaction.deferUpdate();
    const payload = await buildBlackMarketPayload(user, { tab });
    await interaction.editReply(payload);
    return;
  }

  if (action === 'buy_select' && interaction.isStringSelectMenu()) {
    const listingId = interaction.values[0];
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const result = await apiPost('/api/market/buy', { listingId }, { jwt });
      invalidate('market:listings');
      invalidate(`inv:${userId}`);
      invalidate(`snapshot:${userId}`);
      const payload = await buildBuyTab(user);
      payload.content = `✅ ${result.message || 'Compra concluída!'}`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro na compra'));
    }
    return;
  }

  if (action === 'sell_pick' && interaction.isStringSelectMenu()) {
    const itemName = interaction.values[0];
    let priceHint = '';
    try {
      const jwt = await getUserJwt(user);
      const info = await apiGet(`/api/market/item-info/${encodeURIComponent(itemName)}`, { jwt });
      if (info && !info.unknown) priceHint = `${info.minPrice}–${info.maxPrice}`;
    } catch { /* segue sem hint */ }

    await interaction.showModal(textModal({
      section: 'blackmarket',
      action: 'sell_submit',
      userId,
      title: `Vender ${itemName.slice(0, 30)}`,
      extra: encodeURIComponent(itemName),
      inputs: [
        {
          id: 'price',
          label: `Preço em Yuan${priceHint ? ` (${priceHint})` : ''}`,
          placeholder: priceHint || 'Ex: 1500',
          maxLength: 8,
        },
        {
          id: 'qty',
          label: 'Quantidade',
          placeholder: '1',
          value: '1',
          required: false,
          maxLength: 3,
        },
      ],
    }));
    return;
  }

  if (action === 'sell_submit' && interaction.isModalSubmit()) {
    const itemName = decodeURIComponent(extra || '');
    const price = parseInt(interaction.fields.getTextInputValue('price').trim(), 10);
    const qtyRaw = parseInt((interaction.fields.getTextInputValue('qty') || '1').trim(), 10);
    const quantity = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.min(qtyRaw, 99) : 1;

    if (!Number.isFinite(price) || price <= 0) {
      await interaction.reply(errorReply('Preço inválido.'));
      return;
    }

    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      await apiPost('/api/market/sell', { itemName, quantity, priceMoney: price }, { jwt });
      invalidate('market:listings');
      invalidate(`inv:${userId}`);
      const payload = await buildSellTab(user);
      payload.content = `✅ ${itemName} ×${quantity} anunciado por ${fmtYuan(price)}.`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao anunciar'));
    }
  }
}
