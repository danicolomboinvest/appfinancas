-- Boas-vindas (30/09/2026): quando saíram os lembretes de "crie sua conta" para quem comprou e
-- ainda não se cadastrou. Colunas novas e vazias: nada muda para quem já existe.
ALTER TABLE "AllowedEmail" ADD COLUMN "lembreteConta1Em" TIMESTAMP(3);
ALTER TABLE "AllowedEmail" ADD COLUMN "lembreteConta2Em" TIMESTAMP(3);
