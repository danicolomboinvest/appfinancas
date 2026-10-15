import { expect, test } from "@playwright/test";
import { Caderno, conferirTelaVelha, dia, exigirSemAchados, novaPagina, passo, visitarPeloApp } from "./comum";
import { cobrirCom, entrar, foiPontual, lancarAMao, lancarPorVoz, prepararVoz } from "./acoes";
import { conferirAvisoDaCategoria, conferirGastoPorCategoria, conferirLivre, conferirMetas } from "./conferir";
import { lerResumo } from "./telas";
import { bate, brl } from "./dinheiro";

/**
 * A semana da Ana (a conta semeada de scripts/semear-local.ts): de quinta 15/10 a novembro.
 * Cada passo faz uma coisa como ela faz e confere todas as telas que mostram o que mudou.
 */
const OUT = { ano: 2026, mes: 10 };
const PERFIL = "ana";

test.describe.configure({ mode: "default" });

test("Ana: uma semana de uso, números e telas iguais em todo lugar", async ({ page: p }) => {
  test.setTimeout(8 * 60_000);
  const c = new Caderno(PERFIL);
  await novaPagina(p);
  await prepararVoz(p);
  try {
    await dia(c, "2026-10-15 09:00", [p]);
    await passo(c, "abrir o app (retrato de partida)", async () => {
      await entrar(p, "ana@exemplo.test");
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "partida");
      await conferirLivre(p, c, orc, "partida");
      await conferirMetas(p, c, "partida");
      await conferirAvisoDaCategoria(p, c, "SAUDE", "Saúde", true, "partida");
    });

    await passo(c, "lançar à mão Lazer R$ 120 (Show)", async () => {
      const antes = await conferirGastoPorCategoria(p, c, OUT, "antes do show");
      await visitarPeloApp(p, ["Resumo", "Orçamento", "Transações"]);
      await lancarAMao(p, { valor: 120, categoria: "Lazer", descricao: "Show" });
      await conferirTelaVelha(p, c, ["Orçamento", "Resumo", "Transações"]);
      const depois = await conferirGastoPorCategoria(p, c, OUT, "show");
      const a = antes.orc.categorias.LAZER?.gasto ?? 0;
      const d = depois.orc.categorias.LAZER?.gasto ?? 0;
      if (!bate(d - a, 120)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "Orçamento", esperado: `Lazer ${brl(a + 120)}`, visto: brl(d) });
      expect(depois.trans.linhas.some((l) => l.descricao === "Show")).toBe(true);
    });

    await passo(c, "lançar por voz \"gastei 45 no mercado\"", async () => {
      const antes = await conferirGastoPorCategoria(p, c, OUT, "antes da voz");
      await lancarPorVoz(p, "gastei 45 reais no mercado");
      const depois = await conferirGastoPorCategoria(p, c, OUT, "voz");
      const a = antes.orc.categorias.ALIMENTACAO?.gasto ?? 0;
      const d = depois.orc.categorias.ALIMENTACAO?.gasto ?? 0;
      if (!bate(d - a, 45)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Gravar áudio", telaErrada: "Orçamento", esperado: `Alimentação ${brl(a + 45)}`, visto: brl(d) });
    });

    await dia(c, "2026-10-16 20:00", [p]);
    await passo(c, "O que fazer? Saúde → cobrir com Outros", async () => {
      await visitarPeloApp(p, ["Resumo", "Orçamento"]);
      await cobrirCom(p, OUT.ano, "SAUDE", "Outros");
      await conferirTelaVelha(p, c, ["Resumo", "Orçamento"]);
      await conferirAvisoDaCategoria(p, c, "SAUDE", "Saúde", false, "cobrir Saúde");
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "cobrir Saúde");
      if (!bate(orc.plano, 7300)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "O que fazer? (cobrir)", telaErrada: "Orçamento (plano)", esperado: "plano total R$ 7.300 (cobrir não muda o total)", visto: brl(orc.plano) });
      await conferirLivre(p, c, orc, "cobrir Saúde");
    });

    await passo(c, "Lazer sobe (R$ 650 de show) e o Resumo avisa", async () => {
      await lancarAMao(p, { valor: 650, categoria: "Lazer", descricao: "Ingresso festival" });
      const r = await lerResumo(p, c);
      await conferirAvisoDaCategoria(p, c, "LAZER", "Lazer", true, "Lazer passou");
      test.info().annotations.push({ type: "resumo", description: `${r.sugestao?.tipo}: ${r.sugestao?.texto}` });
    });

    await passo(c, "O que fazer? Lazer → foi pontual", async () => {
      await foiPontual(p, OUT.ano, "LAZER");
      await conferirAvisoDaCategoria(p, c, "LAZER", "Lazer", false, "Lazer pontual");
    });
  } finally {
    c.salvar();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});
