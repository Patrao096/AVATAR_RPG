-- ═══════════════════════════════════════════════════════════════
-- v5.1 — ClanTrade (escambo múltiplo dentro do clã)
-- ═══════════════════════════════════════════════════════════════
-- Idempotente. Roda em DBs com v5.0 já aplicada.

CREATE TABLE IF NOT EXISTS "ClanTrade" (
  "id"           TEXT NOT NULL,
  "clanId"       TEXT NOT NULL,
  "fromUserId"   TEXT NOT NULL,
  "toUserId"     TEXT,
  "offerItems"   JSONB NOT NULL DEFAULT '[]'::jsonb,
  "offerYuan"    INTEGER NOT NULL DEFAULT 0,
  "requestItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "requestYuan"  INTEGER NOT NULL DEFAULT 0,
  "message"      VARCHAR(200),
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "acceptedBy"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),

  CONSTRAINT "ClanTrade_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClanTrade_clanId_status_idx"
  ON "ClanTrade"("clanId", "status");
CREATE INDEX IF NOT EXISTS "ClanTrade_fromUserId_idx"
  ON "ClanTrade"("fromUserId");
CREATE INDEX IF NOT EXISTS "ClanTrade_toUserId_idx"
  ON "ClanTrade"("toUserId");
