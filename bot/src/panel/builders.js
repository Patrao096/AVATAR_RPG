import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { build as buildId, buildModal } from '../utils/customId.js';

export const COLORS = {
  primary: 0x2dd4bf,
  success: 0x22c55e,
  warning: 0xf59e0b,
  danger:  0xef4444,
  info:    0x38bdf8,
  neutral: 0x71717a,
  premium: 0x9333ea,
  fogo:    0xdc2626,
  agua:    0x0891b2,
  terra:   0xa16207,
  ar:      0x7dd3fc,
};

export const ELEMENT_COLOR = {
  Fogo: COLORS.fogo,
  'Água': COLORS.agua,
  Terra: COLORS.terra,
  Ar: COLORS.ar,
};

const RARITY_META = {
  common:    { label: 'Comum',    color: COLORS.neutral },
  uncommon:  { label: 'Incomum',  color: COLORS.success },
  rare:      { label: 'Raro',     color: COLORS.info },
  epic:      { label: 'Épico',    color: COLORS.premium },
  legendary: { label: 'Lendário', color: COLORS.warning },
};

export function rarityLabel(rarity) {
  return RARITY_META[rarity]?.label || rarity || '—';
}

export function rarityColor(rarity) {
  return RARITY_META[rarity]?.color || COLORS.neutral;
}

export function baseEmbed({ title, description, color = COLORS.primary, footer, thumbnail, fields, image }) {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  if (footer) e.setFooter({ text: footer });
  if (thumbnail) e.setThumbnail(thumbnail);
  if (image) e.setImage(image);
  if (Array.isArray(fields) && fields.length) e.addFields(fields);
  return e;
}

export function backButton(userId, label = 'Voltar') {
  return new ButtonBuilder()
    .setCustomId(buildId('home', 'open', userId))
    .setLabel(label)
    .setEmoji('↩️')
    .setStyle(ButtonStyle.Secondary);
}

export function refreshButton(section, userId, label = 'Atualizar') {
  return new ButtonBuilder()
    .setCustomId(buildId(section, 'refresh', userId))
    .setLabel(label)
    .setEmoji('🔄')
    .setStyle(ButtonStyle.Secondary);
}

export function navRow(section, userId) {
  return new ActionRowBuilder().addComponents(
    backButton(userId),
    refreshButton(section, userId),
  );
}

export function actionButton(section, action, userId, { label, emoji, style = ButtonStyle.Primary, extra = null } = {}) {
  const b = new ButtonBuilder()
    .setCustomId(buildId(section, action, userId, extra))
    .setStyle(style);
  if (label) b.setLabel(label);
  if (emoji) b.setEmoji(emoji);
  return b;
}

export function buttonRow(...buttons) {
  return new ActionRowBuilder().addComponents(...buttons.filter(Boolean));
}

export function selectRow(section, action, userId, { placeholder, options, extra = null, min = 1, max = 1 }) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId(section, action, userId, extra))
    .setPlaceholder(placeholder || 'Escolha uma opção…')
    .setMinValues(min)
    .setMaxValues(max)
    .addOptions(options.slice(0, 25));
  return new ActionRowBuilder().addComponents(select);
}

export function navSelectRow(userId, current) {
  const sections = [
    { value: 'profile',     label: 'Perfil',         emoji: '👤', description: 'Atributos, ELO e progresso' },
    { value: 'inventory',   label: 'Inventário',     emoji: '📦', description: 'Itens, equipar e usar' },
    { value: 'combat',      label: 'Combate',        emoji: '⚔️', description: 'Arena PvE e PvP' },
    { value: 'skills',      label: 'Skills',         emoji: '🎯', description: 'Habilidades e loadout' },
    { value: 'quests',      label: 'Missões',        emoji: '📜', description: 'Tarefas e recompensas' },
    { value: 'shop',        label: 'Loja Yuan',      emoji: '💰', description: 'Loja diária rotativa' },
    { value: 'blackmarket', label: 'Mercado',        emoji: '🛒', description: 'Compra, venda e trocas' },
    { value: 'clan',        label: 'Clã',            emoji: '🏛️', description: 'Clã, eventos e ranking' },
    { value: 'story',       label: 'História',       emoji: '📖', description: 'Campanha e capítulos' },
    { value: 'ranking',     label: 'Ranking',        emoji: '🏆', description: 'Top jogadores' },
    { value: 'premium',     label: 'Planos',         emoji: '💎', description: 'Assinatura e benefícios' },
  ].map(s => ({
    ...s,
    default: s.value === current,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId(buildId('nav', 'go', userId))
    .setPlaceholder('Navegar para…')
    .addOptions(sections);

  return new ActionRowBuilder().addComponents(select);
}

export function textModal({ section, action, userId, title, extra = null, inputs }) {
  const modal = new ModalBuilder()
    .setCustomId(buildModal(section, action, userId, extra))
    .setTitle(title.slice(0, 45));

  for (const input of inputs.slice(0, 5)) {
    const ti = new TextInputBuilder()
      .setCustomId(input.id)
      .setLabel(input.label.slice(0, 45))
      .setStyle(input.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(input.required !== false);
    if (input.placeholder) ti.setPlaceholder(input.placeholder.slice(0, 100));
    if (input.value != null) ti.setValue(String(input.value).slice(0, 4000));
    if (input.minLength != null) ti.setMinLength(input.minLength);
    if (input.maxLength != null) ti.setMaxLength(input.maxLength);
    modal.addComponents(new ActionRowBuilder().addComponents(ti));
  }
  return modal;
}

export function progressBar(current, max, length = 12) {
  if (!max || max <= 0) return '░'.repeat(length);
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export function fmtNumber(n) {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('pt-BR');
}

export function fmtYuan(n) {
  if (typeof n !== 'number') return '—';
  return `${n.toLocaleString('pt-BR')} Yuan`;
}

export function fmtTimeLeft(date) {
  if (!date) return '';
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return 'agora';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function errorReply(text) {
  return {
    content: `❌ ${text}`,
    embeds: [],
    components: [],
    flags: MessageFlags.Ephemeral,
  };
}

export function expiredReply(userId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(buildId('home', 'open', userId))
      .setLabel('Reabrir painel')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary),
  );
  return {
    content: 'Este painel expirou após 15 minutos sem uso. Abra um novo.',
    embeds: [],
    components: [row],
    flags: MessageFlags.Ephemeral,
  };
}
