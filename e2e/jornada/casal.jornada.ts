import { expect, test, type Page } from "@playwright/test";
import { Caderno, testeDosAvisos, dia, exigirSemAchados, novaPagina, passo } from "./comum";
import path from "node:path";
import { abrirLancamento, entrar, importarArquivo, importarRespondendo, lancarAMao, pilula, trocarPerfil } from "./acoes";
import { conferirGastoPorCategoria, conferirLivre, definirMesAtual } from "./conferir";
import { lerOrcamento, lerResumo, lerTransacoes } from "./telas";
import { bate, brl, reais } from "./dinheiro";
import { BASE, SENHA } from "./config";

/**
 * O casal (Casal simples): a Bia (titular) convida o Caio; ele entra pelo link, lança um gasto da
 * casa e um "só meu". A Bia vê o da casa em todas as telas e não vê o "só meu".
 */
const OUT = { ano: 2026, mes: 10 };
const ARQ = (nome: string) => path.join(__dirname, "arquivos", nome);
const PERFIL = "casal";

async function gastoDe(p: Page, c: Caderno, chave: string) {
  return (await lerOrcamento(p, c, OUT)).categorias[chave]?.gasto ?? 0;
}

/** A tela do acerto: quanto eu mando (positivo) ou recebo (negativo), e a frase de cima. */
async function lerAcerto(p: Page) {
  await p.goto(`/mensal/foco/acerto?mes=${OUT.ano}-${OUT.mes}`);
  const sec = p.locator("[data-acerto-valor]").first();
  await sec.waitFor();
  return { euMando: Number(await sec.getAttribute("data-acerto-valor")), texto: (await sec.innerText()).replace(/\s+/g, " ") };
}

/** O cartão "Acerto do mês" do Resumo: o valor da pílula (ou "Quites"). */
async function lerAcertoNoResumo(p: Page) {
  await p.goto("/mensal/foco");
  const cartao = p.locator("[data-cartao-acerto]").first();
  await cartao.waitFor();
  const rotulo = (await cartao.getAttribute("aria-label")) ?? "";
  return { rotulo, valor: /Quites/.test(rotulo) ? 0 : reais(rotulo) };
}

test("Casal: o par lança e a titular vê o mesmo em todas as telas", async ({ browser, page: bia }) => {
  test.setTimeout(6 * 60_000);
  const c = new Caderno(PERFIL);
  await novaPagina(bia, c);
  definirMesAtual(OUT);
  const ctxCaio = await browser.newContext({ baseURL: BASE, viewport: { width: 375, height: 812 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const caio = await ctxCaio.newPage();
  await novaPagina(caio);
  let link = "";
  try {
    await dia(c, "2026-10-15 19:00", [bia, caio]);
    await passo(c, "Bia abre o app (retrato de partida)", async () => {
      await entrar(bia, "bia@exemplo.test");
      const { orc } = await conferirGastoPorCategoria(bia, c, OUT, "partida");
      await conferirLivre(bia, c, orc, "partida");
    });

    await passo(c, "Bia convida o Caio (Nós dois)", async () => {
      await trocarPerfil(bia, "Nós dois");
      await bia.goto("/divisao");
      await bia.getByRole("button", { name: /Convidar meu par/ }).first().click();
      const d = bia.getByRole("dialog", { name: "Convidar meu par" });
      await d.locator("input").first().fill("Caio");
      await expect(d.locator("[aria-live=polite]")).toContainText("/par/", { timeout: 20_000 });
      const curto = (await d.locator("[aria-live=polite]").textContent()) ?? "";
      link = curto.slice(curto.indexOf("/par/"));
      await d.getByRole("button", { name: "Fechar" }).click();
    });

    await passo(c, "Caio entra pelo link", async () => {
      await caio.goto(link);
      await caio.getByRole("button", { name: "Continuar com e-mail" }).click();
      const nome = caio.getByLabel("Seu nome");
      if (await nome.count()) await nome.fill("Caio");
      await caio.getByLabel("E-mail").fill("caio@exemplo.test");
      await caio.locator("#campo-senha").fill(SENHA);
      await caio.getByText("Aceito os termos do Nós dois").click();
      await caio.getByRole("button", { name: "Entrar no Nós dois" }).click();
      await caio.waitForURL((u) => !/\/par\//.test(u.pathname), { timeout: 60_000 });
      await caio.waitForLoadState("networkidle").catch(() => undefined);
      // O tutorial do casal ou o aviso da mudança, se aparecer: "Agora não"/"Pular".
      for (const nome of ["Agora não", "Pular"]) {
        const b = caio.getByRole("button", { name: nome });
        if (await b.count()) await b.first().click().catch(() => undefined);
      }
    });

    await dia(c, "2026-10-16 18:30", [bia, caio]);
    let alimAntes = 0;
    let lazerAntes = 0;
    await passo(c, "Caio lança Mercado R$ 200 (da casa)", async () => {
      await trocarPerfil(bia, "Pessoal");
      alimAntes = await gastoDe(bia, c, "ALIMENTACAO");
      lazerAntes = await gastoDe(bia, c, "LAZER");
      await lancarAMao(caio, { valor: 200, categoria: "Alimentação", descricao: "Mercado do Caio" });
      const t = await lerTransacoes(bia, c, OUT);
      if (!t.linhas.some((l) => l.descricao.startsWith("Mercado do Caio"))) await c.anotar(bia, { tipo: "sumiu", telaDeOrigem: "Caio (Digitar)", telaErrada: "Transações da Bia", esperado: "Mercado do Caio na lista da Bia", visto: "não aparece" });
      const depois = await gastoDe(bia, c, "ALIMENTACAO");
      if (!bate(depois - alimAntes, 200)) await c.anotar(bia, { tipo: "numero", telaDeOrigem: "Caio (Digitar)", telaErrada: "Orçamento da Bia", esperado: `Alimentação ${brl(alimAntes + 200)}`, visto: brl(depois) });
      const { orc } = await conferirGastoPorCategoria(bia, c, OUT, "caio mercado");
      await conferirLivre(bia, c, orc, "caio mercado");
      const r = await lerResumo(bia, c);
      test.info().annotations.push({ type: "Resumo da Bia", description: `${r.heroi} | ${r.sugestao?.texto ?? ""}` });
      // E o Caio vê o mesmo nas telas dele.
      await conferirGastoPorCategoria(caio, c, OUT, "caio mercado (telas do Caio)");
    });

    await passo(c, "Caio lança Presente R$ 90 e marca Só meu", async () => {
      await lancarAMao(caio, { valor: 90, categoria: "Lazer", descricao: "Presente da irmã" });
      await abrirLancamento(caio, OUT.ano, OUT.mes, "Presente da irmã");
      const d = caio.getByRole("dialog");
      // O interruptor "Só meu" (o "Meu" de "De quem é?" é outra coisa: fica no acerto se o par pagou).
      await d.getByRole("switch", { name: /Só meu/ }).first().click();
      await pilula(caio, /./).waitFor({ timeout: 5_000 }).catch(() => undefined);
      await caio.keyboard.press("Escape");
      await caio.waitForTimeout(800);
      const t = await lerTransacoes(bia, c, OUT);
      if (t.linhas.some((l) => l.descricao.startsWith("Presente da irmã"))) await c.anotar(bia, { tipo: "numero", telaDeOrigem: "Caio (Só meu)", telaErrada: "Transações da Bia", esperado: "o \"só meu\" do Caio fora da lista dela", visto: "aparece" });
      const lazer = await gastoDe(bia, c, "LAZER");
      if (!bate(lazer, lazerAntes)) await c.anotar(bia, { tipo: "numero", telaDeOrigem: "Caio (Só meu)", telaErrada: "Orçamento da Bia", esperado: `Lazer ${brl(lazerAntes)} (sem o só meu)`, visto: brl(lazer) });
      await conferirGastoPorCategoria(bia, c, OUT, "só meu");
      await conferirGastoPorCategoria(caio, c, OUT, "só meu (telas do Caio)");
    });

    await passo(c, "Bia lança Feira R$ 300 da casa que o Caio pagou, 60/40", async () => {
      const antes = await lerAcerto(bia);
      await lancarAMao(bia, { valor: 300, categoria: "Alimentação", descricao: "Feira da semana", casal: { deQuem: "Da casa", pagou: "Caio", parte: 60 } });
      // A Bia fica com 60% (R$ 180) de um gasto que o Caio pagou: ela passa a mandar R$ 180 a mais.
      const daBia = await lerAcerto(bia);
      const doCaio = await lerAcerto(caio);
      const esperado = Math.round((antes.euMando + 180) * 100) / 100;
      if (!bate(daBia.euMando, esperado, 0.01)) await c.anotar(bia, { tipo: "numero", telaDeOrigem: "Bia (Digitar)", telaErrada: "Acerto da Bia", esperado: `manda ${brl(esperado)}`, visto: `${brl(daBia.euMando)} (${daBia.texto})` });
      if (!bate(doCaio.euMando, -daBia.euMando, 0.01)) await c.anotar(caio, { tipo: "numero", telaDeOrigem: "Bia (Digitar)", telaErrada: "Acerto do Caio", esperado: `o contrário da Bia: ${brl(-daBia.euMando)}`, visto: `${brl(doCaio.euMando)} (${doCaio.texto})` });
      const lado = (v: number) => (Math.round(Math.abs(v)) < 1 ? "Quites" : v > 0 ? "manda" : "recebe");
      if (lado(daBia.euMando) !== "Quites" && !/Você manda para Caio|Caio manda para você/.test(daBia.texto)) await c.anotar(bia, { tipo: "texto", telaDeOrigem: "Bia (Digitar)", telaErrada: "Acerto da Bia", esperado: "quem manda para quem", visto: daBia.texto });
      // O Resumo dos dois mostra o mesmo número do acerto, arredondado.
      for (const [p, quem, valor] of [[bia, "Bia", daBia.euMando], [caio, "Caio", doCaio.euMando]] as const) {
        const r = await lerAcertoNoResumo(p);
        const certo = Math.round(Math.abs(valor)) < 1 ? 0 : Math.round(Math.abs(valor));
        if (!bate(r.valor, certo, 0.01)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Bia (Digitar)", telaErrada: `Resumo ${quem === "Bia" ? "da Bia" : "do Caio"}`, esperado: `Acerto do mês ${brl(certo)}`, visto: r.rotulo });
      }
      // Na lista dos dois, os selinhos: Da casa, Caio pagou, 60/40 (para o Caio, 40/60).
      for (const [p, quem, divisao] of [[bia, "Bia", "60/40"], [caio, "Caio", "40/60"]] as const) {
        await p.goto(`/mensal/${OUT.ano}/${OUT.mes}`);
        const selos = await p.locator("[data-linha-transacao]").filter({ hasText: "Feira da semana" }).first().locator("[data-selos-do-casal]").getAttribute("data-selos-do-casal").catch(() => null);
        if (selos !== `Da casa | Caio pagou | ${divisao}`) await c.anotar(p, { tipo: "texto", telaDeOrigem: "Bia (Digitar)", telaErrada: `Transações ${quem === "Bia" ? "da Bia" : "do Caio"}`, esperado: `Da casa | Caio pagou | ${divisao}`, visto: selos ?? "sem selos" });
      }
      test.info().annotations.push({ type: "Acerto depois da Feira", description: `Bia ${brl(daBia.euMando)} | Caio ${brl(doCaio.euMando)}` });
    });

    // 15/10/2026 (feedback de uma cliente): os dois sobem a mesma fatura do cartão. A Bia tem de ver
    // a pergunta "parece já estar no app" para as compras que o Caio já subiu, e nada em dobro (nem
    // no acerto). O "Presente da irmã" é o "Só meu" do Caio: nunca vira pergunta para a Bia (a
    // pergunta revelaria o lançamento), então são 3 perguntas, não 4.
    await dia(c, "2026-10-17 20:00", [bia, caio]);
    await passo(c, "os dois sobem a mesma fatura do cartão", async () => {
      await importarArquivo(caio, ARQ("casal-fatura-nubank.csv"));
      const antes = await lerTransacoes(bia, c, OUT);
      const titulo = await importarRespondendo(bia, ARQ("casal-fatura-nubank.csv"), "Não importar");
      if (titulo !== "3 parecem já estar no app") await c.anotar(bia, { tipo: "tela", telaDeOrigem: "fatura do Caio + a mesma da Bia", telaErrada: "Importação da Bia", esperado: "3 parecem já estar no app", visto: titulo ?? "não perguntou" });
      const depois = await lerTransacoes(bia, c, OUT);
      for (const nome of [/Padaria do Bairro/i, /Farmacia Pague Menos/i, /Cinemark/i]) {
        const n = depois.linhas.filter((l) => nome.test(l.descricao)).length;
        const n0 = antes.linhas.filter((l) => nome.test(l.descricao)).length;
        if (n !== 1 || n0 !== 1) await c.anotar(bia, { tipo: "numero", telaDeOrigem: "a mesma fatura pelos dois", telaErrada: "Transações da Bia", esperado: `${nome.source} uma vez (a do Caio)`, visto: `${n0} antes, ${n} depois` });
      }
      const { orc } = await conferirGastoPorCategoria(bia, c, OUT, "mesma fatura");
      await conferirLivre(bia, c, orc, "mesma fatura");
      await conferirGastoPorCategoria(caio, c, OUT, "mesma fatura (telas do Caio)");
    });
  } finally {
    c.salvar();
    await ctxCaio.close();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});

// Avisos de Casal que o módulo de avisos ainda não resolve: nenhum nesta rodada (ver o relatório).
testeDosAvisos(PERFIL, []);
