-- "Tivemos uma mudança": a marca de já visto, por conta. Colunas novas e nulas: quem já usava o
-- app fica com nulo e vê o tutorial uma vez. Nada é apagado nem reescrito.
ALTER TABLE "User" ADD COLUMN "novidadesVersaoNova" TEXT;
ALTER TABLE "User" ADD COLUMN "novidadesVistasEm" TIMESTAMP(3);
