-- Tela de boas-vindas (escolha de tipo e tema do primeiro perfil): quem já existia não passa por ela.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
UPDATE "User" SET "onboardedAt" = NOW();
