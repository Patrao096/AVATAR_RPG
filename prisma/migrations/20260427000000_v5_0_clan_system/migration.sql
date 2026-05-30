-- ════════════════════════════════════════════════════════════
-- v5.0 — Sistema de Clãs avançado
-- ────────────────────────────────────────────────────────────
-- Idempotente (ADD COLUMN IF NOT EXISTS / CREATE IF NOT EXISTS).
-- Pode ser rodado sobre uma DB v4.x sem perda de dados.
-- ════════════════════════════════════════════════════════════

-- Estende Clan com visibility, capacidade e personalização
ALTER TABLE "Clan"
  ADD COLUMN IF NOT EXISTS "visibility"  TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS "maxMembers"  INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "bannerColor" TEXT,
  ADD COLUMN IF NOT EXISTS "motto"       TEXT;

-- Estende ClanMember com contribuição
ALTER TABLE "ClanMember"
  ADD COLUMN IF NOT EXISTS "contributedYuan" INTEGER NOT NULL DEFAULT 0;

-- ── ClanMessage (chat) ──
CREATE TABLE IF NOT EXISTS "ClanMessage" (
  "id"        TEXT NOT NULL,
  "clanId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "content"   VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClanMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClanMessage" ADD CONSTRAINT "ClanMessage_clanId_fkey"
    FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClanMessage" ADD CONSTRAINT "ClanMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ClanMessage_clanId_createdAt_idx"
  ON "ClanMessage"("clanId", "createdAt");

-- ── ClanInvite ──
CREATE TABLE IF NOT EXISTS "ClanInvite" (
  "id"            TEXT NOT NULL,
  "clanId"        TEXT NOT NULL,
  "invitedUserId" TEXT NOT NULL,
  "invitedBy"     TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClanInvite_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClanInvite" ADD CONSTRAINT "ClanInvite_clanId_fkey"
    FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClanInvite_clanId_invitedUserId_key"
  ON "ClanInvite"("clanId", "invitedUserId");
CREATE INDEX IF NOT EXISTS "ClanInvite_invitedUserId_status_idx"
  ON "ClanInvite"("invitedUserId", "status");

-- ── ClanJoinRequest ──
CREATE TABLE IF NOT EXISTS "ClanJoinRequest" (
  "id"        TEXT NOT NULL,
  "clanId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "message"   VARCHAR(200),
  "status"    TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClanJoinRequest_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClanJoinRequest" ADD CONSTRAINT "ClanJoinRequest_clanId_fkey"
    FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClanJoinRequest_clanId_userId_key"
  ON "ClanJoinRequest"("clanId", "userId");
CREATE INDEX IF NOT EXISTS "ClanJoinRequest_clanId_status_idx"
  ON "ClanJoinRequest"("clanId", "status");

-- ── ClanBan ──
CREATE TABLE IF NOT EXISTS "ClanBan" (
  "id"        TEXT NOT NULL,
  "clanId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "bannedBy"  TEXT NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClanBan_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClanBan" ADD CONSTRAINT "ClanBan_clanId_fkey"
    FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClanBan_clanId_userId_key"
  ON "ClanBan"("clanId", "userId");
