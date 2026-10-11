-- Widget do iPhone (11/10/2026): a chave que a extensão usa para ler os números do widget.
-- Aditiva: tabela nova, nada muda nas que existem.
CREATE TABLE "TokenDoWidget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "aparelho" VARCHAR(64) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),

    CONSTRAINT "TokenDoWidget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TokenDoWidget_hash_key" ON "TokenDoWidget"("hash");
CREATE INDEX "TokenDoWidget_userId_aparelho_idx" ON "TokenDoWidget"("userId", "aparelho");

ALTER TABLE "TokenDoWidget" ADD CONSTRAINT "TokenDoWidget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
