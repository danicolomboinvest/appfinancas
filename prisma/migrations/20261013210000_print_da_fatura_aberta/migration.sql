-- Print da fatura aberta (13/10/2026): marca o lote que veio de capturas de tela da fatura ainda
-- aberta. Só acrescenta uma coluna com padrão; nenhum dado existente muda.
ALTER TABLE "ImportBatch" ADD COLUMN "faturaAberta" BOOLEAN NOT NULL DEFAULT false;
