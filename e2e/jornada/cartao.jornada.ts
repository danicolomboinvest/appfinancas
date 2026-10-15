import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Caderno, dia, exigirSemAchados, novaPagina, passo, testeDosAvisos } from "./comum";
import { entrar, pularTutoriais } from "./acoes";
import { conferirTextoELayout } from "./telas";
import { bate, brl } from "./dinheiro";
import { URL_DO_BANCO } from "./config";
import { totalDaFatura } from "../../src/lib/planning/faturas-do-cartao";

/**
 * Edu cadastra o cartão (Nubank, fecha dia 15, vence dia 22) e lança no próprio dia do
 * fechamento (15/10): a compra vai para a fatura seguinte, a de novembro. A de ontem fica na de
 * outubro. Confere a linha do Digitar, o "Seu cartão" e que o total da fatura é a soma dos
 * lançamentos ligados ao cartão (a fonte única). O mês do orçamento continua o da compra.
 */
const PERFIL = "edu";
const EMAIL = "edu@exemplo.test";

async function abrirDigitar(p: Page) {
  if (!(await p.getByRole("button", { name: "Registrar" }).count())) await p.goto("/mensal/foco");
  await pularTutoriais(p);
  await p.getByRole("button", { name: "Registrar" }).first().click();
  await p.getByRole("dialog").getByText("Digitar", { exact: true }).click();
  return p.getByRole("dialog");
}

async function teclar(p: Page, valor: number) {
  const d = p.getByRole("dialog");
  for (const ch of String(Math.round(valor * 100))) await d.getByRole("button", { name: ch, exact: true }).click();
}

async function lancadosNoCartao() {
  const db = new PrismaClient({ datasourceUrl: URL_DO_BANCO });
  try {
    const edu = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const cartao = await db.cartao.findFirstOrThrow({ where: { userId: edu.id } });
    const linhas = await db.monthlyEntry.findMany({ where: { userId: edu.id, cartaoId: cartao.id, category: "EXPENSE" } });
    return { cartao, linhas: linhas.map((l) => ({ id: l.id, year: l.year, month: l.month, entryDate: l.entryDate, amount: Number(l.amount), description: l.description, noCartao: l.noCartao })) };
  } finally {
    await db.$disconnect();
  }
}

test("Edu: cadastra o cartão, compra no dia do fechamento e a fatura certa soma", async ({ page: p }) => {
  const c = new Caderno(PERFIL);
  await novaPagina(p, c);
  try {
    await dia(c, "2026-10-15 09:00", [p]);
    await passo(c, "cadastrar o cartão: Nubank, fecha 15, vence 22", async () => {
      await entrar(p, EMAIL);
      await p.goto("/orcamento/cartao");
      await pularTutoriais(p);
      await p.getByRole("link", { name: "Cadastrar cartão" }).click();
      await p.getByRole("button", { name: "Nubank" }).click();
      await expect(p.getByText("Está no app do Nubank, em Fatura.")).toBeVisible();
      await p.getByRole("button", { name: "Dia 15", exact: true }).click();
      await p.getByRole("button", { name: "Dia 22", exact: true }).click();
      await expect(p.getByText("Melhor dia para comprar: dia 15")).toBeVisible();
      // Hoje é o fechamento: já vai para a fatura de novembro. A véspera do próximo também; o próximo fechamento, dezembro.
      await expect(p.getByText(/Vai para a fatura de novembro, que vence 22\/nov/)).toBeVisible();
      await p.getByRole("button", { name: "14/11" }).click();
      await expect(p.getByText(/Vai para a fatura de novembro, que vence 22\/nov/)).toBeVisible();
      await p.getByRole("button", { name: "15/11" }).click();
      await expect(p.getByText(/Vai para a fatura de dezembro, que vence 22\/dez/)).toBeVisible();
      await conferirTextoELayout(p, c, "Cadastro do cartão");
      await p.getByRole("button", { name: "Salvar cartão" }).click();
      await p.waitForURL(/\/orcamento\/cartao$/);
      await expect(p.getByText("Cartão Nubank", { exact: true })).toBeVisible();
    });

    await passo(c, "compra no dia do fechamento: entra na fatura de novembro", async () => {
      const d = await abrirDigitar(p);
      await teclar(p, 89.9);
      await d.getByRole("button", { name: "Lazer", exact: true }).click();
      await d.getByRole("button", { name: /Cartão Nubank/ }).click();
      await expect(d.getByText("Entra na fatura de", { exact: false })).toContainText("novembro");
      // A linha muda com a data: ontem (14/10) ainda era a fatura de outubro.
      await d.getByRole("button", { name: "Ontem", exact: true }).click();
      await expect(d.getByText("Entra na fatura de", { exact: false })).toContainText("outubro");
      await d.getByRole("button", { name: "Hoje", exact: true }).click();
      await expect(d.getByText("Entra na fatura de", { exact: false })).toContainText("novembro");
      await expect(d.getByRole("button", { name: /Cartão Nubank/ })).toContainText("Fatura de novembro, vence 22/nov");
      await conferirTextoELayout(p, c, "Digitar com cartão");
      await d.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(d).toBeHidden({ timeout: 20_000 });
    });

    await passo(c, "compra de ontem no cartão: fatura de outubro", async () => {
      const d = await abrirDigitar(p);
      await teclar(p, 40);
      await d.getByRole("button", { name: "Alimentação", exact: true }).click();
      // O último cartão escolhido já vem marcado.
      await expect(d.getByRole("button", { name: /Cartão Nubank/ })).toHaveAttribute("aria-pressed", "true");
      await d.getByRole("button", { name: "Ontem", exact: true }).click();
      await expect(d.getByText("Entra na fatura de", { exact: false })).toContainText("outubro");
      await d.getByRole("button", { name: "Salvar", exact: true }).click();
      await expect(d).toBeHidden({ timeout: 20_000 });
    });

    await passo(c, "Seu cartão: o total de cada fatura é a soma dos lançamentos ligados", async () => {
      await p.goto("/orcamento/cartao");
      const { cartao, linhas } = await lancadosNoCartao();
      const nov = totalDaFatura(cartao, linhas, "2026-11");
      const out = totalDaFatura(cartao, linhas, "2026-10");
      if (!bate(nov, 89.9)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "fonte única (fatura de novembro)", esperado: "R$ 89,90", visto: brl(nov) });
      if (!bate(out, 40)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "fonte única (fatura de outubro)", esperado: "R$ 40,00", visto: brl(out) });
      const texto = await conferirTextoELayout(p, c, "Seu cartão");
      const linhaNov = /Fatura de novembro: R\$\s?89,90, vence 22\/nov/;
      const linhaOut = /Fatura de outubro: R\$\s?40,00, vence 22\/out/;
      if (!linhaNov.test(texto)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "Seu cartão", esperado: "Fatura de novembro: R$ 89,90, vence 22/nov", visto: texto.split("\n").filter((l) => /Fatura de/.test(l)).join(" | ") });
      if (!linhaOut.test(texto)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "Seu cartão", esperado: "Fatura de outubro: R$ 40,00, vence 22/out", visto: texto.split("\n").filter((l) => /Fatura de/.test(l)).join(" | ") });
      await expect(p.getByText("Melhor dia para comprar: dia 15")).toBeVisible();
      // O orçamento continua no mês da compra: as duas em outubro, as duas no cartão.
      for (const l of linhas) {
        if (l.year !== 2026 || l.month !== 10 || l.noCartao !== true)
          await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "mês do orçamento", esperado: "outubro de 2026, no cartão", visto: `${l.month}/${l.year}, noCartao ${l.noCartao}` });
      }
    });
  } finally {
    c.salvar();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});

testeDosAvisos(PERFIL, []);
