@AGENTS.md

## Jornada de uma semana (teste de ponta a ponta)

`npm run test:jornada` imita uma semana real de uso e confere, depois de cada ação, todas as telas
que mostram o número ou o aviso que mudou (Resumo do mês e de um mês passado, Orçamento,
Transações, Gastos, Decidir, Posso comprar, Recorrentes, Metas, widget). Pega o erro do tipo "fiz
aqui, voltei ali e não mudou": número diferente entre telas, aviso respondido que não some, algo
que sumiu, "R$ NaN"/"undefined"/"1 lançamentos"/"-R$ 0", texto cortado, rolagem lateral e campo
coberto a 375 px, e tela velha (aberta pelo app logo depois da ação, sem recarregar).

- Tudo local: Postgres em `~/spi-local-pg` (porta 54329, `node start.mjs`) e o app em
  `next start -p 3317`. O script faz o build (~30 s), recria o banco `spi_jornada_teste` com as
  migrations e as contas de teste (`e2e/jornada/semear.ts`: Ana, Ateliê da Ana, Clara, Bia e Duda) e
  roda as quatro jornadas (Ana, conta nova da Clara, casal Bia + Caio e os números da Duda). Leva uns 14 minutos.
- A jornada dos números (`numeros.jornada.ts`, `conferirMatriz` em `conferir.ts`) confere cada número que
  aparece em mais de uma tela contra a soma da lista de Transações: gasto, entrou, guardado no mês e no ano,
  ficou com você, parcelas, Próximos meses, carteira e o "Falta guardar". Passa por "Não é parcela", fatura
  em CSV e em PDF (gerado na hora), fechar o mês e a virada de dezembro para janeiro. Só ela:
  `npm run test:jornada -- numeros.jornada` (o filtro "numeros" sozinho pega o caminho da worktree).
- Com um servidor já de pé na 3317 (com o relógio de teste), ele usa esse e pula o build:
  `JORNADA_MODO=dev sh e2e/jornada/servidor.sh` sobe um `next dev` com o relógio. Uma jornada só:
  `npm run test:jornada -- ana` (ou `clara`, `casal`).
- O dia é simulado em três lugares, só no teste: o Node do servidor (`relogio-de-teste.cjs`,
  carregado por `NODE_OPTIONS` em `servidor.sh`), o banco (`relogio-do-banco.sql`, gatilho que
  empurra o `createdAt`/`updatedAt` do Prisma para o dia simulado) e o navegador (`page.clock`).
  O código do app não sabe que isso existe.
- Resultado: `.jornada-resultados/` (achados em JSON por pessoa, prints, trace do Playwright).
  Achado de número, texto, tela ou "sumiu" derruba o teste. "decisao" (duas telas com regras
  diferentes de propósito) e "confirmar" (só no servidor local) vão para o relatório e não
  derrubam. Aviso é do módulo único de avisos (`src/lib/avisos/`): os conhecidos ficam na lista
  de `testeDosAvisos` de cada jornada, marcados como esperado-falhar.
- Relatório da primeira rodada: `~/Claude/estudo-apps-financas/jornada-relatorio.md`.
- Ao mudar uma tela, se o texto que a jornada lê mudar (rótulo de botão, "Plano de", "livres"),
  ajustar `e2e/jornada/telas.ts` ou `acoes.ts`. O Vitest ignora `e2e/`.
