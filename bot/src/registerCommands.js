import { SlashCommandBuilder, REST, Routes } from 'discord.js';
import { CONFIG } from './config.js';

const COMMANDS = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel central do Avatar RPG')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Alias de /painel')
    .toJSON(),
];

export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);

  if (CONFIG.DEV_GUILD_ID) {
    console.log(`[bot] Registrando comandos no guild ${CONFIG.DEV_GUILD_ID}`);
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.DEV_GUILD_ID),
      { body: COMMANDS },
    );
    console.log(`[bot] ${COMMANDS.length} comando(s) registrado(s) no guild.`);
  } else {
    console.log('[bot] Registrando comandos globalmente (propagacao em ate 1h)');
    await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: COMMANDS });
    console.log(`[bot] ${COMMANDS.length} comando(s) registrado(s) globalmente.`);
  }
}

export async function clearAllCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  try {
    if (CONFIG.DEV_GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.DEV_GUILD_ID),
        { body: [] },
      );
    } else {
      await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: [] });
    }
    console.log('[bot] Comandos antigos limpos.');
  } catch (err) {
    console.error('[bot] Erro ao limpar comandos:', err);
  }
}
