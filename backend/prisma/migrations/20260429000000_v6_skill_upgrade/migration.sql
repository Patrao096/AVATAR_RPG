-- ═══════════════════════════════════════════════════════════════════════
-- Migration v6.0 — Avatar RPG
-- Novos campos: skillUpgrades, talentTree, attributePoints, equippedItems,
--               clanElement snapshot, DailyStore para mercado rotativo
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Novos campos no Character ───────────────────────────────────────

-- Nível de cada skill desbloqueada: { "dobra_fogo": 3, "raio_azul": 1 }
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "skillUpgrades" JSONB NOT NULL DEFAULT '{}';

-- Árvore de talentos: { "corpo": 2, "espirito": 1, "combate": 3 }
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "talentTree" JSONB NOT NULL DEFAULT '{"corpo":0,"espirito":0,"combate":0}';

-- Pontos de atributo disponíveis para gastar
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "attributePoints" INTEGER NOT NULL DEFAULT 0;

-- Itens equipados por slot: { "weapon": "inventoryItemId", "armor": "...", "amulet": "...", "accessory": "..." }
-- Usado para snapshot rápido sem precisar varrer todo o inventário
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "equippedSlots" JSONB NOT NULL DEFAULT '{}';

-- Cache do elemento do clã (para não precisar buscar o clã sempre)
ALTER TABLE "Character" ADD COLUMN IF NOT EXISTS "clanElement" TEXT;

-- ─── 2. Tabela DailyStore (rotação diária do mercado de Yuans) ──────────

CREATE TABLE IF NOT EXISTS "DailyStore" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "date"        TEXT NOT NULL UNIQUE,          -- "2026-04-30"
  "skillId"     TEXT NOT NULL,                 -- id da skill sorteada
  "itemIds"     TEXT[] NOT NULL DEFAULT '{}',  -- 3 itens sorteados
  "potionIds"   TEXT[] NOT NULL DEFAULT '{}',  -- 2 poções sorteadas
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 3. Histórico de movimentos de batalha (para a IA do bot) ───────────
-- Armazenado em memória no battle-state.js, mas adicionamos ao BattleLog para análise

ALTER TABLE "BattleLog" ADD COLUMN IF NOT EXISTS "moveHistory" JSONB DEFAULT '[]';

-- ─── 4. Índice para DailyStore (busca rápida por data) ──────────────────
CREATE INDEX IF NOT EXISTS "DailyStore_date_idx" ON "DailyStore"("date");

-- ─── 5. Trigger: dar 1 ponto de atributo por level up ───────────────────
-- Implementado na camada da aplicação (progression.js), não no DB

-- ─── Notas de compatibilidade ────────────────────────────────────────────
-- skillUpgrades: JSON puro, sem FK — o backend lê e valida
-- talentTree: valores inteiros por ramo (corpo, espirito, combate)
-- attributePoints: decrementado ao gastar, incrementado ao subir de nível
-- equippedSlots: opcional — inventory.js ainda é a fonte de verdade
-- DailyStore: recriada todo dia pelo endpoint /api/yuanstore/daily-refresh
