-- Metas da versão nova (11/10/2026): os 18 tipos da nova meta guiada, a foto da meta e o que o
-- cartão do aporte do mês precisa lembrar. Tudo é acréscimo: nenhuma coluna some, nenhum valor
-- muda, e as metas antigas continuam com o tipo que tinham (APOSENTADORIA vira "Liberdade
-- financeira" e GENERICO vira "Outro" só na tela).

-- Os tipos novos. ADD VALUE IF NOT EXISTS pode rodar dentro da transação da migração porque
-- nenhum dos valores novos é usado nela.
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'RESERVA';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'MOTO';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'CASAMENTO';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'FILHO';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'ESTUDOS';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'INTERCAMBIO';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'REFORMA';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'FESTA';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'NEGOCIO';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'PET';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'TECNOLOGIA';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'SAUDE';
ALTER TYPE "GoalIcon" ADD VALUE IF NOT EXISTS 'SHOW';

-- A foto, o "Ainda não" do mês e os lançamentos que ela disse que não eram desta meta.
ALTER TABLE "Goal" ADD COLUMN "fotoUrl" TEXT;
ALTER TABLE "Goal" ADD COLUMN "aporteAdiadoMes" TEXT;
ALTER TABLE "Goal" ADD COLUMN "aportesRecusados" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- A foto da pessoa ("Usar uma minha"), servida só para a dona pela rota autenticada.
CREATE TABLE "FotoDaMeta" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT,
    "tipo" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoDaMeta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotoDaMeta_userId_profileId_idx" ON "FotoDaMeta"("userId", "profileId");

ALTER TABLE "FotoDaMeta" ADD CONSTRAINT "FotoDaMeta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FotoDaMeta" ADD CONSTRAINT "FotoDaMeta_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
