-- CreateTable
CREATE TABLE "DividendEvent" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "exDate" DATE NOT NULL,
    "paymentDate" DATE NOT NULL,
    "valuePerShare" DECIMAL(18,8) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DividendEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DividendEvent_ticker_idx" ON "DividendEvent"("ticker");

-- CreateIndex
CREATE INDEX "DividendEvent_paymentDate_idx" ON "DividendEvent"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "DividendEvent_ticker_kind_exDate_paymentDate_valuePerShare_key" ON "DividendEvent"("ticker", "kind", "exDate", "paymentDate", "valuePerShare");
