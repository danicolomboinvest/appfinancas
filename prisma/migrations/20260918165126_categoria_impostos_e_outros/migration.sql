-- "Financeiro" saiu: quase ninguém tem gasto financeiro relevante, e as 150 linhas que existiam
-- eram tarifa bancária, cartão e juros — ou seja, "Outros". Renomear preserva todas elas
-- (lançamentos, orçamentos e regras aprendidas) sem UPDATE nenhum.
ALTER TYPE "ParentCategory" RENAME VALUE 'FINANCEIRO' TO 'OUTROS';

-- Impostos vira categoria própria (IPTU, IPVA, IR, DARF).
ALTER TYPE "ParentCategory" ADD VALUE IF NOT EXISTS 'IMPOSTOS';
