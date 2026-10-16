import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { Caderno, dia, exigirSemAchados, novaPagina, passo } from "./comum";
import { digitado, entrar, lancarAMao, pularTutoriais } from "./acoes";
import { conferirTextoELayout } from "./telas";
import { URL_DO_BANCO } from "./config";
import { abrirCaixaLocal } from "./caixa-local";

/**
 * O plano da meta (16/10/2026): a Ana cria a meta "Viagem de verão" e toca em "Como vou juntar?",
 * marca 2 coisinhas, arrasta a régua do iFood, usa o plano e confere a meta com "Com plano" e o
 * aporte novo. No dia seguinte, um gasto no iFood perto do teto dispara o aviso a 75%, que chega
 * por e-mail (numa caixa SÓ LOCAL: JORNADA_SMTP_PORTA, ver caixa-local.ts).
 */
const PERFIL = "ana-plano";
const EMAIL = "ana@exemplo.test";
const META = "Viagem de verão";
const PORTA_SMTP = Number(process.env.JORNADA_SMTP_PORTA ?? 0);

async function doBanco<T>(f: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: `${URL_DO_BANCO}?connection_limit=1` });
  try {
    return await f(db);
  } finally {
    await db.$disconnect();
  }
}

async function valoresDaMetaNoBanco(id: string) {
  const g = await doBanco((db) => db.goal.findUniqueOrThrow({ where: { id }, select: { targetAmount: true, targetDate: true, monthlyContribution: true } }));
  return { alvo: Number(g.targetAmount), prazo: g.targetDate ? g.targetDate.toISOString().slice(0, 7) : null, porMes: Number(g.monthlyContribution ?? 0) };
}

const numero = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));

async function criarMetaComPlano(p: Page) {
  await p.goto("/planejamento/metas");
  await pularTutoriais(p);
  await p.locator('[data-guia="nova-meta"]').first().click();
  const d = p.getByRole("dialog", { name: "Nova meta" });
  await d.getByLabel("Nome da meta").fill(META);
  await d.getByRole("button", { name: "Continuar", exact: true }).click();
  await d.getByLabel("Quanto você precisa").fill(digitado(6000));
  for (let i = 0; i < 4; i++) {
    if (await d.getByRole("button", { name: "Criar meta", exact: true }).count()) break;
    await d.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await expect(d.getByRole("button", { name: "Como vou juntar?" })).toBeVisible();
  await d.getByRole("button", { name: "Como vou juntar?" }).click();
  await p.waitForURL(/\/planejamento\/metas\/[^/]+\/plano$/, { timeout: 30_000 });
}

test("Ana: monta o plano da meta, usa e recebe o aviso a 75%", async ({ page: p }) => {
  test.skip(!PORTA_SMTP, "Precisa da caixa local de e-mail (JORNADA_SMTP_PORTA).");
  const caixa = abrirCaixaLocal(PORTA_SMTP);
  const c = new Caderno(PERFIL);
  await novaPagina(p, c);
  let metaId = "";
  let porMes = 0;
  let antesDoPlano: { alvo: number; prazo: string | null; porMes: number } | null = null;
  try {
    await dia(c, "2026-10-15 09:00", [p]);
    await passo(c, "cria a meta e toca em Como vou juntar?", async () => {
      await entrar(p, EMAIL);
      await criarMetaComPlano(p);
      metaId = /metas\/([^/]+)\/plano/.exec(p.url())?.[1] ?? "";
      antesDoPlano = await valoresDaMetaNoBanco(metaId);
      await expect(p.getByText(/^Para chegar até /)).toBeVisible();
      await expect(p.getByText(/faltam/).first()).toBeVisible();
      await conferirTextoELayout(p, c, "Como vou juntar?");
    });

    await passo(c, "marca o iFood e a corrida, arrasta a régua do iFood", async () => {
      const ifood = p.locator('[data-coisinha="delivery:ifood"]');
      const corrida = p.locator('[data-coisinha="corrida"]');
      await expect(ifood).toBeVisible();
      await expect(corrida).toBeVisible();
      await ifood.locator("button[aria-pressed]").click();
      await corrida.locator("button[aria-pressed]").click();
      const regua = ifood.getByRole("slider", { name: /Quanto quer gastar com iFood/ });
      await expect(regua).toBeVisible();
      const antes = (await regua.getAttribute("aria-valuetext")) ?? "";
      expect(antes).toMatch(/economiza/);
      // A régua no teclado (o mesmo que o dedo): 3 passos para a esquerda = R$ 30 a menos.
      await regua.focus();
      for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowLeft");
      const depois = (await regua.getAttribute("aria-valuetext")) ?? "";
      expect(numero(depois.split(" por mês")[0])).toBe(numero(antes.split(" por mês")[0]) - 30);
      await expect(ifood).toContainText(/dá (uns|1|menos)/);
      await conferirTextoELayout(p, c, "Plano com a régua");
      // Não fechou? Escolhe o primeiro caminho (sempre há os dois quando sobra algum valor).
      const caminhos = p.getByRole("radiogroup", { name: /Não fechou/ }).getByRole("radio");
      if (await caminhos.count()) await caminhos.first().click();
      await p.getByRole("button", { name: "Usar esse plano" }).click();
      await expect(p.getByRole("heading", { name: "Seu plano" })).toBeVisible({ timeout: 30_000 });
      porMes = numero((await p.locator("[data-por-mes]").textContent()) ?? "");
      await conferirTextoELayout(p, c, "Combinado");
    });

    await passo(c, "a meta mostra Com plano e o aporte novo", async () => {
      await p.goto("/planejamento/metas");
      const selo = p.locator(`a[href="/planejamento/metas/${metaId}/plano"][data-com-plano]`);
      await expect(selo).toContainText("Com plano · 2 coisinhas");
      const meta = await doBanco((db) => db.goal.findUniqueOrThrow({ where: { id: metaId }, select: { monthlyContribution: true } }));
      if (Number(meta.monthlyContribution) !== porMes)
        await c.anotar(p, { tipo: "numero", telaDeOrigem: "Usar esse plano", telaErrada: "meta no banco", esperado: `R$ ${porMes} por mês`, visto: String(meta.monthlyContribution) });
      const cartao = p.locator(`#meta-${metaId}`);
      await expect(cartao).toContainText(/por mês/);
      const texto = ((await cartao.textContent()) ?? "").replace(/\s/g, " ");
      const esperado = `R$ ${porMes.toLocaleString("pt-BR")}`;
      if (!texto.includes(esperado)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Usar esse plano", telaErrada: "cartão da meta", esperado: `${esperado} por mês`, visto: texto });
      await conferirTextoELayout(p, c, "Metas com plano");
      await selo.click();
      await expect(p.getByRole("heading", { name: "Seu plano" })).toBeVisible();
    });

    await dia(c, "2026-10-16 10:00", [p]);
    await passo(c, "no dia seguinte, um iFood perto do teto: aviso a 75%", async () => {
      const plano = await doBanco((db) => db.decisao.findFirstOrThrow({ where: { tipo: "plano_da_meta", chave: metaId }, select: { dados: true } }));
      const itens = (plano.dados as { itens: { id: string; teto: number }[] }).itens;
      const teto = itens.find((i) => i.id === "delivery:ifood")?.teto ?? 0;
      expect(teto).toBeGreaterThan(0);
      // O que ela já gastou de iFood em outubro, para chegar a 75% e não passar de 100%.
      const ja = await doBanco(async (db) => {
        const linhas = await db.monthlyEntry.findMany({ where: { user: { email: EMAIL }, year: 2026, month: 10, category: "EXPENSE", description: { contains: "ifood", mode: "insensitive" } }, select: { amount: true } });
        return linhas.reduce((s, l) => s + Number(l.amount), 0);
      });
      const valor = Math.max(1, Math.ceil(teto * 0.8 - ja));
      await lancarAMao(p, { valor, categoria: "Alimentação", descricao: "iFood" });
      const chave = "plano:delivery:ifood:2026-10:75";
      await expect.poll(() => doBanco((db) => db.notificationLog.count({ where: { key: chave } })), { timeout: 30_000 }).toBe(1);
      await expect.poll(() => caixa.recebidos.filter((e) => e.para === EMAIL && /iFood/.test(e.assunto)).length, { timeout: 30_000, message: `caixa: ${JSON.stringify(caixa.recebidos.map((e) => [e.para, e.assunto]))}` }).toBe(1);
      // Outro gasto no mesmo mês não repete o aviso.
      await lancarAMao(p, { valor: 5, categoria: "Alimentação", descricao: "iFood" });
      await p.waitForTimeout(3000);
      expect(caixa.recebidos.filter((e) => /iFood/.test(e.assunto)).length).toBe(1);
    });

    await passo(c, "mudar e tirar o plano", async () => {
      await p.goto(`/planejamento/metas/${metaId}/plano`);
      await p.getByRole("link", { name: "Mudar o plano" }).click();
      await expect(p.locator('[data-coisinha="delivery:ifood"] button[aria-pressed="true"]')).toBeVisible();
      await p.goto(`/planejamento/metas/${metaId}/plano`);
      await p.getByRole("button", { name: "Tirar o plano" }).click();
      // Antes do segundo toque, a tela diz o que acontece com a meta.
      const depoisDoPlano = await valoresDaMetaNoBanco(metaId);
      const mudou = JSON.stringify(depoisDoPlano) !== JSON.stringify(antesDoPlano);
      if (mudou) await expect(p.locator("[data-aviso-tirar]")).toContainText("A meta volta para");
      await p.getByRole("button", { name: "Toque de novo para tirar o plano" }).click();
      await p.waitForURL(new RegExp(`/planejamento/metas/${metaId}$`), { timeout: 30_000 });
      await p.goto("/planejamento/metas");
      await expect(p.locator(`a[href="/planejamento/metas/${metaId}/plano"]`)).toHaveText(/Como vou juntar\?/);
      // Tirar o plano volta a meta aos valores de antes dele (ela não mexeu à mão).
      const final = await valoresDaMetaNoBanco(metaId);
      if (JSON.stringify(final) !== JSON.stringify(antesDoPlano))
        await c.anotar(p, { tipo: "numero", telaDeOrigem: "Tirar o plano", telaErrada: "meta no banco", esperado: JSON.stringify(antesDoPlano), visto: JSON.stringify(final) });
    });
  } finally {
    c.salvar();
    fs.writeFileSync(path.join(__dirname, "..", "..", ".jornada-resultados", "caixa-local.json"), JSON.stringify(caixa.recebidos.map((e) => ({ para: e.para, assunto: e.assunto, inicio: e.corpo.slice(0, 600) })), null, 1));
    await caixa.fechar();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});
