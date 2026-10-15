-- A guia do MEI pela atividade (15/10/2026). As partes da guia de 2026, conferidas na Receita Federal
-- (Portal do Simples Nacional, notícia de 02/01/2026): INSS de 5% do salário mínimo (R$ 1.621,00,
-- Decreto nº 12.797, de 23/12/2025), ICMS de R$ 1,00 (comércio ou indústria) e ISS de R$ 5,00
-- (serviço). Serviço R$ 86,05, comércio ou indústria R$ 82,05, comércio e serviço R$ 87,05.
-- Só dados: a tabela já existe. A chave mei_das_servico continua (fica de reserva sem as partes).
INSERT INTO "ParametroLegal" ("id", "chave", "valor", "vigenteDesde", "fonte", "fonteData") VALUES
  ('pl_mei_salario_minimo_2026', 'mei_salario_minimo', 1621.00, '2026-01-01', 'Receita Federal, DAS do MEI 2026 (salário mínimo do Decreto 12.797/2025)', '2026-01-02'),
  ('pl_mei_inss_percentual_2026', 'mei_inss_percentual', 5.00, '2026-01-01', 'Receita Federal, DAS do MEI 2026 (INSS de 5% do salário mínimo)', '2026-01-02'),
  ('pl_mei_das_icms_2026', 'mei_das_icms', 1.00, '2026-01-01', 'Receita Federal, DAS do MEI 2026 (ICMS de comércio ou indústria)', '2026-01-02'),
  ('pl_mei_das_iss_2026', 'mei_das_iss', 5.00, '2026-01-01', 'Receita Federal, DAS do MEI 2026 (ISS de serviço)', '2026-01-02')
ON CONFLICT DO NOTHING;
