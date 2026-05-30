// bot/src/config.js
// Centraliza variáveis de ambiente e constantes do bot.
// Não usa import de discord.js — pode ser importado por qualquer módulo.

import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  // ─── Discord ───
  TOKEN: process.env.DISCORD_BOT_TOKEN,
  CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  // Se DEV_GUILD_ID estiver setado, comandos são registrados só nesse servidor (instantâneo).
  // Em prod (sem DEV_GUILD_ID), são registrados globalmente — leva ~1h pra propagar.
  DEV_GUILD_ID: process.env.DEV_GUILD_ID || null,

  // ─── Backend ───
  API_URL: process.env.API_URL || 'http://localhost:5000',
  BOT_INTERNAL_SECRET: process.env.BOT_INTERNAL_SECRET || process.env.DISCORD_CLIENT_SECRET,

  // ─── Comportamento ───
  // Cache TTL (ms) — quanto tempo o snapshot do user fica em memória antes de re-fetch
  CACHE_TTL_MS: 90_000,
  // Throttle: quantos clicks por segundo um user pode fazer no painel antes de receber
  // mensagem ephemeral pedindo pra acalmar
  CLICK_THROTTLE_PER_SEC: 3,
  // Tempo pra um custom ID ser considerado "expirado" (Discord mata token em 15min)
  CUSTOM_ID_TTL_MS: 14 * 60 * 1000, // 14min — margem de 1min antes do limite real
  // Polling pra desafio PvP — intervalo que o bot checa se virou turno do outro lado
  PVP_POLL_INTERVAL_MS: 3_000,
  // Máximo de tempo que um polling roda (após isso, força reabrir)
  PVP_POLL_MAX_MS: 13 * 60 * 1000, // 13min
};

// Validação na inicialização — falha cedo se faltar config crítica
export function validateConfig() {
  const missing = [];
  if (!CONFIG.TOKEN) missing.push('DISCORD_BOT_TOKEN');
  if (!CONFIG.CLIENT_ID) missing.push('DISCORD_CLIENT_ID');
  if (!CONFIG.API_URL) missing.push('API_URL');
  if (!CONFIG.BOT_INTERNAL_SECRET) missing.push('BOT_INTERNAL_SECRET (ou DISCORD_CLIENT_SECRET)');
  if (missing.length > 0) {
    console.error('❌ Variáveis de ambiente obrigatórias não configuradas:');
    missing.forEach(m => console.error('   -', m));
    process.exit(1);
  }

  // antes de chegar na API do Discord.
  if (!/^\d{17,20}$/.test(CONFIG.CLIENT_ID)) {
    console.error(`❌ DISCORD_CLIENT_ID inválido (deve ser um número de 17-20 dígitos).`);
    console.error(`   Valor recebido: ${JSON.stringify(CONFIG.CLIENT_ID).slice(0, 80)}...`);
    console.error(`   Verifique seu .env — provavelmente colou texto adicional na variável.`);
    process.exit(1);
  }
  if (CONFIG.DEV_GUILD_ID && !/^\d{17,20}$/.test(CONFIG.DEV_GUILD_ID)) {
    console.error(`❌ DEV_GUILD_ID inválido. Deve ser número de 17-20 dígitos OU vazio.`);
    process.exit(1);
  }
  if (!/^https?:\/\//.test(CONFIG.API_URL)) {
    console.error(`❌ API_URL deve começar com http:// ou https://`);
    console.error(`   Valor recebido: ${JSON.stringify(CONFIG.API_URL).slice(0, 80)}...`);
    process.exit(1);
  }

  // Limpa qualquer whitespace acidental nos campos críticos
  CONFIG.TOKEN = CONFIG.TOKEN.trim();
  CONFIG.CLIENT_ID = CONFIG.CLIENT_ID.trim();
  CONFIG.API_URL = CONFIG.API_URL.trim().replace(/\/$/, ''); // remove barra final
  CONFIG.BOT_INTERNAL_SECRET = CONFIG.BOT_INTERNAL_SECRET.trim();
  if (CONFIG.DEV_GUILD_ID) CONFIG.DEV_GUILD_ID = CONFIG.DEV_GUILD_ID.trim();
}

export const ELEMENT_ICON = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️', Nenhum: '❓' };
