import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  UserSelectMenuBuilder, MessageFlags,
} from 'discord.js';
import {
  baseEmbed, COLORS, navRow, errorReply, progressBar, selectRow, buttonRow, actionButton,
} from '../builders.js';
import { build as buildId } from '../../utils/customId.js';
import { ELEMENT_ICON } from '../../config.js';
import { apiGet, apiPost, getUserJwt } from '../../api.js';
import { invalidate } from '../../cache.js';

export async function buildCombatHomePayload(discordUser) {
  const userId = discordUser.id;

  let activeBattle = null;
  try {
    activeBattle = await getActiveBattle(discordUser);
  } catch { /* sem batalha ativa */ }

  let desc = 'Escolha uma modalidade:\n\n' +
    '🤖 **Treinar** — duela contra um bot por EXP e Yuan. *Exige clã.*\n' +
    '👤 **Desafiar** — amistoso com um membro do seu clã.\n' +
    '🌍 **Arena ranqueada** — matchmaking por ELO, no site.';

  if (activeBattle) {
    desc = '⚔️ **Você tem uma batalha em andamento.**\n\n' + desc;
  }

  const embed = baseEmbed({ title: '⚔️ Combate', description: desc, color: COLORS.danger });

  const components = [];

  if (activeBattle) {
    components.push(buttonRow(
      actionButton('combat', 'resume', userId, { label: 'Continuar batalha', emoji: '▶️', style: ButtonStyle.Success }),
    ));
  }

  components.push(selectRow('combat', 'mode', userId, {
    placeholder: 'Escolher modalidade…',
    options: [
      { value: 'train',     label: 'Treinar (PvE)', emoji: '🤖', description: 'Duelar contra um bot' },
      { value: 'challenge', label: 'Desafiar membro', emoji: '👤', description: 'Amistoso no clã' },
    ],
  }));

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Arena PvP no site')
        .setEmoji('🌍')
        .setStyle(ButtonStyle.Link)
        .setURL(`${frontendUrl}/arena`),
    ));
  }

  components.push(navRow('combat', userId));
  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

async function buildTrainPickPayload(discordUser) {
  const userId = discordUser.id;
  let progress;
  try {
    const jwt = await getUserJwt(discordUser);
    progress = await apiGet('/api/training/progress', { jwt });
  } catch (err) {
    if (err.body?.requiresClan) {
      return {
        embeds: [baseEmbed({
          title: '🚫 Treino exige clã',
          description: 'O Salão de Treino é exclusivo para membros de clãs.\n\nEntre em um clã na seção 🏛️ Clã.',
          color: COLORS.warning,
        })],
        components: [navRow('combat', userId)],
        flags: MessageFlags.Ephemeral,
      };
    }
    throw err;
  }

  const allBosses = [];
  for (const [nation, list] of Object.entries(progress.progress || {})) {
    for (const b of list) {
      if (b.unlocked) allBosses.push({ ...b, nation });
    }
  }

  if (allBosses.length === 0) {
    return {
      embeds: [baseEmbed({
        title: '🤖 Treinar',
        description: '*Nenhum boss desbloqueado ainda. Suba de nível e volte aqui.*',
        color: COLORS.neutral,
      })],
      components: [navRow('combat', userId)],
      flags: MessageFlags.Ephemeral,
    };
  }

  const mc = progress.myCharacter;
  const embed = baseEmbed({
    title: '🤖 Treinar · Escolha o adversário',
    description: `Nível ${mc.level} · ${ELEMENT_ICON[mc.element] || '⚔️'} ${mc.element}`,
    color: COLORS.danger,
    footer: `${allBosses.length} desbloqueado(s)`,
  });

  const components = [
    selectRow('combat', 'train_start', userId, {
      placeholder: 'Selecionar um boss…',
      options: allBosses.slice(0, 25).map(b => ({
        label: `${b.icon} ${b.name}`.slice(0, 90),
        description: `${b.nation} · T${b.tier} · ${b.defeated ? `${b.totalWins} vitórias` : 'nunca derrotado'}`.slice(0, 95),
        value: b.id,
      })),
    }),
    buttonRow(actionButton('combat', 'open', userId, { label: 'Voltar', emoji: '↩️', style: ButtonStyle.Secondary })),
  ];

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

function buildBattlePayload(discordUser, { state, skills, mode = 'training', flash = null }) {
  const userId = discordUser.id;
  const me = state.me;
  const opp = state.opponent;
  const isMyTurn = state.isMyTurn;

  const myElem = ELEMENT_ICON[me.element] || '⚔️';
  const oppElem = ELEMENT_ICON[opp.element] || '⚔️';

  const statusStr = (effects) => {
    if (!effects || effects.length === 0) return '';
    return ' ' + effects.map(s => `${s.icon}${s.turnsRemaining}`).join(' ');
  };

  let desc = `**Turno ${state.turnNumber}** ${isMyTurn ? '· 🎯 SUA VEZ' : '· ⏳ Adversário pensando…'}\n\n`;
  desc += `${myElem} **Você**${statusStr(me.statusEffects)}\n`;
  desc += `❤️ ${progressBar(me.hp, me.maxHp)} \`${me.hp}/${me.maxHp}\`\n`;
  desc += `💜 ${progressBar(me.chi, me.maxChi)} \`${me.chi}/${me.maxChi}\``;
  if (me.lastChiRegen > 0) desc += ` *+${me.lastChiRegen}*`;
  desc += '\n\n';
  desc += `${oppElem} **${opp.name}**${statusStr(opp.statusEffects)}\n`;
  desc += `❤️ ${progressBar(opp.hp, opp.maxHp)} \`${opp.hp}/${opp.maxHp}\``;

  if (flash) desc = flash + '\n\n' + desc;

  const embed = baseEmbed({
    title: `⚔️ Batalha · ${mode === 'training' ? 'Treino' : 'PvP'}`,
    description: desc,
    color: isMyTurn ? COLORS.success : COLORS.warning,
    footer: 'Painel expira em 14 min · use Continuar se sumir',
  });

  const components = [];

  if (isMyTurn) {
    const usableSkills = skills.filter(s =>
      s.id === 'ataque_basico' || (s.turnsRemaining === 0 && me.chi >= s.chiCost));
    usableSkills.sort((a, b) => {
      if (a.id === 'ataque_basico') return -1;
      if (b.id === 'ataque_basico') return 1;
      return a.chiCost - b.chiCost;
    });

    const skillsToShow = usableSkills.slice(0, 4);

    const row1 = new ActionRowBuilder();
    for (const s of skillsToShow) {
      const labelChi = s.chiCost > 0 ? ` (-${s.chiCost})` : '';
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(buildId('combat', 'skill', userId, s.id))
          .setLabel(`${s.name}${labelChi}`.slice(0, 80))
          .setEmoji(s.icon || '⚔️')
          .setStyle(s.id === 'ataque_basico' ? ButtonStyle.Secondary : ButtonStyle.Primary),
      );
    }
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(buildId('combat', 'defend', userId))
        .setLabel('Defender')
        .setEmoji('🛡️')
        .setStyle(ButtonStyle.Secondary),
    );
    components.push(row1);

    const blockedSkills = skills.filter(s =>
      s.id !== 'ataque_basico' &&
      (s.turnsRemaining > 0 || me.chi < s.chiCost) &&
      !skillsToShow.find(x => x.id === s.id)
    ).slice(0, 4);
    if (blockedSkills.length > 0) {
      const row2 = new ActionRowBuilder();
      for (const s of blockedSkills) {
        const reason = s.turnsRemaining > 0 ? `CD ${s.turnsRemaining}T` : `${s.chiCost}💜`;
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(buildId('combat', 'skill_blocked', userId, s.id))
            .setLabel(`${s.name} (${reason})`.slice(0, 80))
            .setEmoji(s.icon || '🚫')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
      }
      components.push(row2);
    }

    const row3 = new ActionRowBuilder();
    if (me.consumables && me.consumables.length > 0) {
      row3.addComponents(
        new ButtonBuilder()
          .setCustomId(buildId('combat', 'potion_pick', userId))
          .setLabel(`Poções (${me.consumables.length})`)
          .setEmoji('🧪')
          .setStyle(ButtonStyle.Secondary),
      );
    }
    row3.addComponents(
      new ButtonBuilder()
        .setCustomId(buildId('combat', 'forfeit_confirm', userId))
        .setLabel('Desistir')
        .setEmoji('🏳️')
        .setStyle(ButtonStyle.Danger),
    );
    components.push(row3);
  } else {
    components.push(buttonRow(
      new ButtonBuilder()
        .setCustomId(buildId('combat', 'refresh_battle', userId))
        .setLabel('Atualizar')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary),
    ));
  }

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}

async function renderBattle(discordUser, { mode = 'training', flash = null } = {}) {
  const jwt = await getUserJwt(discordUser);
  const state = await getActiveBattle(discordUser);
  if (!state || !state.battleId) {
    return {
      content: '❌ Sem batalha ativa.',
      components: [navRow('combat', discordUser.id)],
      flags: MessageFlags.Ephemeral,
    };
  }
  const skills = await apiGet(`/api/battle/skills?battleId=${state.battleId}`, { jwt });
  return buildBattlePayload(discordUser, { state, skills, mode, flash });
}

async function renderBattleEnd(discordUser, outcome) {
  const userId = discordUser.id;
  let title, color;
  if (outcome === 'won')       { title = '🏆 Vitória!';          color = COLORS.success; }
  else if (outcome === 'lost') { title = '💀 Derrota';           color = COLORS.danger;  }
  else                         { title = '🏁 Batalha encerrada'; color = COLORS.neutral; }

  return {
    embeds: [baseEmbed({
      title,
      description: 'A batalha terminou.\n\nVeja sua progressão de EXP e Yuan no painel principal.',
      color,
    })],
    components: [
      buttonRow(
        actionButton('combat', 'open', userId, { label: 'Outra batalha', emoji: '⚔️', style: ButtonStyle.Primary }),
        actionButton('home', 'open', userId, { label: 'Painel', emoji: '🏠', style: ButtonStyle.Secondary }),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

export async function handleCombat(interaction, parsed) {
  const { action, userId, extra } = parsed;
  const user = interaction.user;

  if (action === 'open' || action === 'refresh') {
    await interaction.deferUpdate();
    const payload = await buildCombatHomePayload(user);
    await interaction.editReply(payload);
    return;
  }

  if (action === 'mode' && interaction.isStringSelectMenu()) {
    const mode = interaction.values[0];
    await interaction.deferUpdate();
    try {
      if (mode === 'train') {
        await interaction.editReply(await buildTrainPickPayload(user));
      } else {
        await interaction.editReply(await buildChallengePickPayload(user));
      }
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro'));
    }
    return;
  }

  if (action === 'resume' || action === 'refresh_battle') {
    await interaction.deferUpdate();
    try {
      await interaction.editReply(await renderBattle(user));
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Sem batalha ativa'));
    }
    return;
  }

  if (action === 'train_start' && interaction.isStringSelectMenu()) {
    const bossId = interaction.values[0];
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      await apiPost(`/api/training/start/${bossId}`, {}, { jwt });
      await interaction.editReply(await renderBattle(user, { mode: 'training', flash: '⚔️ Batalha iniciada!' }));
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('já está') || msg.toLowerCase().includes('em batalha')) {
        await interaction.editReply({
          embeds: [baseEmbed({
            title: '⚠️ Você já está em batalha',
            description:
              'Há uma batalha pendente — provavelmente aberta pelo site e não finalizada.\n\n' +
              'Continue ou abandone para começar uma nova.',
            color: COLORS.warning,
          })],
          components: [
            buttonRow(
              actionButton('combat', 'resume', userId, { label: 'Continuar', emoji: '▶️', style: ButtonStyle.Success }),
              actionButton('combat', 'abandon_pending', userId, { label: 'Abandonar', emoji: '🗑️', style: ButtonStyle.Danger }),
              actionButton('combat', 'open', userId, { label: 'Voltar', style: ButtonStyle.Secondary }),
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.editReply(errorReply(msg || 'Erro ao iniciar'));
    }
    return;
  }

  if (action === 'abandon_pending') {
    await interaction.deferUpdate();
    try {
      await apiPost(`/api/bot/battle/abandon/${userId}`, {});
      const payload = await buildCombatHomePayload(user);
      payload.content = '✅ Batalha abandonada. Pode começar uma nova.';
      await interaction.editReply(payload);
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao abandonar'));
    }
    return;
  }

  if (action === 'skill') {
    const skillId = extra;
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const state = await getActiveBattle(user);
      if (!state || !state.battleId) return interaction.editReply(errorReply('Batalha não encontrada'));
      const endpoint = state.isPvP ? '/api/battle/use-skill' : '/api/training/use-skill';
      const result = await apiPost(endpoint, { skillId, battleId: state.battleId }, { jwt });
      const flash = result.flash || formatTurnFlash(result);

      if (result.outcome === 'won' || result.outcome === 'lost') {
        await endBattle(user, state, jwt, result.outcome);
        return interaction.editReply(await renderBattleEnd(user, result.outcome));
      }
      await interaction.editReply(await renderBattle(user, { mode: state.isPvP ? 'pvp' : 'training', flash }));
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro na skill'));
    }
    return;
  }

  if (action === 'defend') {
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const state = await getActiveBattle(user);
      if (!state || !state.battleId) return interaction.editReply(errorReply('Batalha não encontrada'));
      const endpoint = state.isPvP ? '/api/battle/defend' : '/api/training/defend';
      const result = await apiPost(endpoint, { battleId: state.battleId }, { jwt });
      const flash = result.flash || '🛡️ Você defendeu!';

      if (result.outcome === 'won' || result.outcome === 'lost') {
        await endBattle(user, state, jwt, result.outcome);
        return interaction.editReply(await renderBattleEnd(user, result.outcome));
      }
      await interaction.editReply(await renderBattle(user, { mode: state.isPvP ? 'pvp' : 'training', flash }));
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao defender'));
    }
    return;
  }

  if (action === 'potion_pick') {
    await interaction.deferUpdate();
    try {
      const state = await getActiveBattle(user);
      if (!state || !state.me.consumables || state.me.consumables.length === 0) {
        return interaction.editReply(errorReply('Sem poções equipadas'));
      }
      await interaction.editReply({
        embeds: [baseEmbed({
          title: '🧪 Usar poção',
          description: 'Escolha uma poção. Usar não consome o seu turno.',
          color: COLORS.info,
        })],
        components: [
          selectRow('combat', 'potion_use', userId, {
            placeholder: 'Usar uma poção…',
            options: state.me.consumables.slice(0, 25).map(c => ({
              label: `${c.itemName}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`.slice(0, 90),
              description: (c.effect?.label || 'Efeito').slice(0, 95),
              value: c.inventoryId,
              emoji: c.effect?.icon || '🧪',
            })),
          }),
          buttonRow(
            new ButtonBuilder()
              .setCustomId(buildId('combat', 'refresh_battle', userId))
              .setLabel('Cancelar')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro'));
    }
    return;
  }

  if (action === 'potion_use' && interaction.isStringSelectMenu()) {
    const inventoryId = interaction.values[0];
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const state = await getActiveBattle(user);
      const endpoint = state.isPvP ? '/api/battle/use-consumable' : '/api/training/use-potion';
      const result = await apiPost(endpoint,
        { consumableInventoryId: inventoryId, battleId: state.battleId }, { jwt });
      const flash = result.effect?.message || '🧪 Poção usada!';

      if (result.outcome === 'won' || result.outcome === 'lost') {
        await endBattle(user, state, jwt, result.outcome);
        return interaction.editReply(await renderBattleEnd(user, result.outcome));
      }
      await interaction.editReply(await renderBattle(user, { mode: state.isPvP ? 'pvp' : 'training', flash }));
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro com a poção'));
    }
    return;
  }

  if (action === 'forfeit_confirm') {
    await interaction.deferUpdate();
    await interaction.editReply({
      embeds: [baseEmbed({
        title: '🏳️ Desistir?',
        description: 'Você perde a batalha (conta como derrota). Tem certeza?',
        color: COLORS.danger,
      })],
      components: [
        buttonRow(
          actionButton('combat', 'forfeit_yes', userId, { label: 'Sim, desistir', style: ButtonStyle.Danger }),
          new ButtonBuilder()
            .setCustomId(buildId('combat', 'refresh_battle', userId))
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (action === 'forfeit_yes') {
    await interaction.deferUpdate();
    try {
      const jwt = await getUserJwt(user);
      const state = await getActiveBattle(user);
      if (state?.battleId) {
        await apiPost('/api/battle/end', { battleId: state.battleId, result: 'loss' }, { jwt }).catch(() => {});
      }
      await interaction.editReply(await renderBattleEnd(user, 'lost'));
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao desistir'));
    }
    return;
  }

  if (action === 'challenge_send' && interaction.isUserSelectMenu()) {
    const targetDiscordId = interaction.values[0];
    await interaction.deferUpdate();
    if (targetDiscordId === userId) {
      return interaction.editReply(errorReply('Não dá para desafiar você mesmo.'));
    }
    try {
      const jwt = await getUserJwt(user);
      const target = await apiGet(`/api/bot/character/${targetDiscordId}`);
      if (!target || !target.userId) {
        return interaction.editReply(errorReply('Este usuário ainda não tem personagem.'));
      }
      const result = await apiPost(`/api/clan-spar/challenge/${target.userId}`, {}, { jwt });
      await interaction.editReply({
        embeds: [baseEmbed({
          title: '⏳ Desafio enviado',
          description: `Você desafiou **${target.discordUsername || 'jogador'}** para um amistoso.\n\n` +
                       'Quando ele aceitar (até 10 min), a batalha começa para você.',
          color: COLORS.info,
          footer: `ID: ${result.challengeId || '-'}`,
        })],
        components: [
          buttonRow(
            actionButton('combat', 'resume', userId, { label: 'Verificar batalha', emoji: '🔄', style: ButtonStyle.Primary }),
            actionButton('combat', 'open', userId, { label: 'Voltar', style: ButtonStyle.Secondary }),
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      await interaction.editReply(errorReply(err.message || 'Erro ao desafiar'));
    }
  }
}

async function buildChallengePickPayload(discordUser) {
  const userId = discordUser.id;
  const snapshot = await apiGet(`/api/bot/snapshot/${userId}?fields=cla`);
  if (!snapshot.cla) {
    return {
      embeds: [baseEmbed({
        title: '🚫 Sem clã',
        description: 'Desafios diretos só funcionam **entre membros do mesmo clã**.\n\nEntre em um clã na seção 🏛️ Clã.',
        color: COLORS.warning,
      })],
      components: [navRow('combat', userId)],
      flags: MessageFlags.Ephemeral,
    };
  }

  return {
    embeds: [baseEmbed({
      title: '👤 Desafiar membro do clã',
      description: 'Selecione abaixo. Só funciona com jogadores do **mesmo clã**.\nO desafio vale por 10 min após o aceite.',
      color: COLORS.info,
    })],
    components: [
      new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(buildId('combat', 'challenge_send', userId))
          .setPlaceholder('Escolher um oponente do seu clã…')
          .setMinValues(1).setMaxValues(1),
      ),
      buttonRow(actionButton('combat', 'open', userId, { label: 'Voltar', style: ButtonStyle.Secondary })),
    ],
    flags: MessageFlags.Ephemeral,
  };
}

async function getActiveBattle(user) {
  const data = await apiGet(`/api/bot/battle/active/${user.id}`);
  if (!data?.active) return null;
  return {
    battleId: data.battleId,
    isPvP: data.isPvP,
    me: data.me,
    opponent: data.opponent,
    isMyTurn: data.isMyTurn,
    turnNumber: data.turnNumber,
    logs: data.logs || [],
    outcome: data.outcome,
  };
}

function formatTurnFlash(result) {
  const logs = result?.logs || [];
  if (logs.length === 0) return null;
  const last = logs[logs.length - 1];
  if (last?.message) return last.message;
  if (last?.skillName) {
    return `${last.attackerName || 'Alguém'} usou ${last.skillName} (${last.damage || 0} dmg)`;
  }
  return null;
}

async function endBattle(user, state, jwt, outcome) {
  try {
    await apiPost('/api/battle/end',
      { battleId: state.battleId, result: outcome === 'won' ? 'win' : 'loss' }, { jwt });
  } catch { /* já encerrada */ }
  invalidate(`snapshot:${user.id}`);
}
