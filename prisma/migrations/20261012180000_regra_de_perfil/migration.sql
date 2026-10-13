-- Aditiva: "Sempre mandar para a Empresa". O comerciante que ela moveu de um perfil para outro
-- já chega marcado para o perfil de destino nas próximas importações. Só cria tabela nova.
CREATE TABLE "RegraDePerfil" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "destinoProfileId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegraDePerfil_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegraDePerfil_userId_profileId_pattern_key" ON "RegraDePerfil"("userId", "profileId", "pattern");
CREATE INDEX "RegraDePerfil_userId_idx" ON "RegraDePerfil"("userId");

ALTER TABLE "RegraDePerfil" ADD CONSTRAINT "RegraDePerfil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegraDePerfil" ADD CONSTRAINT "RegraDePerfil_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegraDePerfil" ADD CONSTRAINT "RegraDePerfil_destinoProfileId_fkey" FOREIGN KEY ("destinoProfileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
