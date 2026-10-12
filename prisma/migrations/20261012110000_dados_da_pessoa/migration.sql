-- Meus dados e "Renda e dia do pagamento" (versão nova): só colunas novas e opcionais.
ALTER TABLE "User" ADD COLUMN "nascimento" DATE;
ALTER TABLE "User" ADD COLUMN "diaDoPagamento" INTEGER;
