-- Versão nova (11/10/2026): os temas passam a ser quatro (Padrão, Girly, Manifestação e Titânio).
-- Saem Minimalista, Disciplina, Sem filtro e Game. Cada perfil que usava um deles vai para o
-- substituto:
--   minimalista -> padrao      semfiltro -> padrao
--   disciplina  -> titanio     game      -> titanio
--
-- Só troca o texto da coluna; nada some. O código faz a mesma troca na leitura
-- (CHAVES_QUE_SAIRAM em src/lib/profiles/themes.ts), então a ordem entre o deploy e esta
-- migração não importa: com ou sem ela, ninguém abre o app quebrado.
UPDATE "FinancialProfile" SET "theme" = 'padrao' WHERE "theme" IN ('minimalista', 'semfiltro');
UPDATE "FinancialProfile" SET "theme" = 'titanio' WHERE "theme" IN ('disciplina', 'game');
