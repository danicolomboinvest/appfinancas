-- Carteira da versão nova (11/10/2026). Aditiva: só colunas que aceitam nulo (ou têm padrão) e
-- uma tabela nova. Nada muda para quem já usa: sem valor, tudo continua automático.

-- Classificação escolhida por ela no detalhe do ativo ("Trocar"). Nulo = automático.
ALTER TABLE "Asset" ADD COLUMN "tipoEscolhido" VARCHAR(16);
ALTER TABLE "Asset" ADD COLUMN "ondeEscolhido" VARCHAR(16);

-- O perfil de investidora da estratégia (conservador, moderado, arrojado, personalizado).
ALTER TABLE "FinancialProfile" ADD COLUMN "perfilInvestidor" VARCHAR(16);

-- Assessoria: "Já abri minha conta" (confirmando) e o convite ocultado.
ALTER TABLE "User" ADD COLUMN "assessoriaEstado" VARCHAR(16);
ALTER TABLE "User" ADD COLUMN "assessoriaEstadoEm" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "assessoriaConviteOculto" BOOLEAN NOT NULL DEFAULT false;

-- Números de fora (Banco Central e Tesouro) com a fonte e a hora.
CREATE TABLE "IndicadorExterno" (
    "chave" VARCHAR(80) NOT NULL,
    "valor" DECIMAL(18,8) NOT NULL,
    "taxa" DECIMAL(12,6),
    "referenteA" DATE NOT NULL,
    "buscadoEm" TIMESTAMP(3) NOT NULL,
    "fonte" VARCHAR(80) NOT NULL,
    CONSTRAINT "IndicadorExterno_pkey" PRIMARY KEY ("chave")
);
