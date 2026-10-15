import { expect, test, type Page } from "@playwright/test";
import { Caderno, testeDosAvisos, dia, exigirSemAchados, novaPagina, passo } from "./comum";
import { abrirLancamento, entrar, lancarAMao, pilula, trocarPerfil } from "./acoes";
import { conferirGastoPorCategoria, conferirLivre, definirMesAtual } from "./conferir";
import { lerOrcamento, lerResumo, lerTransacoes } from "./telas";
import { bate, brl } from "./dinheiro";
import { BASE, SENHA } from "./config";

/**
 * O casal (Casal simples): a Bia (titular) convida o Caio; ele entra pelo link, lança um gasto da
 * casa e um "só meu". A Bia vê o da casa em todas as telas e não vê o "só meu".
 */
const OUT = { ano: 2026, mes: 10 };
const PERFIL = "casal";

async function gastoDe(p: Page, c: Caderno, chave: string) {
  return (await lerOrcamento(p, c, OUT)).categorias[chave]?.gasto ?? 0;
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
      const soMeu = d.getByRole("switch", { name: /Só meu/ }).or(d.getByRole("button", { name: /^Meu$|Só meu/ }));
      await soMeu.first().click();
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
  } finally {
    c.salvar();
    await ctxCaio.close();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});

// Avisos de Casal que o módulo de avisos ainda não resolve: nenhum nesta rodada (ver o relatório).
testeDosAvisos(PERFIL, []);
