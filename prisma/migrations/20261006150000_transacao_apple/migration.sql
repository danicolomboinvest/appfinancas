-- CreateTable
CREATE TABLE "TransacaoApple" (
    "transactionId" TEXT NOT NULL,
    "originalTransactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "precoCentavos" INTEGER,
    "moeda" TEXT,
    "precoDeTabela" BOOLEAN NOT NULL DEFAULT false,
    "compradaEm" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "reembolsadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransacaoApple_pkey" PRIMARY KEY ("transactionId")
);

-- CreateIndex
CREATE INDEX "TransacaoApple_compradaEm_idx" ON "TransacaoApple"("compradaEm");

-- As compras de 05 e 06/10/2026, de antes desta tabela: a primeira compra tem transactionId igual
-- ao originalTransactionId. O valor é o preço de tabela no Brasil (R$ 87,90 anual, R$ 19,90 mensal).
INSERT INTO "TransacaoApple" ("transactionId", "originalTransactionId", "productId", "precoCentavos", "moeda", "precoDeTabela", "compradaEm", "tipo", "ambiente", "reembolsadaEm", "updatedAt")
SELECT "originalTransactionId", "originalTransactionId", "productId",
       CASE "productId" WHEN 'com.danicolombo.spifinance.anual' THEN 8790 WHEN 'com.danicolombo.spifinance.mensal' THEN 1990 END,
       'BRL', true, "createdAt", 'compra', "ambiente", "revogadaEm", CURRENT_TIMESTAMP
  FROM "AssinaturaApple"
ON CONFLICT DO NOTHING;
