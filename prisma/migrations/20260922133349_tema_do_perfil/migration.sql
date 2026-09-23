-- Tema do perfil: cada perfil passa a escolher um dos sete temas, no lugar da cor de destaque.
--
-- Só a coluna nova. O `migrate diff` também propôs derrubar 11 índices únicos antigos
-- (EmergencyFund_userId_key e companhia), que é a migração B — a que só pode rodar DEPOIS do
-- deploy, porque o app que está no ar agora faz upsert por esses índices e quebraria na hora
-- de salvar. Foram tirados daqui de propósito.
--
-- Aditiva e com valor padrão: nada some, nada precisa ser reescrito, e o app que está no ar
-- continua funcionando sem enxergar a coluna.
ALTER TABLE "FinancialProfile" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'padrao';
