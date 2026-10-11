-- Análises (11/10/2026): preço do dia por ticker, gravado pelo cron de cotações.
-- Aditiva: tabela nova, nada muda nas que existem.
CREATE TABLE "PrecoDiario" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "preco" DECIMAL(18,6) NOT NULL,
    "moeda" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "fonte" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecoDiario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrecoDiario_ticker_data_key" ON "PrecoDiario"("ticker", "data");
CREATE INDEX "PrecoDiario_data_idx" ON "PrecoDiario"("data");
