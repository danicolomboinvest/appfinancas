-- Rendimento da renda fixa e do Tesouro (15/10/2026): aditiva. Uma tabela nova com as séries do
-- Banco Central e colunas novas no Asset, todas nulas ou com padrão. Nada é apagado nem mudado.

CREATE TABLE "SerieIndice" (
    "id" TEXT NOT NULL,
    "indice" VARCHAR(12) NOT NULL,
    "data" DATE NOT NULL,
    "valor" DECIMAL(14,8) NOT NULL,
    "fonte" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerieIndice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SerieIndice_indice_data_key" ON "SerieIndice"("indice", "data");

ALTER TABLE "Asset" ADD COLUMN "rendimentoCalculadoEm" TIMESTAMP(3);
ALTER TABLE "Asset" ADD COLUMN "rendimentoReferenteA" DATE;
ALTER TABLE "Asset" ADD COLUMN "rendimentoComo" VARCHAR(12);
ALTER TABLE "Asset" ADD COLUMN "rendimentoEstimado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Asset" ADD COLUMN "valorInformado" DECIMAL(18,2);
ALTER TABLE "Asset" ADD COLUMN "valorInformadoEm" TIMESTAMP(3);
