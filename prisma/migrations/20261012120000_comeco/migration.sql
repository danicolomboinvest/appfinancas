-- O começo da versão nova: respostas e progresso do onboarding novo. Nulo para todo mundo que já
-- existe (não muda nada para quem já usa o app).
ALTER TABLE "User" ADD COLUMN "comeco" JSONB;
