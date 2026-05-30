import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, MessageFlags,
} from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, fmtYuan, fmtTimeLeft,
  selectRow, textModal, buttonRow, actionButton,
} from '../builders.js';
import { build as buildId } from '../../utils/customId.js';
import { apiGet, apiPost, apiPatch, getUserJwt } from '../../api.js';
import { isAdminDiscord } from '../../utils/permissions.js';

async function ensureAdmin(interaction) {
  if (!isAdminDiscord(interaction.user.id)) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '🚫 Apenas administradores podem usar esta seção.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply(errorReply('Apenas administradores'));
    }
    return false;
  }
  return true;
}

export async function buildAdminPayload(discordUser) {
  const userId = discordUser.id;

  let stats = null;
  let activeWar = null;
  try {
    const jwt = await getUserJwt(discordUser);
    stats = await apiGet('/api/admin/stats', { jwt });
  } catch { /* opcional */ }
  try {
    activeWar = await apiGet('/api/clan/war/active');
  } catch { /* opcional */ }

  let desc = '⚙️ **Painel Admin**\n\n';
  if (stats) {
    desc += `👥 Usuários: **${stats.users || 0}**\n`;
    desc += `⚔️ Batalhas: **${stats.battles || 0}**\n`;
    desc += `🏛️ Clãs: **${stats.clans || 0}**\n`;
    desc += `💎 Assinaturas ativas: **${stats.activeSubs || 0}**\n`;
    if (stats.storeItems != null) desc += `🏬 Itens na loja: **${stats.storeItems}**\n`;
    desc += '\n';
  }
  if (activeWar?.active) {
    desc += `⚔️ **Evento ativo:** ${activeWar.event.name}\n` +
            `⏳ Termina em ${fmtTimeLeft(activeWar.event.endsAt)}\n` +
            `🏛️ Clãs participando: ${activeWar.leaderboard?.length || 0}`;
  } else {
    desc += '*Sem evento de Batalha de Clãs ativo.*';
  }

  const embed = baseEmbed({
    title: '⚙️ Admin',
    description: desc,
    color: COLORS.danger,
    footer: 'Operações destrutivas ficam no site',
  });

  const options = [
    { value: 'give_yuan', label: 'Dar Yuan', emoji: '💰', description: 'Adicionar Yuan a um jogador' },
    { value: 'view_player', label: 'Ver jogador', emoji: '🔍', description: 'Inspecionar stats e conta' },
  ];
  if (activeWar?.active) {
    options.push({ value: 'event_finalize', label: 'Encerrar evento', emoji: '🏁', description: 'Finalizar e premiar' });
  } else {
    options.push({ value: 'event_create', label: 'Criar evento de clã', emoji: '⚔️', description: 'Lançar Batalha de Clãs' });
  }

  return {
    embeds: [embed],
    components: [
      selectRow('admin', 'menu', userId, { placeholder: 'Ação administrativa…', options }),
      navRow('admin', userId),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

function userPickPayload(userId, action, { title, description, color }) {
  return {
    embeds: [baseEmbed({ title, description, color })],
    components: [
      new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(buildId('admin', action, userId))
          .setPlaceholder('Selecionar o jogador…')
          .setMinValues(1).setMaxValues(1),
      ),
      navRow('admin', userId),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

export async function handleAdmin(interaction, parsed) {
  const { action, userId, extra } = parsed;
  const user = interaction.user;

  if (!await ensureAdmin(interaction)) return;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    await interaction.editReply(await buildAdminPayload(user));
    return;
  }

  if (action === 'menu' && interaction.isStringSelectMenu()) {
    const choice = interaction.values[0];
    await interaction.deferUpdate();
    if (choice === 'give_yuan') {
      await interaction.editReply(userPickPayload(userId, 'give_yuan_target', {
        title: '💰 Dar Yuan',
        description: 'Selecione o jogador e depois informe o valor.',
        color: COLORS.warning,
      }));
    } else if (choice === 'view_player') {
      await interaction.editReply(userPickPayload(userId, 'view_player_show', {
        title: '🔍 Ver jogador',
        description: 'Selecione o jogador para ver stats e conta.',
        color: COLORS.info,
      }));
    } else if (choice === 'event_create') {
      await interaction.editReply({
        embeds: [baseEmbed({
          title: '⚔️ Criar evento de clã',
          description: 'Abra o formulário para definir nome e duração.',
          color: COLORS.warning,
        })],
        components: [
          buttonRow(actionButton('admin', 'event_create_modal', userId, { label: 'Abrir formulário', emoji: '📝', style: ButtonStyle.Primary })),
          navRow('admin', userId),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } else if (choice === 'event_finalize') {
      await interaction.editReply({
        embeds: [baseEmbed({
          title: '🏁 Encerrar evento agora?',
          description:
            'Isto vai:\n\n' +
            '• Distribuir 50.000 Yuan no baú do clã líder\n' +
            '• Dar badge 🏆 ao clã vencedor\n' +
            '• Aplicar buff +5% EXP/Yuan por 7 dias aos membros\n\n' +
            'A ação não pode ser desfeita.',
          color: COLORS.danger,
        })],
        components: [
          buttonRow(
            actionButton('admin', 'event_finalize_yes', userId, { label: 'Sim, encerrar', emoji: '🏁', style: ButtonStyle.Danger }),
            actionButton('admin', 'open', userId, { label: 'Cancelar', style: ButtonStyle.Secondary }),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  if (action === 'give_yuan_target' && interaction.isUserSelectMenu()) {
    const targetId = interaction.values[0];
    return interaction.showModal(textModal({
      section: 'admin', action: 'give_yuan_submit', userId, title: 'Dar Yuan', extra: targetId,
      inputs: [{ id: 'amount', label: 'Quanto Yuan dar?', placeholder: 'Ex: 5000', maxLength: 8 }],
    }));
  }

  if (action === 'give_yuan_submit' && interaction.isModalSubmit()) {
    const targetDiscordId = extra;
    const amount = parseInt(interaction.fields.getTextInputValue('amount').trim(), 10);
    if (!Number.isFinite(amount) || amount === 0) {
      await interaction.reply(errorReply('Valor inválido.'));
      return;
    }
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const target = await apiGet(`/api/bot/character/${targetDiscordId}`);
      if (!target?.userId) return interaction.editReply(errorReply('Jogador sem personagem.'));
      await apiPost('/api/admin/give-yuan', { userId: target.userId, amount }, { jwt });
      const payload = await buildAdminPayload(user);
      payload.content = `✅ Adicionou ${fmtYuan(amount)} para ${target.discordUsername || targetDiscordId}.`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao dar Yuan'));
    }
    return;
  }

  if (action === 'view_player_show' && interaction.isUserSelectMenu()) {
    const targetId = interaction.values[0];
    await interaction.deferUpdate();
    try {
      const data = await apiGet(`/api/bot/snapshot/${targetId}?fields=perfil,saldo,cla,assinatura`);
      const p = data.perfil;
      const desc = !p
        ? '*Este jogador ainda não tem personagem.*'
        : `**${p.name}** · ${p.element} · Nível ${p.level}\n` +
          `🏆 ${p.elo} ELO (pico ${p.peakElo}) · ${p.rankTier}\n` +
          `⚔️ ${p.wins}V/${p.losses}D · ${(data.saldo?.yuan || 0).toLocaleString('pt-BR')} Yuan\n` +
          `❤️ ${data.saldo?.hp || 0}/${data.saldo?.maxHp || 0}\n` +
          (data.cla ? `🏛️ Clã: ${data.cla.name} (${data.cla.role})\n` : '') +
          (data.assinatura?.status === 'active' ? '💎 Premium ativo' : '');
      await interaction.editReply({
        embeds: [baseEmbed({ title: '🔍 Info do jogador', description: desc, color: COLORS.info })],
        components: [
          buttonRow(actionButton('admin', 'open', userId, { label: 'Voltar', emoji: '↩️', style: ButtonStyle.Secondary })),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro'));
    }
    return;
  }

  if (action === 'event_create_modal') {
    return interaction.showModal(textModal({
      section: 'admin', action: 'event_create_submit', userId, title: 'Criar evento de Batalha de Clãs',
      inputs: [
        { id: 'name', label: 'Nome do evento', placeholder: 'Ex: Liga Outono · Temporada 1', minLength: 3, maxLength: 80 },
        { id: 'hours', label: 'Duração em horas (168 = 7 dias)', placeholder: '168', maxLength: 5 },
        { id: 'description', label: 'Descrição (opcional)', paragraph: true, required: false, maxLength: 500 },
      ],
    }));
  }

  if (action === 'event_create_submit' && interaction.isModalSubmit()) {
    const name = interaction.fields.getTextInputValue('name').trim();
    const hours = parseInt(interaction.fields.getTextInputValue('hours').trim(), 10);
    const description = interaction.fields.getTextInputValue('description').trim() || undefined;
    if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
      await interaction.reply(errorReply('Duração inválida (1 a 720 horas).'));
      return;
    }
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const endsAt = new Date(Date.now() + hours * 3_600_000);
      const result = await apiPost('/api/admin/clan-war',
        { name, description, endsAt: endsAt.toISOString(), launchNow: true }, { jwt });
      const payload = await buildAdminPayload(user);
      payload.content = `✅ ${result.message || 'Evento lançado!'}`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao criar evento'));
    }
    return;
  }

  if (action === 'event_finalize_yes') {
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const active = await apiGet('/api/clan/war/active');
      if (!active?.event?.id) return interaction.editReply(errorReply('Sem evento ativo'));
      const result = await apiPatch(`/api/admin/clan-war/${active.event.id}`, { status: 'finished' }, { jwt });
      const payload = await buildAdminPayload(user);
      const msg = result.champion
        ? `🏆 Campeão: **${result.champion.name}** (${result.champion.points} pts)`
        : (result.message || 'Encerrado.');
      payload.content = `✅ ${msg}`;
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao encerrar'));
    }
  }
}
