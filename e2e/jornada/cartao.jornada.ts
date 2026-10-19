import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Caderno, dia, exigirSemAchados, novaPagina, passo, testeDosAvisos } from "./comum";
import { abrirLancamento, entrar, pilula, pularTutoriais } from "./acoes";
import { conferirTextoELayout, lerOrcamento, lerResumo, lerTransacoes } from "./telas";
import { conferirGastoPorCategoria, conferirLivre } from "./conferir";
import { textoVisivel } from "./texto";
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

/** O Postgres local é dividido com outras jornadas: "too many clients" espera e tenta de novo. */
async function lancadosNoCartao(): ReturnType<typeof lerLancadosNoCartao> {
  for (let i = 0; ; i++) {
    try {
      return await lerLancadosNoCartao();
    } catch (e) {
      if (i < 20 && /too many clients|Too many database connections/i.test(String(e))) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
}

async function lerLancadosNoCartao() {
  const db = new PrismaClient({ datasourceUrl: `${URL_DO_BANCO}?connection_limit=1` });
  try {
    const edu = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
    const cartao = await db.cartao.findFirstOrThrow({ where: { userId: edu.id } });
    const linhas = await db.monthlyEntry.findMany({ where: { userId: edu.id, cartaoId: cartao.id, category: "EXPENSE" } });
    return {
      cartao,
      linhas: linhas.map((l) => ({ id: l.id, year: l.year, month: l.month, entryDate: l.entryDate, amount: Number(l.amount), description: l.description, noCartao: l.noCartao, subcategory: l.subcategory, parcelamentoId: l.parcelamentoId })),
    };
  } finally {
    await db.$disconnect();
  }
}

/** As parcelas da compra parcelada à mão do Edu (com ou sem cartão: o Desfazer tem de devolver o cartão). */
async function parcelasNoBanco(): Promise<{ description: string | null; year: number; month: number; amount: number; cartaoId: string | null; parcelamentoId: string | null }[]> {
  for (let i = 0; ; i++) {
    const db = new PrismaClient({ datasourceUrl: `${URL_DO_BANCO}?connection_limit=1` });
    try {
      const linhas = await db.monthlyEntry.findMany({ where: { user: { email: EMAIL }, parcelamentoId: { not: null } }, orderBy: [{ year: "asc" }, { month: "asc" }] });
      return linhas.map((l) => ({ description: l.description, year: l.year, month: l.month, amount: Number(l.amount), cartaoId: l.cartaoId, parcelamentoId: l.parcelamentoId }));
    } catch (e) {
      if (i < 20 && /too many clients|Too many database connections/i.test(String(e))) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    } finally {
      await db.$disconnect();
    }
  }
}

/** O gasto de uma categoria-mãe no mês, somado direto do banco (o que todas as telas têm de mostrar). */
async function gastoNoBanco(parentCategory: string, year: number, month: number): Promise<number> {
  for (let i = 0; ; i++) {
    const db = new PrismaClient({ datasourceUrl: `${URL_DO_BANCO}?connection_limit=1` });
    try {
      const r = await db.monthlyEntry.aggregate({ where: { user: { email: EMAIL }, category: "EXPENSE", parentCategory: parentCategory as never, year, month }, _sum: { amount: true } });
      return Number(r._sum.amount ?? 0);
    } catch (e) {
      if (i < 20 && /too many clients|Too many database connections/i.test(String(e))) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    } finally {
      await db.$disconnect();
    }
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
      // Decisão da Dani (15/10/2026): o gasto no cartão conta no mês da fatura.
      await expect(d.locator("[data-conta-no-orcamento]")).toHaveText("Conta no orçamento de novembro");
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
      // O orçamento conta no mês da fatura (15/10/2026): a de 15/10 em novembro, a de 14/10 em outubro.
      for (const l of linhas) {
        const esperado = l.amount === 89.9 ? 11 : 10;
        if (l.year !== 2026 || l.month !== esperado || l.noCartao !== true)
          await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "mês do orçamento", esperado: `${esperado}/2026, no cartão`, visto: `${l.month}/${l.year}, noCartao ${l.noCartao}` });
      }
    });

    await passo(c, "a compra do dia do fechamento conta em novembro no Orçamento e no Resumo", async () => {
      const nov = { ano: 2026, mes: 11 };
      const orcNov = await lerOrcamento(p, c, nov, false);
      if (!bate(orcNov.categorias.LAZER?.gasto ?? 0, 89.9)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (cartão, 15/10)", telaErrada: "Orçamento de novembro", esperado: "Lazer R$ 89,90", visto: orcNov.categorias.LAZER?.texto ?? "sem Lazer" });
      const orcOut = await lerOrcamento(p, c, { ano: 2026, mes: 10 });
      if (!bate(orcOut.categorias.LAZER?.gasto ?? 0, 0)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (cartão, 15/10)", telaErrada: "Orçamento de outubro", esperado: "Lazer sem gasto (a compra é da fatura de novembro)", visto: orcOut.categorias.LAZER?.texto ?? "" });
      if (!bate(orcOut.categorias.ALIMENTACAO?.gasto ?? 0, 40)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (cartão, 14/10)", telaErrada: "Orçamento de outubro", esperado: "Alimentação R$ 40", visto: orcOut.categorias.ALIMENTACAO?.texto ?? "sem Alimentação" });
      const resumoNov = await lerResumo(p, c, nov);
      const texto = await textoVisivel(p);
      if (!/89,90|R\$\s?90\b/.test(`${resumoNov.heroi} ${texto}`)) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Digitar (cartão, 15/10)", telaErrada: "Resumo de novembro", esperado: "o gasto de R$ 89,90 em novembro", visto: resumoNov.heroi || "nada" });
      await conferirTextoELayout(p, c, "Resumo de novembro");
      await conferirGastoPorCategoria(p, c, nov, "cartão em novembro", { atual: false });
    });

    await passo(c, "fatura do Nubank importada: as compras vão para o cartão", async () => {
      await p.goto("/mensal/foco");
      await pularTutoriais(p);
      await p.getByRole("button", { name: "Registrar" }).first().click();
      await p.getByRole("dialog").getByText("Extrato ou fatura", { exact: true }).click();
      await p.locator("input[type=file]").first().setInputFiles(path.join(__dirname, "arquivos", "duda-fatura-nubank.csv"));
      await p.locator("[data-confirmacao-do-arquivo]").waitFor({ timeout: 90_000 });
      const oferta = p.locator("[data-cartao-da-fatura]");
      const textoDaOferta = (await oferta.count()) ? ((await oferta.first().textContent()) ?? "") : "";
      if (!/Cartão Nubank/.test(textoDaOferta)) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "fatura importada", telaErrada: "Conferência da fatura", esperado: "As compras vão para o Cartão Nubank.", visto: textoDaOferta || "nada" });
      await conferirTextoELayout(p, c, "Conferência da fatura com cartão");
      const pronto = p.getByRole("button", { name: /^Pronto, anotar/ });
      if (await pronto.count()) await pronto.click();
      else await p.getByRole("button", { name: /Pular e anotar/ }).click();
      await p.waitForTimeout(1500);
      const agoraNao = p.getByRole("button", { name: "Agora não" });
      if (await agoraNao.count()) await agoraNao.first().click().catch(() => undefined);
      await p.keyboard.press("Escape").catch(() => undefined);

      const { cartao, linhas } = await lancadosNoCartao();
      const daFatura = linhas.filter((l) => l.description && /Padaria Real|Posto Ipiranga|Loja de Tenis|Restaurante Sabor/.test(l.description));
      if (daFatura.length < 4) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "fatura importada", telaErrada: "lançamentos ligados ao cartão", esperado: "as 4 compras da fatura ligadas ao Cartão Nubank", visto: `${daFatura.length} ligadas` });
      await p.goto("/orcamento/cartao");
      const texto = await conferirTextoELayout(p, c, "Seu cartão depois da fatura");
      for (const chave of ["2026-10", "2026-11"]) {
        const total = totalDaFatura(cartao, linhas, chave);
        const nome = chave === "2026-10" ? "outubro" : "novembro";
        const valor = `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const linha = texto.split("\n").find((l) => l.startsWith(`Fatura de ${nome}:`))?.replace(/\s/g, " ") ?? "";
        if (!linha.includes(valor)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "fatura importada", telaErrada: "Seu cartão", esperado: `Fatura de ${nome}: ${valor} (soma dos lançamentos ligados)`, visto: linha || "não está" });
      }
    });

    await passo(c, "a fatura traz a compra do dia 15: a lançada à mão é reconhecida e não dobra", async () => {
      await p.goto("/mensal/foco");
      await pularTutoriais(p);
      await p.getByRole("button", { name: "Registrar" }).first().click();
      await p.getByRole("dialog").getByText("Extrato ou fatura", { exact: true }).click();
      await p.locator("input[type=file]").first().setInputFiles(path.join(__dirname, "arquivos", "edu-fatura-nubank.csv"));
      await p.locator("[data-confirmacao-do-arquivo]").waitFor({ timeout: 90_000 });
      const pronto = p.getByRole("button", { name: /^Pronto, anotar/ });
      if (await pronto.count()) await pronto.click();
      else await p.getByRole("button", { name: /Pular e anotar/ }).click();
      await p.waitForTimeout(1500);
      const agoraNao = p.getByRole("button", { name: "Agora não" });
      if (await agoraNao.count()) await agoraNao.first().click().catch(() => undefined);
      await p.keyboard.press("Escape").catch(() => undefined);
      // Todos os gastos de R$ 89,90 dela, ligados ao cartão ou não: a fatura não pode ter criado outro.
      const db = new PrismaClient({ datasourceUrl: `${URL_DO_BANCO}?connection_limit=1` });
      const cinema = (
        await db.monthlyEntry
          .findMany({ where: { user: { email: EMAIL }, category: "EXPENSE" }, select: { year: true, month: true, description: true, amount: true } })
          .finally(() => db.$disconnect())
      ).filter((l) => Math.abs(Number(l.amount) - 89.9) < 0.001);
      if (cinema.length !== 1 || cinema[0].year !== 2026 || cinema[0].month !== 11)
        await c.anotar(p, { tipo: "numero", telaDeOrigem: "fatura com a compra de 15/10", telaErrada: "lançamentos", esperado: "uma compra de R$ 89,90, em novembro", visto: cinema.map((l) => `${l.description ?? ""} ${l.month}/${l.year}`).join(" | ") || "nenhuma" });
      const orcNov = await lerOrcamento(p, c, { ano: 2026, mes: 11 }, false);
      if (!bate(orcNov.categorias.LAZER?.gasto ?? 0, 89.9)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "fatura com a compra de 15/10", telaErrada: "Orçamento de novembro", esperado: "Lazer R$ 89,90 (sem dobrar)", visto: orcNov.categorias.LAZER?.texto ?? "sem Lazer" });
    });

    // ---------------------------------------------------------------- 18/10/2026, lançamento à mão
    await passo(c, "apelido do cartão: Mudar nome ou dias, Roxinho", async () => {
      await p.goto("/orcamento/cartao");
      await pularTutoriais(p);
      await p.getByRole("link", { name: "Mudar nome ou dias" }).click();
      const campo = p.getByLabel("Como você chama este cartão?");
      await expect(campo).toHaveValue("");
      await expect(campo).toHaveAttribute("placeholder", "Nubank");
      await campo.fill("Roxinho");
      await expect(p.getByText("Cartão Roxinho", { exact: true })).toBeVisible();
      await conferirTextoELayout(p, c, "Mudar o cartão (apelido)");
      await p.getByRole("button", { name: "Salvar cartão" }).click();
      await p.waitForURL(/\/orcamento\/cartao$/);
      await expect(p.getByText("Cartão Roxinho", { exact: true })).toBeVisible();
      // Reabrir mostra o apelido preenchido (é por ali que ela renomeia).
      await p.getByRole("link", { name: "Mudar nome ou dias" }).click();
      await expect(p.getByLabel("Como você chama este cartão?")).toHaveValue("Roxinho");
      await p.goto("/orcamento/cartao");
    });

    await passo(c, "gasto à mão com subcategoria, valor pelo teclado do computador", async () => {
      const d = await abrirDigitar(p);
      await p.keyboard.type("205");
      await p.keyboard.press("Backspace");
      await p.keyboard.type("00");
      await expect(d.locator("[data-valor-digitado]")).toHaveAttribute("data-valor-digitado", "2000");
      await d.getByRole("button", { name: "Lazer", exact: true }).click();
      await d.getByRole("group", { name: "Subcategoria" }).getByRole("button", { name: "Cinema/Shows" }).click();
      await d.getByRole("button", { name: "Ontem", exact: true }).click();
      await d.getByRole("button", { name: /Outro jeito/ }).click();
      // Enter salva (o foco está num botão do Digitar: não o aperta, salva).
      await p.keyboard.press("Enter");
      await expect(d).toBeHidden({ timeout: 20_000 });
    });

    await passo(c, "compra parcelada: R$ 1.000 em 3x no Cartão Roxinho, pelo teclado", async () => {
      const d = await abrirDigitar(p);
      await p.keyboard.type("100000");
      await expect(d.locator("[data-valor-digitado]")).toHaveAttribute("data-valor-digitado", "100000");
      // O teclado da tela continua valendo junto.
      await d.getByRole("button", { name: "Apagar" }).click();
      await d.getByRole("button", { name: "0", exact: true }).click();
      await expect(d.locator("[data-valor-digitado]")).toHaveAttribute("data-valor-digitado", "100000");
      await d.getByRole("button", { name: "Lazer", exact: true }).click();
      await d.getByRole("group", { name: "Subcategoria" }).getByRole("button", { name: "Hobbies" }).click();
      await d.getByRole("button", { name: "Ontem", exact: true }).click();
      await d.getByRole("button", { name: /Cartão Roxinho/ }).click();
      await expect(d.locator("[data-vezes]")).toHaveText("À vista");
      await d.getByRole("button", { name: "Mais uma vez" }).click();
      await d.getByRole("button", { name: "Mais uma vez" }).click();
      await expect(d.locator("[data-vezes]")).toHaveText("3x");
      // Uma linha só (18/10/2026, a Dani): "3x de R$ 333,33 · até dezembro". Nada da 1ª com centavos nem do total.
      const linha = d.locator("[data-valor-da-parcela]");
      await expect(linha).toHaveText(/^3x de R\$\s?333,33 · até dezembro$/);
      await expect(linha).toHaveAttribute("data-ultima-parcela", "2026-12");
      await expect(d.getByText(/A 1ª de|Total da compra|Última na fatura/)).toHaveCount(0);
      // Parcelado e "Repetir todo mês" não vão juntos.
      await expect(d.getByRole("switch", { name: /Repetir todo mês/ })).toHaveCount(0);
      await conferirTextoELayout(p, c, "Digitar parcelado");
      await d.getByRole("button", { name: "Mais uma vez" }).focus();
      await p.keyboard.press("Enter");
      await expect(d).toBeHidden({ timeout: 20_000 });
    });

    await passo(c, "as 3 parcelas: uma por fatura, a 1ª com os centavos, ligadas", async () => {
      const { cartao, linhas } = await lancadosNoCartao();
      const parc = linhas.filter((l) => l.parcelamentoId).sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
      const visto = parc.map((l) => `${l.description} ${l.month}/${l.year} ${brl(l.amount)} ${l.subcategory ?? ""}`).join(" | ") || "nenhuma";
      const esperado = ["Hobbies (1/3) 10/2026 333,34 Hobbies", "Hobbies (2/3) 11/2026 333,33 Hobbies", "Hobbies (3/3) 12/2026 333,33 Hobbies"];
      const igual =
        parc.length === 3 &&
        new Set(parc.map((l) => l.parcelamentoId)).size === 1 &&
        parc.every((l, i) => `${l.description} ${l.month}/${l.year} ${l.amount.toFixed(2).replace(".", ",")} ${l.subcategory}` === esperado[i]);
      if (!igual) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (parcelado)", telaErrada: "lançamentos", esperado: esperado.join(" | "), visto });
      if (!bate(parc.reduce((s2, l) => s2 + l.amount, 0), 1000, 0.001)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (parcelado)", telaErrada: "soma das parcelas", esperado: "R$ 1.000,00", visto: brl(parc.reduce((s2, l) => s2 + l.amount, 0)) });
      // Seu cartão: cada fatura soma os lançamentos ligados (a parcela do mês dela, nunca o total).
      await p.goto("/orcamento/cartao");
      // As faturas chegam depois do load (a tela carrega em partes): ler antes dava "não está".
      await p.getByText(/^Fatura de /).first().waitFor({ timeout: 20_000 });
      const texto = await conferirTextoELayout(p, c, "Seu cartão com parcelas");
      for (const [chave, nome] of [["2026-10", "outubro"], ["2026-11", "novembro"], ["2026-12", "dezembro"]] as const) {
        const total = totalDaFatura(cartao, linhas, chave);
        const valor = `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const l = texto.split("\n").find((x) => x.startsWith(`Fatura de ${nome}:`))?.replace(/\s/g, " ") ?? "";
        if (!l.includes(valor)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (parcelado)", telaErrada: "Seu cartão", esperado: `Fatura de ${nome}: ${valor}`, visto: l || "não está" });
        const daParcela = parc.find((x) => `${x.year}-${String(x.month).padStart(2, "0")}` === chave);
        if (daParcela && totalDaFatura(cartao, [daParcela], chave) !== daParcela.amount)
          await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (parcelado)", telaErrada: `fatura de ${nome}`, esperado: `a parcela ${daParcela.description} nesta fatura`, visto: "em outra fatura" });
      }
    });

    await passo(c, "a parcela do mês bate no Orçamento, em Gastos, nas Transações e no Resumo", async () => {
      for (const mes of [10, 11, 12]) {
        const m = { ano: 2026, mes };
        const esperado = await gastoNoBanco("LAZER", 2026, mes);
        const { orc } = await conferirGastoPorCategoria(p, c, m, `parcelado ${mes}/2026`, { atual: mes === 10 });
        if (!bate(orc.categorias.LAZER?.gasto ?? 0, esperado))
          await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (parcelado)", telaErrada: `Orçamento ${mes}/2026`, esperado: `Lazer ${brl(esperado)} (só a parcela do mês)`, visto: orc.categorias.LAZER?.texto ?? "sem Lazer" });
        if (mes === 10) {
          // O livre do mês é um número só em todas as telas (regra da casa).
          await conferirLivre(p, c, orc, "parcelado");
          const resumo = await lerResumo(p, c);
          await conferirTextoELayout(p, c, "Resumo com parcela");
          if (/1\.000,00/.test(resumo.heroi)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar (parcelado)", telaErrada: "Resumo de outubro", esperado: "só a 1ª parcela (R$ 333,34)", visto: resumo.heroi });
        }
      }
    });

    await passo(c, "Transações: filtrar Lazer pela subcategoria Hobbies", async () => {
      await p.goto("/mensal/2026/10");
      await pularTutoriais(p);
      const linhasDaLista = p.locator("[data-linha-transacao]");
      await p.getByRole("button", { name: /^Categoria/ }).click();
      const folha = p.getByRole("dialog");
      await folha.getByRole("button", { name: "Lazer" }).click();
      const chips = folha.getByRole("group", { name: "Subcategorias de Lazer" });
      await expect(chips.getByRole("button", { name: "Hobbies" })).toBeVisible();
      await expect(chips.getByRole("button", { name: "Cinema/Shows" })).toBeVisible();
      await chips.getByRole("button", { name: "Hobbies" }).click();
      await conferirTextoELayout(p, c, "Folha Categorias com subcategorias");
      await folha.getByRole("button", { name: "Aplicar" }).click();
      await expect(folha).toBeHidden();
      const so = await linhasDaLista.allInnerTexts();
      if (so.length !== 1 || !/Hobbies \(1\/3\)/.test(so[0] ?? ""))
        await c.anotar(p, { tipo: "numero", telaDeOrigem: "filtro Lazer › Hobbies", telaErrada: "Transações 10/2026", esperado: "só a linha Hobbies (1/3)", visto: so.map((x) => x.replace(/\n/g, " ")).join(" | ") || "nenhuma" });
      // Tirar o Hobbies: volta a mostrar todo o Lazer, inclusive o Cinema/Shows.
      await p.getByRole("button", { name: "Tirar o filtro Hobbies" }).click();
      const todos = await linhasDaLista.allInnerTexts();
      if (!todos.some((x) => /Cinema\/Shows|R\$\s?20,00/.test(x)) || !todos.some((x) => /Hobbies/.test(x)))
        await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "filtro Lazer", telaErrada: "Transações 10/2026", esperado: "o Cinema/Shows e o Hobbies (1/3)", visto: todos.map((x) => x.replace(/\n/g, " ")).join(" | ") || "nenhuma" });
    });

    // ---------------------------------------------------------------- 18/10/2026, apagar parcelas
    await passo(c, "apagar a 2ª parcela com \"Esta e as próximas\": sobra só a 1ª em todas as telas", async () => {
      const apagarA2a = async () => {
        await abrirLancamento(p, 2026, 11, "Hobbies (2/3)");
        await p.getByRole("dialog").getByRole("button", { name: "Remover", exact: true }).click();
        const pergunta = p.getByRole("dialog", { name: "Apagar parcela" });
        await expect(pergunta.getByRole("button", { name: "Só esta", exact: true })).toBeVisible();
        await conferirTextoELayout(p, c, "Apagar parcela");
        await pergunta.getByRole("button", { name: "Esta e as próximas", exact: true }).click();
        const t = pilula(p, "2 apagados");
        await t.waitFor({ timeout: 15_000 });
        return t;
      };
      const soA1a = async (quando: string) => {
        const sobra = await parcelasNoBanco();
        const visto = sobra.map((l) => `${l.description} ${l.month}/${l.year}`).join(" | ") || "nenhuma";
        if (sobra.length !== 1 || sobra[0].description !== "Hobbies (1/3)") await c.anotar(p, { tipo: "numero", telaDeOrigem: `Esta e as próximas (${quando})`, telaErrada: "lançamentos", esperado: "só Hobbies (1/3)", visto });
      };

      // 1) Apaga e desfaz: as duas voltam, no cartão (na fatura certa).
      const t = await apagarA2a();
      await soA1a("antes do Desfazer");
      await t.getByRole("button", { name: "Desfazer" }).click();
      await expect.poll(async () => (await parcelasNoBanco()).length, { timeout: 15_000 }).toBe(3);
      const voltaram = await parcelasNoBanco();
      if (new Set(voltaram.map((l) => l.parcelamentoId)).size !== 1 || voltaram.some((l) => !l.cartaoId))
        await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Desfazer de Esta e as próximas", telaErrada: "lançamentos", esperado: "as 3 parcelas da mesma compra, no cartão", visto: voltaram.map((l) => `${l.description} ${l.cartaoId ? "cartão" : "sem cartão"}`).join(" | ") });

      // 2) Apaga de novo, de verdade.
      await apagarA2a();
      await p.waitForLoadState("networkidle").catch(() => undefined);
      await soA1a("depois");

      // Transações: novembro e dezembro sem Hobbies; outubro com a 1ª.
      for (const mes of [10, 11, 12]) {
        const tr = await lerTransacoes(p, c, { ano: 2026, mes });
        const tem = tr.linhas.filter((l) => /Hobbies/.test(l.descricao)).map((l) => l.descricao);
        const esperado = mes === 10 ? ["Hobbies (1/3)"] : [];
        if (tem.join("|") !== esperado.join("|")) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Esta e as próximas", telaErrada: `Transações ${mes}/2026`, esperado: esperado.join(" | ") || "sem parcela", visto: tem.join(" | ") || "sem parcela" });
      }
      // Orçamento, Gastos e Resumo de cada mês batem com o banco (Lazer de nov e dez sem parcela).
      for (const mes of [10, 11, 12]) {
        const esperado = await gastoNoBanco("LAZER", 2026, mes);
        const { orc } = await conferirGastoPorCategoria(p, c, { ano: 2026, mes }, `apagou parcelas ${mes}/2026`, { atual: mes === 10 });
        if (!bate(orc.categorias.LAZER?.gasto ?? 0, esperado))
          await c.anotar(p, { tipo: "numero", telaDeOrigem: "Esta e as próximas", telaErrada: `Orçamento ${mes}/2026`, esperado: `Lazer ${brl(esperado)}`, visto: orc.categorias.LAZER?.texto ?? "sem Lazer" });
        if (mes === 10) await conferirLivre(p, c, orc, "apagou parcelas");
      }
      // Seu cartão: as faturas de novembro e dezembro sem as parcelas.
      const { cartao, linhas } = await lancadosNoCartao();
      await p.goto("/orcamento/cartao");
      // As faturas chegam depois do load (a tela carrega em partes): ler antes dava "não está".
      await p.getByText(/^Fatura de /).first().waitFor({ timeout: 20_000 });
      const texto = await conferirTextoELayout(p, c, "Seu cartão sem as parcelas");
      for (const [chave, nome] of [["2026-10", "outubro"], ["2026-11", "novembro"], ["2026-12", "dezembro"]] as const) {
        const total = totalDaFatura(cartao, linhas, chave);
        const valor = `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const l = texto.split("\n").find((x) => x.startsWith(`Fatura de ${nome}:`))?.replace(/\s/g, " ") ?? "";
        if (total > 0 && !l.includes(valor)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Esta e as próximas", telaErrada: "Seu cartão", esperado: `Fatura de ${nome}: ${valor}`, visto: l || "não está" });
        if (linhas.some((x) => /Hobbies \([23]\/3\)/.test(x.description ?? ""))) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Esta e as próximas", telaErrada: "Seu cartão", esperado: "sem a 2ª e a 3ª parcela", visto: "ainda ligadas ao cartão" });
      }
    });
  } finally {
    c.salvar();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});

testeDosAvisos(PERFIL, []);
