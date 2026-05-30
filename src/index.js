import {
  Client, GatewayIntentBits, MessageFlags, Events,
} from 'discord.js';
import { CONFIG, validateConfig } from './config.js';
import { registerCommands } from './registerCommands.js';
import { buildHomePayload } from './panel/home.js';
import { routePanelInteraction } from './panel/index.js';

validateConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async () => {
  console.log(`[bot] Logado como ${client.user.tag}`);
  console.log(`[bot] Backend: ${CONFIG.API_URL}`);

  try {
    const resp = await fetch(`${CONFIG.API_URL}/api/admin/stats-bot`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      console.log('[bot] Backend respondeu OK');
    } else {
      console.warn(`[bot] Backend respondeu HTTP ${resp.status}`);
    }
  } catch (err) {
    console.error(`[bot] Sem conexão com o backend em ${CONFIG.API_URL}: ${err.message}`);
    console.error('[bot] Ajuste API_URL no .env. Em hosting, não use localhost.');
  }

  try {
    await registerCommands();
  } catch (err) {
    console.error('[bot] Falha ao registrar comandos:', err);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '🚫 Este bot só funciona dentro de servidores. Use `/painel` em um canal.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const cmd = interaction.commandName;
      if (cmd === 'painel' || cmd === 'dashboard') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const payload = await buildHomePayload(interaction.user);
        await interaction.editReply(payload);
      }
      return;
    }

    const customId = interaction.customId;
    const isPanel = typeof customId === 'string' &&
      (customId.startsWith('panel:') || customId.startsWith('modal:'));

    if (isPanel) {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '🚫 Este painel só funciona dentro de servidores.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await routePanelInteraction(interaction);
    }
  } catch (err) {
    console.error('[bot] InteractionCreate:', err);
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Erro inesperado. Tente novamente em alguns segundos.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch { /* interação morta */ }
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[bot] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[bot] uncaughtException:', err);
});

client.login(CONFIG.TOKEN);
