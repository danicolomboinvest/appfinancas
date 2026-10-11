-- CreateTable
CREATE TABLE "MotivoDeCancelamento" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "motivo" VARCHAR(12) NOT NULL,
    "escolha" VARCHAR(16) NOT NULL,
    "via" VARCHAR(8) NOT NULL,
    "texto" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotivoDeCancelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoAntesDeCancelar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" VARCHAR(16) NOT NULL,
    "texto" VARCHAR(4000),
    "area" VARCHAR(20),
    "avisarEm" DATE,
    "estado" VARCHAR(8) NOT NULL DEFAULT 'aberto',
    "feitoEm" TIMESTAMP(3),
    "feitoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoAntesDeCancelar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MotivoDeCancelamento_createdAt_idx" ON "MotivoDeCancelamento"("createdAt");

-- CreateIndex
CREATE INDEX "MotivoDeCancelamento_userId_idx" ON "MotivoDeCancelamento"("userId");

-- CreateIndex
CREATE INDEX "PedidoAntesDeCancelar_estado_createdAt_idx" ON "PedidoAntesDeCancelar"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "PedidoAntesDeCancelar_userId_tipo_idx" ON "PedidoAntesDeCancelar"("userId", "tipo");

-- AddForeignKey
ALTER TABLE "MotivoDeCancelamento" ADD CONSTRAINT "MotivoDeCancelamento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoAntesDeCancelar" ADD CONSTRAINT "PedidoAntesDeCancelar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
