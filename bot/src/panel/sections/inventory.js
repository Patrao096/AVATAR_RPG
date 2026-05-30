import { MessageFlags, ButtonStyle } from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, selectRow, buttonRow, actionButton,
} from '../builders.js';
import { apiGet, apiPost, getUserJwt } from '../../api.js';
import { cached, invalidate } from '../../cache.js';

const TYPE_LABEL = {
  weapon:     '⚔️ Armas',
  armor:      '🛡️ Armaduras',
  amulet:     '🔮 Amuletos',
  accessory:  '💍 Acessórios',
  consumable: '🧪 Consumíveis',
  material:   '🪨 Materiais',
};

const TAB_GROUPS = {
  equip: ['weapon', 'armor', 'amulet', 'accessory'],
  cons:  ['consumable'],
  mat:   ['material'],
};

const TAB_INFO = {
  equip: { label: 'Equipamentos', emoji: '⚔️', description: 'Armas, armaduras e acessórios' },
  cons:  { label: 'Consumíveis',  emoji: '🧪', description: 'Poções e itens de batalha' },
  mat:   { label: 'Materiais',    emoji: '🪨', description: 'Recursos para crafting' },
};

export async function buildInventoryPayload(discordUser, { tab = 'equip' } = {}) {
  const userId = discordUser.id;
  const items = await cached(`inv:${userId}`, () => apiGet(`/api/bot/inventory/${userId}`));

  const allItems = Array.isArray(items) ? items : (items.items || []);
  const filteredTypes = TAB_GROUPS[tab] || TAB_GROUPS.equip;
  const visible = allItems.filter(i => filteredTypes.includes(i.type));

  let desc;
  if (visible.length === 0) {
    desc = '*Nenhum item nesta aba. Compre na Loja Yuan ou ganhe em batalhas.*';
  } else {
    const byType = {};
    for (const i of visible) {
      (byType[i.type] ||= []).push(i);
    }
    const blocks = [];
    for (const [type, list] of Object.entries(byType)) {
      const lines = list.slice(0, 8).map(i => {
        const equipped = i.equipped ? ' ✅' : '';
        const qty = i.quantity > 1 ? ` ×${i.quantity}` : '';
        return `• **${i.itemName}**${qty}${equipped}`;
      });
      if (list.length > 8) lines.push(`*…e mais ${list.length - 8} itens*`);
      blocks.push(`__${TYPE_LABEL[type] || type}__\n${lines.join('\n')}`);
    }
    desc = blocks.join('\n\n');
  }

  const embed = baseEmbed({
    title: '📦 Inventário',
    description: desc,
    color: COLORS.info,
    footer: `Aba: ${TAB_INFO[tab].label} · ${visible.length} item(ns)`,
  });

  const components = [
    selectRow('inventory', 'tab', userId, {
      placeholder: 'Trocar de aba…',
      options: Object.entries(TAB_INFO).map(([key, info]) => ({
        value: key,
        label: info.label,
        emoji: info.emoji,
        description: info.description,
        default: key === tab,
      })),
    }),
  ];

  if (visible.length > 0 && tab !== 'mat') {
    components.push(selectRow('inventory', 'use', userId, {
      placeholder: tab === 'cons' ? 'Equipar ou guardar consumível…' : 'Equipar ou desequipar item…',
      options: visible.slice(0, 25).map(i => ({
        label: i.itemName.slice(0, 90),
        description: (i.equipped
          ? `Equipado · ${TYPE_LABEL[i.type] || i.type}`
          : `${i.quantity > 1 ? `×${i.quantity} · ` : ''}${TYPE_LABEL[i.type] || i.type}`).slice(0, 95),
        value: `${i.id}:${i.equipped ? 'unequip' : 'equip'}:${i.type}`,
      })),
    }));
  }

  components.push(buttonRow(
    actionButton('shop', 'open', userId, { label: 'Ir à Loja', emoji: '💰', style: ButtonStyle.Secondary }),
    ...navRow('inventory', userId).components,
  ));

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

export async function handleInventory(interaction, parsed) {
  const { action } = parsed;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildInventoryPayload(interaction.user, { tab: 'equip' });
    await interaction.editReply(payload);
    return;
  }

  if (action === 'tab' && interaction.isStringSelectMenu()) {
    const tab = interaction.values[0];
    await interaction.deferUpdate();
    const payload = await buildInventoryPayload(interaction.user, { tab });
    await interaction.editReply(payload);
    return;
  }

  if (action === 'use' && interaction.isStringSelectMenu()) {
    const [itemId, op, type] = interaction.values[0].split(':');
    const isConsumable = type === 'consumable';

    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(interaction.user);
      const endpoint = isConsumable
        ? (op === 'equip'
            ? `/api/inventory/equip-consumable/${itemId}`
            : `/api/inventory/unequip-consumable/${itemId}`)
        : (op === 'equip'
            ? `/api/inventory/equip/${itemId}`
            : `/api/inventory/unequip/${itemId}`);
      await apiPost(endpoint, {}, { jwt });

      invalidate(`inv:${interaction.user.id}`);
      invalidate(`snapshot:${interaction.user.id}`);
      const payload = await buildInventoryPayload(interaction.user, { tab: isConsumable ? 'cons' : 'equip' });
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao alterar item'));
    }
  }
}
