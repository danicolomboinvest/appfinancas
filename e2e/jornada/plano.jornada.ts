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
const MESMO = "Mesmo número";
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

async function criarMetaComPlano(p: Page, valor = 6000) {
  await p.goto("/planejamento/metas");
  await pularTutoriais(p);
  await p.locator('[data-guia="nova-meta"]').first().click();
  const d = p.getByRole("dialog", { name: "Nova meta" });
  await d.getByLabel("Nome da meta").fill(META);
  await d.getByRole("button", { name: "Continuar", exact: true }).click();
  await d.getByLabel("Quanto você precisa").fill(digitado(valor));
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
  let fonteId = "";
  let fonteAntes = 0;
  try {
    await dia(c, "2026-10-15 09:00", [p]);
    await passo(c, "mesmo número em todas as telas: o por mês da meta", async () => {
      await entrar(p, EMAIL);
      // A meta nova pela folha: o "Guardar R$ X por mês" do último passo é o número de todas as telas.
      await p.goto("/planejamento/metas");
      await pularTutoriais(p);
      await p.locator('[data-guia="nova-meta"]').first().click();
      const d = p.getByRole("dialog", { name: "Nova meta" });
      await d.getByLabel("Nome da meta").fill(MESMO);
      await d.getByRole("button", { name: "Continuar", exact: true }).click();
      await d.getByLabel("Quanto você precisa").fill(digitado(5000));
      for (let i = 0; i < 4; i++) {
        if (await d.getByRole("button", { name: "Criar meta", exact: true }).count()) break;
        await d.getByRole("button", { name: "Continuar", exact: true }).click();
      }
      const naFolha = numero((await d.locator("[data-folha-por-mes]").textContent())?.match(/R\$\s?[\d.,]+/)?.[0] ?? "");
      expect(naFolha).toBeGreaterThan(0);
      await d.getByRole("button", { name: "Criar meta", exact: true }).click();
      await expect(d).toBeHidden({ timeout: 20_000 });
      const meta = await doBanco((db) => db.goal.findFirstOrThrow({ where: { name: MESMO, user: { email: EMAIL } }, select: { id: true, monthlyContribution: true } }));
      const valor = new RegExp(`R\\$\\s?${naFolha.toLocaleString("pt-BR")}(?![\\d,])`);
      const telas: [string, string][] = [];
      telas.push(["banco (o que a meta grava)", `R$ ${Number(meta.monthlyContribution)}`]);
      await p.goto("/planejamento/metas");
      telas.push(["cartão da meta", (await p.locator(`#meta-${meta.id}`).textContent()) ?? ""]);
      // O detalhe só mostra o por mês quando pergunta o aporte do mês (sai da mesma conta, testada em
      // meses-do-prazo.test.ts); aqui ele pergunta outra coisa, então fica de fora.
      // A Ana guarda menos do que as metas pedem: no "Como vou juntar?" faltam os R$ X inteiros.
      await p.goto(`/planejamento/metas/${meta.id}/plano`);
      await expect(p.getByText(/^Para chegar até /)).toBeVisible();
      telas.push(["Como vou juntar?", await p.locator("[data-plano]").innerText()]);
      for (const [tela, texto] of telas) {
        if (!valor.test(texto.replace(/\s/g, " ").replace(/R\$ /g, "R$ ")))
          await c.anotar(p, { tipo: "numero", telaDeOrigem: "folha Nova meta", telaErrada: tela, esperado: `R$ ${naFolha} por mês (o mesmo da folha)`, visto: texto.replace(/\s+/g, " ").slice(0, 160) });
      }
      if (Number(meta.monthlyContribution) !== naFolha) await c.anotar(p, { tipo: "numero", telaDeOrigem: "folha Nova meta", telaErrada: "banco", esperado: String(naFolha), visto: String(meta.monthlyContribution) });
    });

    await passo(c, "cria a meta e toca em Como vou juntar?", async () => {
      // Primeiro ela tenta, volta e tenta de novo com outro valor (o que aconteceu com a Dani):
      // a meta só nasce no "Usar esse plano", então não fica nenhuma meta repetida.
      await criarMetaComPlano(p, 9000);
      await p.goBack();
      await p.waitForURL(/\/planejamento\/metas/);
      await criarMetaComPlano(p);
      const iguais = await doBanco((db) => db.goal.count({ where: { name: META, user: { email: EMAIL } } }));
      if (iguais !== 0) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Como vou juntar? (duas vezes)", telaErrada: "metas no banco", esperado: "nenhuma meta criada antes do Usar esse plano", visto: `${iguais} metas "${META}"` });
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
      // Para onde já vai o que ela guarda (a Ana tem Reserva, Europa e Carro): a Reserva com menos
      // de 3 meses fica, e de outra meta ela traz R$ 30 para esta.
      const jaGuarda = p.locator("[data-ja-guarda]");
      // A Ana guarda R$ 400 no orçamento e as metas dela já pedem bem mais: a tela diz as duas coisas.
      await expect(jaGuarda).toContainText(/Você guarda R\$\s?400 por mês/);
      await expect(jaGuarda.locator("[data-metas-pedem-mais]")).toContainText(/Suas metas já pedem R\$\s?[\d.]+ e você guarda R\$\s?400\./);
      await expect(jaGuarda).toContainText("A Reserva fica: ela ainda está com menos de 3 meses.");
      const trazer = jaGuarda.getByRole("slider", { name: "Trazer para esta meta" }).first();
      fonteId = (await trazer.locator("xpath=ancestor::*[@data-fonte][1]").getAttribute("data-fonte")) ?? "";
      fonteAntes = Number((await doBanco((db) => db.goal.findUniqueOrThrow({ where: { id: fonteId }, select: { monthlyContribution: true } }))).monthlyContribution);
      await trazer.focus();
      for (let i = 0; i < 3; i++) await p.keyboard.press("ArrowRight");
      await expect(jaGuarda).toContainText(/\+R\$\s?30 por mês para esta meta · .+ (passa para|fica parada)/);
      await conferirTextoELayout(p, c, "Plano com a régua");
      // Não fechou? Escolhe o primeiro caminho (sempre há os dois quando sobra algum valor).
      const caminhos = p.getByRole("radiogroup", { name: /Não fechou/ }).getByRole("radio");
      if (await caminhos.count()) await caminhos.first().click();
      await p.getByRole("button", { name: "Usar esse plano" }).click();
      await expect(p.getByRole("heading", { name: "Seu plano" })).toBeVisible({ timeout: 30_000 });
      porMes = numero((await p.locator("[data-por-mes]").textContent()) ?? "");
      metaId = /metas\/([^/]+)\/plano/.exec(p.url())?.[1] ?? "";
      const gravado = await doBanco((db) => db.decisao.findFirstOrThrow({ where: { tipo: "plano_da_meta", chave: metaId }, select: { dados: true } }));
      antesDoPlano = (gravado.dados as { antes: { alvo: number; prazo: string | null; porMes: number } }).antes;
      await expect(p.locator("[data-trazidos]")).toContainText("+R$");
      const fonteDepois = Number((await doBanco((db) => db.goal.findUniqueOrThrow({ where: { id: fonteId }, select: { monthlyContribution: true } }))).monthlyContribution);
      if (fonteDepois !== fonteAntes - 30) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Trazer para esta meta", telaErrada: "a outra meta no banco", esperado: `R$ ${fonteAntes - 30} por mês`, visto: String(fonteDepois) });
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
      await expect(p.locator("[data-aviso-tirar]")).toContainText("volta para lá");
      await p.getByRole("button", { name: "Toque de novo para tirar o plano" }).click();
      await p.waitForURL(new RegExp(`/planejamento/metas/${metaId}$`), { timeout: 30_000 });
      await p.goto("/planejamento/metas");
      await expect(p.locator(`a[href="/planejamento/metas/${metaId}/plano"]`)).toHaveText(/Como vou juntar\?/);
      // Tirar o plano volta a meta aos valores de antes dele (ela não mexeu à mão).
      const final = await valoresDaMetaNoBanco(metaId);
      const fonteFinal = Number((await doBanco((db) => db.goal.findUniqueOrThrow({ where: { id: fonteId }, select: { monthlyContribution: true } }))).monthlyContribution);
      if (fonteFinal !== fonteAntes) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Tirar o plano", telaErrada: "a outra meta no banco", esperado: `R$ ${fonteAntes} por mês (devolvido)`, visto: String(fonteFinal) });
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
