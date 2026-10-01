-- Preferências das categorias padrão por perfil (nome, ícone, oculta). Aditiva.
ALTER TABLE "FinancialProfile" ADD COLUMN "categorias" JSONB;
