-- Migration v4.5: sistema de equipar skills/consumiveis, clan buff, quests com duration/expires
-- Funciona com ALTER sobre schema v4.4

-- ─── Character ───
ALTER TABLE "Character"
  ADD COLUMN IF NOT EXISTS "equippedSkills" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "clanBuffActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "questsCompletedToday" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "questsResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastChapterCompletedAt" TIMESTAMP(3);

-- ─── InventoryItem: flag de consumível equipado pra arena ───
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "isConsumableEquipped" BOOLEAN NOT NULL DEFAULT false;

-- ─── AdminQuest: cria a tabela se nao existir, depois ajusta colunas ───
CREATE TABLE IF NOT EXISTS "AdminQuest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "maxLevel" INTEGER NOT NULL DEFAULT 100,
    "maxProgress" INTEGER NOT NULL,
    "rewardExp" INTEGER NOT NULL,
    "rewardYuan" INTEGER NOT NULL,
    "rewardItem" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminQuest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminQuest"
  ADD COLUMN IF NOT EXISTS "durationHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "element" TEXT NOT NULL DEFAULT 'any';

-- ─── UserQuest: acceptedAt + isFailed ───
ALTER TABLE "UserQuest"
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "isFailed" BOOLEAN NOT NULL DEFAULT false;
