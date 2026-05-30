import { MessageFlags } from 'discord.js';
import {
  baseEmbed, COLORS, fmtYuan, progressBar, navSelectRow, refreshButton,
  actionButton, buttonRow, fmtTimeLeft,
} from './builders.js';
import { ELEMENT_ICON } from '../config.js';
import { getSnapshot, getSaldo, ensureUser, apiGet } from '../api.js';
import { isAdminDiscord } from '../utils/permissions.js';
import { cached } from '../cache.js';
import { ButtonStyle } from 'discord.js';

export async function buildHomePayload(discordUser) {
  const userId = discordUser.id;

  try {
    await ensureUser({
      discordId: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      globalName: discordUser.globalName,
    });
  } catch (err) {
    console.warn('[home] ensureUser falhou (continuando):', err.message);
  }

  const snapshot = await cached(`snapshot:${userId}`, () =>
    getSnapshot(userId, ['perfil', 'saldo', 'cla', 'assinatura']),
  );

  let saldo = snapshot.saldo;
  try { saldo = await getSaldo(userId); } catch { /* mantém cache */ }

  const perfil = snapshot.perfil;
  const cla = snapshot.cla;
  const isPremium = !!snapshot.assinatura && snapshot.assinatura.status === 'active';
  const isAdmin = isAdminDiscord(userId);

  if (!perfil) {
    return {
      content: '👋 Você ainda não tem personagem. Acesse o site para criar:\n' +
               (process.env.FRONTEND_URL || 'https://avatar-rpg.com'),
      embeds: [],
      components: [],
      flags: MessageFlags.Ephemeral,
    };
  }

  let activeWar = null;
  try {
    const war = await cached('clan_event', () => apiGet('/api/clan/war/active'), 30_000);
    if (war?.active) activeWar = war.event;
  } catch { /* evento é opcional */ }

  const elemIcon = ELEMENT_ICON[perfil.element] || '❓';
  const hp     = saldo?.hp     ?? snapshot.saldo?.hp     ?? 0;
  const maxHp  = saldo?.maxHp  ?? snapshot.saldo?.maxHp  ?? 100;
  const chi    = saldo?.chi    ?? snapshot.saldo?.chi    ?? 50;
  const maxChi = saldo?.maxChi ?? snapshot.saldo?.maxChi ?? 50;
  const yuan   = saldo?.yuan   ?? snapshot.saldo?.yuan   ?? 0;

  const lines = [
    `${elemIcon} **${perfil.element || 'Sem elemento'}** · Nível ${perfil.level} · ${perfil.elo} ELO`,
  ];
  if (!perfil.element || perfil.element === 'Nenhum') {
    lines.push('⚠️ *Configure seu elemento no site.*');
  }
  lines.push(
    `❤️ ${progressBar(hp, maxHp)} \`${hp}/${maxHp}\``,
    `💜 ${progressBar(chi, maxChi)} \`${chi}/${maxChi}\``,
    `💰 **${fmtYuan(yuan)}**`,
  );
  if (cla) lines.push(`🏛️ ${cla.name} · ${cla.role}`);
  if (isPremium) lines.push('💎 Premium ativo');
  if (activeWar) {
    lines.push('', `⚔️ **Evento ativo:** ${activeWar.name} · termina em ${fmtTimeLeft(activeWar.endsAt)}`);
  }

  const embed = baseEmbed({
    title: `🎮 ${perfil.name}`,
    description: lines.join('\n'),
    color: COLORS.primary,
    footer: 'Use o menu abaixo para navegar · painel expira em 14 min',
  });

  const components = [navSelectRow(userId, 'home')];

  const quickRow = buttonRow(
    actionButton('combat', 'open', userId, { label: 'Combate', emoji: '⚔️', style: ButtonStyle.Primary }),
    actionButton('shop', 'open', userId, { label: 'Loja', emoji: '💰', style: ButtonStyle.Secondary }),
    actionButton('quests', 'open', userId, { label: 'Missões', emoji: '📜', style: ButtonStyle.Secondary }),
    refreshButton('home', userId),
  );
  components.push(quickRow);

  if (isAdmin) {
    components.push(buttonRow(
      actionButton('admin', 'open', userId, { label: 'Admin', emoji: '⚙️', style: ButtonStyle.Danger }),
    ));
  }

  return { embeds: [embed], components, flags: MessageFlags.Ephemeral };
}
