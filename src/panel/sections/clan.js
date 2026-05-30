import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, fmtYuan, fmtTimeLeft,
  selectRow, textModal, buttonRow, actionButton,
} from '../builders.js';
import { build as buildId } from '../../utils/customId.js';
import { ELEMENT_ICON } from '../../config.js';
import { apiGet, apiPost, getUserJwt } from '../../api.js';
import { cached, invalidate } from '../../cache.js';

const ROLE_LABEL = {
  leader: '👑 Líder', officer: '⭐ Oficial', member: 'Membro',
};

const ELEMENT_MAP = { fogo: 'Fogo', agua: 'Água', 'água': 'Água', terra: 'Terra', ar: 'Ar' };

export async function buildClanPayload(discordUser) {
  const userId = discordUser.id;
  const snapshot = await cached(`snapshot:${userId}:cla`, () =>
    apiGet(`/api/bot/snapshot/${userId}?fields=cla`));
  const cla = snapshot.cla;
  return cla ? buildMyClanView(discordUser, cla) : buildJoinView(discordUser);
}

async function buildJoinView(discordUser) {
  const userId = discordUser.id;
  const list = await cached('clans:list', () => apiGet('/api/clan'), 60_000);
  const top = list.slice(0, 10);

  let desc = 'Você ainda não tem clã. Entre em um público abaixo ou crie o seu.';
  if (top.length > 0) {
    desc += '\n\n__Clãs públicos:__\n';
    desc += top.map(c => {
      const elemIcon = ELEMENT_ICON[c.element] || '⚔️';
      const champion = c.championBadges > 0 ? ` 🏆×${c.championBadges}` : '';
      return `${elemIcon} **${c.name}**${champion} · Nível ${c.level} · ${c.memberCount}/${c.maxMembers} membros`;
    }).join('\n');
  } else {
    desc += '\n\n*Nenhum clã público disponível agora.*';
  }

  const embed = baseEmbed({ title: '🏛️ Clãs', description: desc, color: COLORS.info });

  const components = [];
  const joinable = top.filter(c => c.visibility === 'public' && c.memberCount < c.maxMembers);
  if (joinable.length > 0) {
    components.push(selectRow('clan', 'join', userId, {
      placeholder: 'Entrar em um clã público…',
      options: joinable.slice(0, 25).map(c => ({
        label: c.name.slice(0, 90),
        description: `${c.element} · Nível ${c.level} · ${c.memberCount}/${c.maxMembers}`.slice(0, 95),
        value: c.id,
      })),
    }));
  }

  components.push(buttonRow(
    actionButton('clan', 'create_modal', userId, { label: 'Criar clã', emoji: '➕', style: ButtonStyle.Primary }),
    actionButton('clan', 'event', userId, { label: 'Evento', emoji: '⚔️', style: ButtonStyle.Secondary }),
    ...navRow('clan', userId).components,
  ));

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

async function buildMyClanView(discordUser, cla) {
  const userId = discordUser.id;
  const elemIcon = ELEMENT_ICON[cla.element] || '⚔️';
  const championLine = cla.championBadges > 0 ? `\n🏆 **${cla.championBadges}** título(s) de campeão` : '';
  const buffLine = cla.activeBuff
    ? `\n✨ +${Math.round((cla.activeBuff.value || 0) * 100)}% EXP/Yuan (${fmtTimeLeft(cla.activeBuff.expiresAt)})`
    : '';

  const embed = baseEmbed({
    title: `${elemIcon} ${cla.name}`,
    description:
      `${ROLE_LABEL[cla.role] || 'Membro'} · **${cla.element}**\n` +
      `📊 Nível ${cla.level} · 💰 Baú: ${fmtYuan(cla.treasury)}` +
      championLine + buffLine,
    color: COLORS.success,
    footer: 'Moderação (expulsar, promover) fica no site',
  });

  const components = [
    selectRow('clan', 'menu', userId, {
      placeholder: 'Ação do clã…',
      options: [
        { value: 'deposit', label: 'Depositar Yuan', emoji: '💰', description: 'Contribuir para o baú' },
        { value: 'message', label: 'Mensagem no chat', emoji: '💬', description: 'Falar com o clã' },
        { value: 'event',   label: 'Evento de batalha', emoji: '⚔️', description: 'Ver leaderboard ao vivo' },
        { value: 'leave',   label: 'Sair do clã', emoji: '🚪', description: 'Ação permanente' },
      ],
    }),
    navRow('clan', userId),
  ];

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

async function buildEventView(discordUser, myClanId = null) {
  const userId = discordUser.id;
  const data = await cached('clan_event', () => apiGet('/api/clan/war/active'), 30_000);

  if (!data.active) {
    return {
      embeds: [baseEmbed({
        title: '⚔️ Batalha de Clãs',
        description: '*Sem evento ativo no momento. Quando o admin lançar, aparece aqui.*',
        color: COLORS.neutral,
      })],
      components: [
        buttonRow(actionButton('clan', 'open', userId, { label: 'Voltar ao clã', emoji: '🏛️', style: ButtonStyle.Secondary })),
        navRow('clan', userId),
      ],
      flags: MessageFlags.Ephemeral,
    };
  }

  const event = data.event;
  const lb = data.leaderboard || [];
  const myRank = myClanId ? lb.findIndex(c => c.id === myClanId) : -1;

  let desc = `**${event.name}** · ● AO VIVO\n`;
  desc += `⏳ termina em ${fmtTimeLeft(event.endsAt)}\n\n`;
  desc += '🥇 +10 pts vitória · 🥈 +3 pts derrota\n🏆 50k Yuan + buff +5% EXP/Yuan (7d)\n\n';
  desc += '__Leaderboard__\n';

  if (lb.length === 0) {
    desc += '*Nenhuma batalha entre clãs ainda.*';
  } else {
    desc += lb.slice(0, 10).map((c, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      const isMe = c.id === myClanId ? ' ⬅️ você' : '';
      return `${medal} **${c.name}** · ${c.points} pts (${c.wins || 0}V ${c.losses || 0}D)${isMe}`;
    }).join('\n');
  }

  if (myRank >= 0 && lb.length > 3) {
    desc += `\n\nVocê está em **#${myRank + 1}** de ${lb.length}`;
  }

  return {
    embeds: [baseEmbed({ title: '⚔️ Batalha de Clãs', description: desc, color: COLORS.warning })],
    components: [
      buttonRow(
        new ButtonBuilder()
          .setCustomId(buildId('clan', 'event_refresh', userId))
          .setLabel('Atualizar')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary),
        actionButton('clan', 'open', userId, { label: 'Voltar ao clã', emoji: '🏛️', style: ButtonStyle.Secondary }),
      ),
      navRow('clan', userId),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

function leaveConfirmView(userId) {
  return {
    embeds: [baseEmbed({
      title: '🚪 Sair do clã',
      description:
        'Quer mesmo sair? A ação é **permanente** — você perde cargo, contribuições e buff.\n\n' +
        'Líderes precisam transferir a liderança antes de sair (pelo site).',
      color: COLORS.danger,
    })],
    components: [
      buttonRow(
        actionButton('clan', 'leave_yes', userId, { label: 'Sim, sair', emoji: '🚪', style: ButtonStyle.Danger }),
        actionButton('clan', 'open', userId, { label: 'Cancelar', style: ButtonStyle.Secondary }),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

function createModal(userId) {
  return textModal({
    section: 'clan', action: 'create_submit', userId, title: 'Criar clã',
    inputs: [
      { id: 'name', label: 'Nome do clã (3-30 caracteres)', minLength: 3, maxLength: 30 },
      { id: 'element', label: 'Elemento (Fogo, Água, Terra, Ar)', minLength: 2, maxLength: 10 },
      { id: 'description', label: 'Descrição (opcional)', paragraph: true, required: false, maxLength: 300 },
    ],
  });
}

function depositModal(userId) {
  return textModal({
    section: 'clan', action: 'deposit_submit', userId, title: 'Depositar Yuan no baú',
    inputs: [{ id: 'amount', label: 'Quanto Yuan depositar?', placeholder: 'Ex: 1000', maxLength: 8 }],
  });
}

function messageModal(userId) {
  return textModal({
    section: 'clan', action: 'message_submit', userId, title: 'Mensagem no chat do clã',
    inputs: [{ id: 'content', label: 'Mensagem (até 500 caracteres)', paragraph: true, maxLength: 500 }],
  });
}

export async function handleClan(interaction, parsed) {
  const { action, userId } = parsed;
  const user = interaction.user;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    invalidate(`snapshot:${userId}`);
    invalidate(`snapshot:${userId}:cla`);
    const payload = await buildClanPayload(user);
    await interaction.editReply(payload);
    return;
  }

  if (action === 'menu' && interaction.isStringSelectMenu()) {
    const choice = interaction.values[0];
    if (choice === 'deposit') return interaction.showModal(depositModal(userId));
    if (choice === 'message') return interaction.showModal(messageModal(userId));
    if (choice === 'event') {
      await interaction.deferUpdate();
      const snapshot = await cached(`snapshot:${userId}:cla`, () => apiGet(`/api/bot/snapshot/${userId}?fields=cla`));
      const payload = await buildEventView(user, snapshot.cla?.id || null);
      await interaction.editReply(payload);
      return;
    }
    if (choice === 'leave') {
      await interaction.deferUpdate();
      await interaction.editReply(leaveConfirmView(userId));
      return;
    }
    return;
  }

  if (action === 'event' || action === 'event_refresh') {
    await interaction.deferUpdate();
    if (action === 'event_refresh') invalidate('clan_event');
    const snapshot = await cached(`snapshot:${userId}:cla`, () => apiGet(`/api/bot/snapshot/${userId}?fields=cla`));
    const payload = await buildEventView(user, snapshot.cla?.id || null);
    await interaction.editReply(payload);
    return;
  }

  if (action === 'join' && interaction.isStringSelectMenu()) {
    const clanId = interaction.values[0];
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const result = await apiPost('/api/clan/join', { clanId }, { jwt });
      invalidate(`snapshot:${userId}`);
      invalidate(`snapshot:${userId}:cla`);
      invalidate('clans:list');
      const payload = await buildClanPayload(user);
      payload.content = `✅ ${result.message || 'Bem-vindo ao clã!'}`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao entrar'));
    }
    return;
  }

  if (action === 'create_modal') {
    return interaction.showModal(createModal(userId));
  }

  if (action === 'create_submit' && interaction.isModalSubmit()) {
    const name = interaction.fields.getTextInputValue('name').trim();
    const elementRaw = interaction.fields.getTextInputValue('element').trim();
    const description = interaction.fields.getTextInputValue('description').trim() || undefined;
    const element = ELEMENT_MAP[elementRaw.toLowerCase()] || elementRaw;

    if (!['Fogo', 'Água', 'Terra', 'Ar'].includes(element)) {
      await interaction.reply(errorReply('Elemento deve ser Fogo, Água, Terra ou Ar.'));
      return;
    }

    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const result = await apiPost('/api/clan/create',
        { name, element, description, visibility: 'public' }, { jwt });
      invalidate(`snapshot:${userId}`);
      invalidate(`snapshot:${userId}:cla`);
      invalidate('clans:list');
      const payload = await buildClanPayload(user);
      payload.content = `✅ ${result.message || 'Clã criado!'}`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao criar clã'));
    }
    return;
  }

  if (action === 'deposit_submit' && interaction.isModalSubmit()) {
    const amount = parseInt(interaction.fields.getTextInputValue('amount').trim(), 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      await interaction.reply(errorReply('Valor inválido. Use apenas números positivos.'));
      return;
    }
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      await apiPost('/api/clan/treasury/deposit', { amount }, { jwt });
      invalidate(`snapshot:${userId}`);
      invalidate(`snapshot:${userId}:cla`);
      const payload = await buildClanPayload(user);
      payload.content = `✅ Depositou ${fmtYuan(amount)} no baú.`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao depositar'));
    }
    return;
  }

  if (action === 'message_submit' && interaction.isModalSubmit()) {
    const content = interaction.fields.getTextInputValue('content').trim();
    if (!content) {
      await interaction.reply(errorReply('Mensagem vazia.'));
      return;
    }
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      await apiPost('/api/clan/messages', { content }, { jwt });
      const payload = await buildClanPayload(user);
      payload.content = '✅ Mensagem enviada no chat do clã.';
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao enviar'));
    }
    return;
  }

  if (action === 'leave_yes') {
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const result = await apiPost('/api/clan/leave', {}, { jwt });
      invalidate(`snapshot:${userId}`);
      invalidate(`snapshot:${userId}:cla`);
      invalidate('clans:list');
      const payload = await buildClanPayload(user);
      payload.content = `✅ ${result.message || 'Você saiu do clã.'}`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao sair'));
    }
  }
}
