-- Conta no exterior (07/10/2026): o ativo guarda a moeda em que está e o valor nela; os valores
-- de sempre continuam na moeda do app. Só acrescenta colunas: o código antigo continua funcionando.
ALTER TABLE "Asset" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
ADD COLUMN     "exchangeRate" DECIMAL(14,6),
ADD COLUMN     "nativeCurrentValue" DECIMAL(18,2),
ADD COLUMN     "nativeInvestedValue" DECIMAL(18,2);
