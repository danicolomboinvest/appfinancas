-- Casal simples (13/10/2026): o "Da casa" que o app aprende por comerciante. Só acrescenta.
CREATE TABLE "RegraDaCasa" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "pattern" VARCHAR(80) NOT NULL,
    "daCasa" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraDaCasa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegraDaCasa_userId_profileId_pattern_key" ON "RegraDaCasa"("userId", "profileId", "pattern");

ALTER TABLE "RegraDaCasa" ADD CONSTRAINT "RegraDaCasa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegraDaCasa" ADD CONSTRAINT "RegraDaCasa_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
