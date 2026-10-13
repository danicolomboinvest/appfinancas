-- Casal simples (13/10/2026, casal-simples-proposta.html). Só acrescenta: nenhuma coluna sai,
-- nenhum dado muda. Toda casa que já existe continua no modelo "nos-dois" até a migração própria
-- (scripts/migrar-casal-simples.ts) passar ela para o "simples".

-- O vínculo do par (MembroCasal) ganha a chave que decide o modelo da casa e os dois Pessoais.
ALTER TABLE "MembroCasal" ADD COLUMN "modelo" VARCHAR(10) NOT NULL DEFAULT 'nos-dois';
ALTER TABLE "MembroCasal" ADD COLUMN "perfilTitularId" TEXT;
ALTER TABLE "MembroCasal" ADD COLUMN "perfilParId" TEXT;
ALTER TABLE "MembroCasal" ADD COLUMN "migradoEm" TIMESTAMP(3);
ALTER TABLE "MembroCasal" ADD COLUMN "migracao" JSONB;

-- "Mostrar para <par>" por conta: desligado = os lotes daquela conta ficam escondidos do par.
ALTER TABLE "ImportBatch" ADD COLUMN "ocultoDoPar" BOOLEAN NOT NULL DEFAULT false;

-- A sessão procura a casa simples de quem entra (como par ou como titular).
CREATE INDEX "MembroCasal_modelo_idx" ON "MembroCasal"("modelo") WHERE "saiuEm" IS NULL;
