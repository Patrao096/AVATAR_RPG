-- ═══════════════════════════════════════════════════════════════
-- v5.2 — Training Grounds (mini-game contra bosses)
-- ═══════════════════════════════════════════════════════════════
-- Idempotente. Roda em DBs com v5.1 já aplicada.

CREATE TABLE IF NOT EXISTS "BossDefeat" (
  "id"          TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "bossId"      TEXT NOT NULL,
  "nation"      TEXT NOT NULL,
  "tier"        INTEGER NOT NULL,
  "firstWin"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalWins"   INTEGER NOT NULL DEFAULT 1,
  "lastWinAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BossDefeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BossDefeat_characterId_bossId_key"
  ON "BossDefeat"("characterId", "bossId");
CREATE INDEX IF NOT EXISTS "BossDefeat_characterId_nation_idx"
  ON "BossDefeat"("characterId", "nation");
