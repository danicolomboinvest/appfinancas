-- AlterTable
ALTER TABLE "AllowedEmail" ADD COLUMN     "canceladoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PedidoAntesDeCancelar" ADD COLUMN     "assunto" VARCHAR(12),
ADD COLUMN     "dados" JSONB,
ADD COLUMN     "emailEnviadoEm" TIMESTAMP(3);
