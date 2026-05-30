-- CreateTable
CREATE TABLE "StoreRotation" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealStoreItem_rotation" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "poolItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "element" TEXT NOT NULL DEFAULT 'Neutro',
    "rarity" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "totalStock" INTEGER NOT NULL DEFAULT 50,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "itemId" TEXT,
    "rewardYuan" INTEGER NOT NULL DEFAULT 0,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RealStoreItem_rotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealStorePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeItemId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealStorePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RealStorePurchase_paymentId_key" ON "RealStorePurchase"("paymentId");

-- AddForeignKey
ALTER TABLE "RealStoreItem_rotation" ADD CONSTRAINT "RealStoreItem_rotation_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "StoreRotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealStorePurchase" ADD CONSTRAINT "RealStorePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealStorePurchase" ADD CONSTRAINT "RealStorePurchase_storeItemId_fkey" FOREIGN KEY ("storeItemId") REFERENCES "RealStoreItem_rotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
