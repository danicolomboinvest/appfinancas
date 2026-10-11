-- Empresa refeita (11/10/2026). Aditiva: colunas opcionais e uma tabela nova; nada muda no que existe.

-- O que o assistente da Empresa perguntou (tipo, o que faz, salário...). Nulo = ainda não rodou.
ALTER TABLE "FinancialProfile" ADD COLUMN "empresa" JSONB;

-- A venda do perfil Empresa: de quem, como pagou, quando o dinheiro cai e quando ela marcou "Recebi".
ALTER TABLE "MonthlyEntry" ADD COLUMN "cliente" VARCHAR(80);
ALTER TABLE "MonthlyEntry" ADD COLUMN "formaDeRecebimento" VARCHAR(10);
ALTER TABLE "MonthlyEntry" ADD COLUMN "recebeEm" DATE;
ALTER TABLE "MonthlyEntry" ADD COLUMN "recebidoEm" DATE;

-- Números legais com fonte e data (teto do MEI e guia). Revisar todo janeiro.
CREATE TABLE "ParametroLegal" (
    "id" TEXT NOT NULL,
    "chave" VARCHAR(48) NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "vigenteDesde" DATE NOT NULL,
    "fonte" VARCHAR(160) NOT NULL,
    "fonteData" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroLegal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParametroLegal_chave_vigenteDesde_key" ON "ParametroLegal"("chave", "vigenteDesde");

-- 2026: só os números conferidos. ME, EPP e autônoma ficam de fora até haver fonte.
INSERT INTO "ParametroLegal" ("id", "chave", "valor", "vigenteDesde", "fonte", "fonteData") VALUES
  ('pl_mei_teto_2026', 'mei_teto_anual', 81000.00, '2026-01-01', 'gov.br, Portal do Empreendedor, teto do MEI', '2026-09-16'),
  ('pl_mei_tolerancia_2026', 'mei_teto_tolerancia', 97200.00, '2026-01-01', 'gov.br, Portal do Empreendedor, teto do MEI', '2026-09-16'),
  ('pl_mei_das_servico_2026', 'mei_das_servico', 86.05, '2026-01-01', 'Receita Federal, DAS do MEI de serviço (R$ 81,05 de INSS e R$ 5 de ISS)', '2026-01-02'),
  ('pl_mei_das_dia_2026', 'mei_das_dia_vencimento', 20.00, '2026-01-01', 'Receita Federal, vencimento do DAS do MEI', '2026-01-02')
ON CONFLICT DO NOTHING;
