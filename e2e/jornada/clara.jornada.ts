import path from "node:path";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Caderno, conferirTelaVelha, dia, exigirSemAchados, novaPagina, passo, visitarPeloApp } from "./comum";
import { agoraNaoNoResumo, comecarComExtrato, criarConta, foiPontual, importarArquivo, lancarAMao, montarPlano } from "./acoes";
import { conferirAvisoDaCategoria, conferirGastoPorCategoria, conferirLivre, conferirMesPassado, conferirMetas, definirMesAtual } from "./conferir";
import { lerOrcamento, lerResumo } from "./telas";
import { bate, brl } from "./dinheiro";
import { URL_DO_BANCO } from "./config";
import { lerAchados, resumoDosAchados } from "./achados";

/**
 * Clara, conta nova do zero: comprou, cria a conta, começa pelo extrato, monta o plano, manda o
 * print da fatura aberta e usa o app por uma semana.
 */
const OUT = { ano: 2026, mes: 10 };
const SET = { ano: 2026, mes: 9 };
const PERFIL = "clara";
const ARQ = (n: string) => path.join(__dirname, "arquivos", n);

test("Clara: conta nova do zero, números e telas iguais em todo lugar", async ({ page: p }) => {
  test.setTimeout(6 * 60_000);
  const c = new Caderno(PERFIL);
  await novaPagina(p, c);
  definirMesAtual(OUT);
  try {
    await dia(c, "2026-10-15 07:30", [p]);
    await passo(c, "criar a conta e confirmar o e-mail", async () => {
      await criarConta(p, "Clara Teste", "clara@exemplo.test");
      // O link do e-mail: sem SMTP local, a confirmação é marcada no banco (o mesmo que o link faz).
      const db = new PrismaClient({ datasourceUrl: URL_DO_BANCO });
      await db.user.update({ where: { email: "clara@exemplo.test" }, data: { emailVerifiedAt: new Date() } });
      await db.$disconnect();
    });

    await passo(c, "primeiro extrato (setembro e outubro) pelo começo", async () => {
      await comecarComExtrato(p, ARQ("clara-extrato.csv"));
      const r = await lerResumo(p, c);
      // 2.276,10 de gasto em outubro até o dia 14 (o extrato).
      if (!bate(r.gastoNoHeroi, 2276)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "extrato", telaErrada: "Resumo (herói)", esperado: "R$ 2.276 saíram em outubro", visto: r.heroi });
      await conferirGastoPorCategoria(p, c, OUT, "primeiro extrato");
      await conferirMesPassado(p, c, SET, "primeiro extrato");
    });

    await passo(c, "montar o plano (Sugerir para mim)", async () => {
      await visitarPeloApp(p, ["Resumo", "Orçamento"]);
      if (await montarPlano(p)) await c.anotar(p, { tipo: "confirmar", telaDeOrigem: "Montar o plano", telaErrada: "Montar o plano (folha)", esperado: "a folha fecha depois de Usar este plano", visto: "fica em \"Salvando...\" (o plano foi gravado)" });
      await conferirTelaVelha(p, c, ["Orçamento", "Resumo"]);
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "plano");
      // "Sugerir para mim" fecha em zero: renda R$ 4.300 − 18% guardado = R$ 3.526 no plano.
      if (!bate(orc.plano, 3526, 2)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Montar o plano", telaErrada: "Orçamento (plano)", esperado: "R$ 3.526 (R$ 4.300 − 18%)", visto: brl(orc.plano) });
      await conferirLivre(p, c, orc, "plano");
    });

    await dia(c, "2026-10-16 12:10", [p]);
    await passo(c, "print da fatura aberta (cartão)", async () => {
      const antes = await lerOrcamento(p, c, OUT);
      await importarArquivo(p, ARQ("print-fatura-itau.png"));
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "print");
      const soma = (o: typeof orc) => Object.values(o.categorias).reduce((s, x) => s + x.gasto, 0);
      if (!(soma(orc) > soma(antes) + 50)) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "print da fatura", telaErrada: "Orçamento", esperado: "as compras do cartão somadas ao mês", visto: `${brl(soma(antes))} → ${brl(soma(orc))}` });
      await conferirLivre(p, c, orc, "print");
    });

    await passo(c, "lançar à mão: Padaria R$ 18,50", async () => {
      const antes = (await lerOrcamento(p, c, OUT)).categorias.ALIMENTACAO?.gasto ?? 0;
      await lancarAMao(p, { valor: 18.5, categoria: "Alimentação", descricao: "Padaria" });
      const depois = (await conferirGastoPorCategoria(p, c, OUT, "padaria")).orc.categorias.ALIMENTACAO?.gasto ?? 0;
      if (!bate(depois - antes, 18.5)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "Orçamento", esperado: `Alimentação ${brl(antes + 18.5)}`, visto: brl(depois) });
    });

    await dia(c, "2026-10-18 21:00", [p]);
    await passo(c, "Lazer passa do plano e ela diz que foi pontual", async () => {
      const orc = await lerOrcamento(p, c, OUT);
      const lazer = orc.categorias.LAZER;
      const falta = Math.max(0, (lazer?.plano ?? 0) - (lazer?.gasto ?? 0)) + 40;
      await lancarAMao(p, { valor: Math.ceil(falta), categoria: "Lazer", descricao: "Show de stand-up" });
      await conferirAvisoDaCategoria(p, c, "LAZER", "Lazer", true, "Lazer passou");
      await foiPontual(p, OUT.ano, "LAZER");
      await conferirAvisoDaCategoria(p, c, "LAZER", "Lazer", false, "Lazer pontual");
      await conferirGastoPorCategoria(p, c, OUT, "lazer pontual");
    });

    await passo(c, "Agora não na sugestão do Resumo", async () => {
      const r = await lerResumo(p, c);
      if (r.sugestao) {
        const texto = await agoraNaoNoResumo(p);
        const depois = await lerResumo(p, c);
        if (depois.sugestao?.texto === texto) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "Resumo (Agora não)", telaErrada: "Resumo", esperado: `"${texto}" some`, visto: "continua" });
      }
      await conferirMetas(p, c, "fim da semana");
    });
  } finally {
    c.salvar();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});

test("Clara: avisos respondidos somem em todas as telas (módulo de avisos)", async () => {
  const avisos = lerAchados(PERFIL).filter((a) => a.tipo === "aviso");
  expect(avisos, resumoDosAchados(avisos)).toEqual([]);
});
