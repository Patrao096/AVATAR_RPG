import { MessageFlags } from 'discord.js';
import { parse, validate } from '../utils/customId.js';
import { throttle } from '../cache.js';
import { expiredReply, errorReply } from './builders.js';

import { buildHomePayload } from './home.js';
import { handleProfile } from './sections/profile.js';
import { handleInventory } from './sections/inventory.js';
import { handleSkills } from './sections/skills.js';
import { handleShop } from './sections/shop.js';
import { handleQuests } from './sections/quests.js';
import { handleClan } from './sections/clan.js';
import { handleBlackMarket } from './sections/blackmarket.js';
import { handleRanking } from './sections/ranking.js';
import { handlePremium } from './sections/premium.js';
import { handleStory } from './sections/story.js';
import { handleCombat } from './sections/combat.js';
import { handleAdmin } from './sections/admin.js';

const SECTION_HANDLERS = {
  profile: handleProfile,
  inventory: handleInventory,
  skills: handleSkills,
  shop: handleShop,
  quests: handleQuests,
  clan: handleClan,
  blackmarket: handleBlackMarket,
  ranking: handleRanking,
  premium: handlePremium,
  story: handleStory,
  combat: handleCombat,
  admin: handleAdmin,
};

const OPEN_PAYLOADS = {
  profile: handleProfile,
  inventory: handleInventory,
  skills: handleSkills,
  shop: handleShop,
  quests: handleQuests,
  clan: handleClan,
  blackmarket: handleBlackMarket,
  ranking: handleRanking,
  premium: handlePremium,
  story: handleStory,
  combat: handleCombat,
};

export async function routePanelInteraction(interaction) {
  const parsed = parse(interaction.customId);
  if (!parsed) return false;

  if (throttle(interaction.user.id)) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '⏱️ Você está clicando rápido demais. Aguarde um instante.',
        flags: MessageFlags.Ephemeral,
      });
    }
    return true;
  }

  const v = validate(parsed, interaction.user.id);
  if (!v.valid) {
    if (v.reason === 'foreign_panel') {
      await interaction.reply({
        content: '🚫 Este painel não é seu. Use `/painel` para abrir o seu.',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    if (v.reason === 'expired') {
      await interaction.reply(expiredReply(interaction.user.id));
      return true;
    }
    await interaction.reply({ content: '❌ Painel inválido.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (parsed.section === 'home') {
    try {
      await interaction.deferUpdate();
      const payload = await buildHomePayload(interaction.user);
      await interaction.editReply(payload);
    } catch (err) {
      console.error('panel/home error:', err);
      await safeError(interaction, 'Erro ao carregar painel.');
    }
    return true;
  }

  if (parsed.section === 'nav' && parsed.action === 'go' && interaction.isStringSelectMenu()) {
    const target = interaction.values[0];
    const handler = OPEN_PAYLOADS[target];
    if (!handler) {
      await safeError(interaction, `Seção desconhecida: ${target}`);
      return true;
    }
    try {
      await handler(interaction, { ...parsed, section: target, action: 'open' });
    } catch (err) {
      console.error(`panel/nav→${target} error:`, err);
      await safeError(interaction, `Erro: ${err.message || err}`);
    }
    return true;
  }

  const handler = SECTION_HANDLERS[parsed.section];
  if (!handler) {
    await interaction.reply({
      content: `❌ Seção desconhecida: \`${parsed.section}\``,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  try {
    await handler(interaction, parsed);
  } catch (err) {
    console.error(`panel/${parsed.section} error:`, err);
    await safeError(interaction, `Erro: ${err.message || err}`);
  }
  return true;
}

async function safeError(interaction, text) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorReply(text));
    } else {
      await interaction.reply(errorReply(text));
    }
  } catch { /* interação morta */ }
}
