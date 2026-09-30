-- Confirmação do e-mail no cadastro. Aditiva: contas antigas ficam com nulo e continuam valendo.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
