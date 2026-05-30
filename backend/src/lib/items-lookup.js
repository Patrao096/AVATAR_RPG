// backend/src/lib/items-lookup.js
// Mantém compatibilidade total com inventory.js, market.js, battle.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

let _items = null;

function loadItems() {
  if (_items) return _items;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'items.json'), 'utf-8');
    _items = JSON.parse(raw);
  } catch (e) {
    console.error('items-lookup: falha ao carregar items.json', e.message);
    _items = [];
  }
  return _items;
}

export function findItemByName(name) {
  if (!name) return null;
  const items = loadItems();
  return items.find(i => i.name.toLowerCase() === name.toLowerCase()) || null;
}

export function findItemById(id) {
  if (!id) return null;
  const items = loadItems();
  return items.find(i => i.id === id) || null;
}

export function getAllItems() { return loadItems(); }

export function getPriceRange(itemName) {
  const item = findItemByName(itemName);
  if (!item || !item.price) {
    return { min: 1, max: 999999, basePrice: null, unknown: true };
  }
  return {
    min: Math.floor(item.price * 0.5),
    max: Math.ceil(item.price * 1.5),
    basePrice: item.price,
    unknown: false,
  };
}

export function getItemType(itemName) {
  const item = findItemByName(itemName);
  return item?.type || null;
}

export function getItemStats(itemName) {
  const item = findItemByName(itemName);
  return item?.stats || null;
}

export const EQUIPPABLE_TYPES = ['weapon', 'armor', 'amulet', 'accessory'];

export function isEquippable(itemName) {
  const type = getItemType(itemName);
  return EQUIPPABLE_TYPES.includes(type);
}

export function isConsumable(itemName) {
  return getItemType(itemName) === 'consumable';
}

/**
 * Retorna o passiveEffect de um item equipável.
 * Usado pelo battle.js para aplicar efeitos passivos durante a batalha.
 */
export function getItemPassiveEffect(itemName) {
  const item = findItemByName(itemName);
  if (!item || !isEquippable(item.name)) return null;
  return item.passiveEffect || null;
}

export function getEquippedPassiveEffects(inventoryItems) {
  const effects = [];
  for (const invItem of inventoryItems) {
    const catalog = findItemByName(invItem.itemName);
    if (!catalog) continue;
    if (!isEquippable(catalog.name)) continue;
    if (!catalog.passiveEffect) continue;
    effects.push({
      itemName: invItem.itemName,
      passiveEffect: catalog.passiveEffect,
      passiveDescription: catalog.passiveDescription || '',
      element: catalog.element || 'Neutro',
      type: catalog.type,
    });
  }
  return effects;
}

export function getConsumableEffect(itemName) {
  const item = findItemByName(itemName);
  if (!item || item.type !== 'consumable') return null;

  if (item.effect && item.effect.type) {
    return item.effect;
  }

  // Fallback: derivar do campo stats (compatibilidade com itens antigos)
  const stats = item.stats || {};

  if (stats.hp && stats.hp > 0 && stats.chi && stats.chi > 0) {
    return { type: 'heal_and_chi', hp: stats.hp, chi: stats.chi, label: `Restaura ${stats.hp} HP e ${stats.chi} Chi`, icon: '✨' };
  }
  if (stats.hp && stats.hp > 0) {
    return { type: 'heal', value: stats.hp, label: `Restaura ${stats.hp} HP`, icon: '❤️' };
  }
  if (stats.chi && stats.chi > 0) {
    return { type: 'restore_chi', value: stats.chi, label: `Restaura ${stats.chi} Chi`, icon: '💜' };
  }
  if (stats.attack && stats.attack > 0) {
    return { type: 'buff_attack', value: stats.attack, duration: 3, label: `+${stats.attack} Ataque por 3 turnos`, icon: '⚔️' };
  }
  if (stats.defense && stats.defense > 0) {
    return { type: 'buff_defense', value: stats.defense, duration: 3, label: `+${stats.defense} Defesa por 3 turnos`, icon: '🛡️' };
  }

  return { type: 'generic', label: item.description || 'Efeito desconhecido', icon: '🧪' };
}

/**
 * Itens por elemento — útil para filtros e recompensas da história
 */
export function getItemsByElement(element, type = null) {
  return loadItems().filter(item => {
    const matchElement = item.element === element || item.element === 'Neutro';
    const matchType = type ? item.type === type : true;
    return matchElement && matchType;
  });
}

/**
 * Itens de recompensa por clã/elemento para o modo história.
 * Retorna o item de recompensa adequado para o capítulo e clã do jogador.
 */
export const CLAN_STORY_REWARDS = {
  Fogo: {
    1: 'Punho de Brasa',
    2: 'Frasco de Lava',
    3: 'Amuleto da Labareda',
    4: 'Lança de Ozai',
    5: 'Essência Vulcânica',
    6: 'Luvas de Treinamento do Fogo',
    7: 'Cinturão do General',
    8: 'Tônico de Guerreiro',
    9: 'Elixir de Fúria',
    10: 'Coroa de Azula',
  },
  Água: {
    1: 'Água de Cura Simples',
    2: 'Elixir de Chi Menor',
    3: 'Amuleto da Lua',
    4: 'Cajado de Bambu',
    5: 'Água Sagrada de Katara',
    6: 'Faixas dos Guerreiros da Água',
    7: 'Brincos do Polo Norte',
    8: 'Frasco de Gelo',
    9: 'Chá do Iroh',
    10: 'Colar de Yue',
  },
  Terra: {
    1: 'Pó de Pedra',
    2: 'Manopla de Pedra',
    3: 'Anel de Jade',
    4: 'Martelo do Reino',
    5: 'Tônico de Guardião',
    6: 'Botas da Montanha',
    7: 'Cinto de Couro de Ba Sing Se',
    8: 'Antídoto Espiritual',
    9: 'Braçadeiras de Toph',
    10: 'Pedra do Avatar',
  },
  Ar: {
    1: 'Colar dos Templos',
    2: 'Elixir de Chi Menor',
    3: 'Tatuagem Energizada',
    4: 'Bordão do Mestre',
    5: 'Essência dos Templos',
    6: 'Óculos de Aviador de Aang',
    7: 'Pergaminho de Tática',
    8: 'Bomba de Fumaça',
    9: 'Pena do Avatar',
    10: 'Vestes do Avatar',
  },
  Neutro: {
    1: 'Bandana de Sokka',
    2: 'Água de Cura Simples',
    3: 'Amuleto da Paz',
    4: 'Bumerangue de Sokka',
    5: 'Pergaminho de Amplificação',
    6: 'Bomba de Fumaça',
    7: 'Antídoto Espiritual',
    8: 'Máscara do Espírito',
    9: 'Leque de Kyoshi',
    10: 'Medalha das Quatro Nações',
  },
};

export function getClanStoryReward(clanElement, chapterNumber) {
  const el = clanElement || 'Neutro';
  const rewards = CLAN_STORY_REWARDS[el] || CLAN_STORY_REWARDS['Neutro'];
  return rewards[chapterNumber] || null;
}