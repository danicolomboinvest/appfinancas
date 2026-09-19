-- Registra quando o app puxou conversa com a pessoa sobre um erro de importação, e como terminou.
-- Sem isto, o aviso repetiria a cada rodada do cron e a pessoa levaria a mesma mensagem todo dia.
ALTER TABLE "ImportDiagnostic" ADD COLUMN     "avisadoEm" TIMESTAMP(3),
ADD COLUMN     "avisoStatus" TEXT;
