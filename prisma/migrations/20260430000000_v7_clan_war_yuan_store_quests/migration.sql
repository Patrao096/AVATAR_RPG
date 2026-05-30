-- Sincroniza o banco com models do schema que nao tinham migration:
-- AdminQuest, SkillCooldown, YuanStoreItem, ClanWarEvent, AdminNote
-- e colunas de evento de cla na tabela Clan.
-- Idempotente (IF NOT EXISTS) para rodar sem risco em bancos ja sincronizados via db push.

-- ─── AdminQuest ───
CREATE TABLE IF NOT EXISTS "AdminQuest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "element" TEXT NOT NULL DEFAULT 'any',
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "maxLevel" INTEGER NOT NULL DEFAULT 100,
    "maxProgress" INTEGER NOT NULL,
    "rewardExp" INTEGER NOT NULL,
    "rewardYuan" INTEGER NOT NULL,
    "rewardItem" TEXT,
    "durationHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminQuest_pkey" PRIMARY KEY ("id")
);

-- ─── SkillCooldown ───
CREATE TABLE IF NOT EXISTS "SkillCooldown" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "readyAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillCooldown_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SkillCooldown_characterId_skillId_key"
    ON "SkillCooldown" ("characterId", "skillId");

-- ─── YuanStoreItem (loja Yuan fixa) ───
CREATE TABLE IF NOT EXISTS "YuanStoreItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📦',
    "priceYuan" INTEGER NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "stock" INTEGER NOT NULL DEFAULT -1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YuanStoreItem_pkey" PRIMARY KEY ("id")
);

-- ─── ClanWarEvent (eventos de batalha de cla) ───
CREATE TABLE IF NOT EXISTS "ClanWarEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoreboard" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "ClanWarEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClanWarEvent_status_startsAt_idx"
    ON "ClanWarEvent" ("status", "startsAt");

-- ─── AdminNote (bloco de notas do admin) ───
CREATE TABLE IF NOT EXISTS "AdminNote" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'skill',
    "title" TEXT NOT NULL,
    "element" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminNote_category_updatedAt_idx"
    ON "AdminNote" ("category", "updatedAt");

-- ─── Colunas de evento de cla na tabela Clan ───
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "championBadges" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "buffType" TEXT;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "buffValue" DOUBLE PRECISION;
ALTER TABLE "Clan" ADD COLUMN IF NOT EXISTS "buffExpiresAt" TIMESTAMP(3);

-- ─── FK do SkillCooldown (so adiciona se ainda nao existir) ───
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'SkillCooldown_characterId_fkey'
    ) THEN
        ALTER TABLE "SkillCooldown"
            ADD CONSTRAINT "SkillCooldown_characterId_fkey"
            FOREIGN KEY ("characterId") REFERENCES "Character"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
