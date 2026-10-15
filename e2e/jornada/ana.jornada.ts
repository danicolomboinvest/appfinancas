import path from "node:path";
import { expect, test } from "@playwright/test";
import { Caderno, testeDosAvisos, conferirTelaVelha, dia, exigirSemAchados, novaPagina, passo, visitarPeloApp } from "./comum";
import {
  agoraNaoNoResumo,
  aporteNaMeta,
  apagarLancamento,
  apagarMeta,
  cobrirCom,
  criarMeta,
  entrar,
  fecharMes,
  importarArquivo,
  lancarAMao,
  lancarPorVoz,
  lapis,
  moverParaPerfil,
  naoEAssinatura,
  pagueiNaConta,
  prepararVoz,
  tocarNaSugestao,
  tocarNoLembrar,
  tocarNoRaioX,
  trocarPerfil,
  vendiNaEmpresa,
} from "./acoes";
import {
  conferirAssinaturaNasTres,
  conferirAvisoDaCategoria,
  conferirGastoPorCategoria,
  conferirLivre,
  conferirMesPassado,
  conferirMetas,
  definirMesAtual,
} from "./conferir";
import { abrir, lerDecidir, lerLembreteNoRaioX, lerOrcamento, lerRecorrentes, lerResumo, lerTransacoes, lerWidget } from "./telas";
import { bate, brl } from "./dinheiro";
import { BASE } from "./config";
import { textoVisivel } from "./texto";

/**
 * A semana da Ana (a conta semeada de scripts/semear-local.ts), de quinta 15/10 a 04/11.
 * Cada passo faz uma coisa como ela faz e confere todas as telas que mostram o que mudou.
 */
const OUT = { ano: 2026, mes: 10 };
const SET = { ano: 2026, mes: 9 };
const NOV = { ano: 2026, mes: 11 };
const PERFIL = "ana";
const ARQ = (n: string) => path.join(__dirname, "arquivos", n);

test("Ana: uma semana de uso, números e telas iguais em todo lugar", async ({ page: p }) => {
  test.setTimeout(9 * 60_000);
  const c = new Caderno(PERFIL);
  await novaPagina(p, c);
  await prepararVoz(p);
  definirMesAtual(OUT);
  /** Muda em Lazer, conferida contra o Orçamento depois de cada passo. */
  const gastoDe = async (chave: string) => (await lerOrcamento(p, c, OUT)).categorias[chave]?.gasto ?? 0;
  const esperarDelta = async (chave: string, antes: number, delta: number, tela: string) => {
    const d = await gastoDe(chave);
    if (!bate(d - antes, delta)) await c.anotar(p, { tipo: "numero", telaDeOrigem: tela, telaErrada: "Orçamento", esperado: `${chave} ${brl(antes + delta)}`, visto: brl(d) });
  };
  try {
    // ------------------------------------------------------------------ quinta 15/10
    await dia(c, "2026-10-15 09:00", [p]);
    await passo(c, "abrir o app (retrato de partida)", async () => {
      await entrar(p, "ana@exemplo.test");
      await expect(p.locator("[data-periodo-nome]")).toContainText("15 out");
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "partida");
      await conferirLivre(p, c, orc, "partida");
      await conferirMetas(p, c, "partida");
      await conferirAvisoDaCategoria(p, c, "SAUDE", "Saúde", true, "partida");
      await conferirMesPassado(p, c, SET, "partida");
    });

    // Assinaturas (15/10/2026, "a última resposta vale em todo lugar"): marcar num lugar e
    // conferir os outros dois. Cada passo termina como começou, para o resto da semana não mudar.
    await passo(c, "Raio-X: Cancelar a Netflix vale em Recorrentes e no Dinheiro perdido", async () => {
      await conferirAssinaturaNasTres(p, c, "Netflix", { raiox: "aberto", recorrentes: "na lista", perdido: "Para conferir" }, "partida");
      await tocarNoRaioX(p, "Netflix", "Cancelar");
      await conferirAssinaturaNasTres(p, c, "Netflix", { raiox: "Vou cancelar", recorrentes: "para cancelar", perdido: "Não uso" }, "Raio-X");
    });

    // O lembrete de cancelar (15/10/2026): o botão grava de verdade e vira o selinho do dia em
    // que a Netflix cobra (dia 1 no extrato da Ana). Tocar de novo desliga.
    await passo(c, "Raio-X: Lembrar de cancelar liga o selinho da Netflix, e tocar de novo tira", async () => {
      await tocarNoLembrar(p);
      const visto = await lerLembreteNoRaioX(p, c, "Netflix");
      if (visto !== "lembrete dia 1") await c.anotar(p, { tipo: "texto", telaDeOrigem: "Raio-X (Lembrar)", telaErrada: "Raio-X", esperado: "lembrete dia 1", visto });
      expect(visto).toBe("lembrete dia 1");
      await tocarNoLembrar(p);
      expect(await lerLembreteNoRaioX(p, c, "Netflix")).toBe("sem lembrete");
    });

    await passo(c, "Raio-X: Desfazer a Netflix volta as três telas", async () => {
      await tocarNoRaioX(p, "Netflix", "Desfazer");
      await conferirAssinaturaNasTres(p, c, "Netflix", { raiox: "aberto", recorrentes: "na lista", perdido: "Para conferir" }, "Raio-X (Desfazer)");
    });

    await passo(c, "Recorrentes: Não é assinatura no iCloud some do Raio-X e do Dinheiro perdido, e o Desfazer volta", async () => {
      await conferirAssinaturaNasTres(p, c, "iCloud", { raiox: "aberto", recorrentes: "na lista", perdido: "Para conferir" }, "partida");
      const pilula = await naoEAssinatura(p, "iCloud");
      // As outras duas telas numa segunda aba: a pílula com o Desfazer fica na primeira.
      const p2 = await p.context().newPage();
      await novaPagina(p2);
      await conferirAssinaturaNasTres(p2, c, "iCloud", { raiox: "fora", recorrentes: "fora", perdido: "fora" }, "Recorrentes");
      await p2.close();
      await Promise.all([
        p.waitForResponse((r) => r.request().method() === "POST", { timeout: 30_000 }).catch(() => undefined),
        pilula.getByRole("button", { name: "Desfazer" }).click(),
      ]);
      await p.waitForLoadState("networkidle").catch(() => undefined);
      await conferirAssinaturaNasTres(p, c, "iCloud", { raiox: "aberto", recorrentes: "na lista", perdido: "Para conferir" }, "Recorrentes (Desfazer)");
    });

    await passo(c, "lançar à mão Lazer R$ 120 (Show)", async () => {
      const antes = await gastoDe("LAZER");
      await visitarPeloApp(p, ["Resumo", "Orçamento", "Transações"]);
      await lancarAMao(p, { valor: 120, categoria: "Lazer", descricao: "Show" });
      await conferirTelaVelha(p, c, ["Orçamento", "Resumo", "Transações"]);
      // O relógio do servidor está no dia simulado: o Resumo corta no dia 15.
      expect((await lerResumo(p, c)).heroi).toContain("até dia 15");
      const depois = await conferirGastoPorCategoria(p, c, OUT, "show");
      if (!bate((depois.orc.categorias.LAZER?.gasto ?? 0) - antes, 120)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Digitar", telaErrada: "Orçamento", esperado: `Lazer ${brl(antes + 120)}`, visto: brl(depois.orc.categorias.LAZER?.gasto) });
      expect(depois.trans.linhas.some((l) => l.descricao === "Show")).toBe(true);
    });

    await passo(c, "lançar por voz \"gastei 45 reais no mercado\"", async () => {
      const antes = await gastoDe("ALIMENTACAO");
      await lancarPorVoz(p, "gastei 45 reais no mercado");
      await esperarDelta("ALIMENTACAO", antes, 45, "Gravar áudio");
      await conferirGastoPorCategoria(p, c, OUT, "voz");
    });

    // ------------------------------------------------------------------ sexta 16/10
    await dia(c, "2026-10-16 20:00", [p]);
    await passo(c, "O que fazer? Saúde → cobrir com Outros e Desfazer", async () => {
      const antes = await lerOrcamento(p, c, OUT);
      await cobrirCom(p, OUT.ano, "SAUDE", "Outros", true);
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "desfazer cobrir");
      for (const k of ["SAUDE", "OUTROS"]) {
        if (!bate(orc.categorias[k]?.plano, antes.categorias[k]?.plano)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Desfazer (cobrir)", telaErrada: "Orçamento", esperado: `${k} de ${brl(antes.categorias[k]?.plano)} de novo`, visto: orc.categorias[k]?.texto ?? "(sem linha)" });
      }
      // Desfeito, o aviso volta (a categoria continua passando do plano).
      await conferirAvisoDaCategoria(p, c, "SAUDE", "Saúde", true, "desfazer cobrir Saúde");
    });

    await passo(c, "O que fazer? Saúde → cobrir com Outros", async () => {
      await visitarPeloApp(p, ["Resumo", "Orçamento"]);
      await cobrirCom(p, OUT.ano, "SAUDE", "Outros");
      await conferirTelaVelha(p, c, ["Resumo", "Orçamento"]);
      await conferirAvisoDaCategoria(p, c, "SAUDE", "Saúde", false, "cobrir Saúde");
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "cobrir Saúde");
      if (!bate(orc.plano, 7300)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "O que fazer? (cobrir)", telaErrada: "Orçamento (plano)", esperado: "plano total R$ 7.300 (cobrir não muda o total)", visto: brl(orc.plano) });
      await conferirLivre(p, c, orc, "cobrir Saúde");
    });

    // ------------------------------------------------------------------ sábado 17/10
    await dia(c, "2026-10-17 10:00", [p]);
    let sugestaoDispensada = "";
    await passo(c, "Agora não na sugestão do Resumo", async () => {
      const recAntes = await lerRecorrentes(p, c);
      sugestaoDispensada = await agoraNaoNoResumo(p);
      const r = await lerResumo(p, c);
      if (r.sugestao?.texto === sugestaoDispensada) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "Resumo (Agora não)", telaErrada: "Resumo", esperado: `"${sugestaoDispensada}" some`, visto: "continua lá" });
      // "Agora não" no Resumo não apaga o achado de Recorrentes (ele só sai do Resumo).
      const recDepois = await lerRecorrentes(p, c);
      const achados = (t: string) => t.match(/(\d+) achados? para conferir/)?.[1] ?? null;
      if (achados(recAntes.texto) && achados(recAntes.texto) !== achados(recDepois.texto)) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Resumo (Agora não)", telaErrada: "Recorrentes (Dinheiro perdido)", esperado: `${achados(recAntes.texto)} achados para conferir`, visto: `${achados(recDepois.texto) ?? "nenhum"}` });
    });

    await passo(c, "Lazer passa do plano (Ingresso festival R$ 650)", async () => {
      const antes = await gastoDe("LAZER");
      await lancarAMao(p, { valor: 650, categoria: "Lazer", descricao: "Ingresso festival" });
      await esperarDelta("LAZER", antes, 650, "Digitar");
      await conferirAvisoDaCategoria(p, c, "LAZER", "Lazer", true, "Lazer passou");
      const r = await lerResumo(p, c);
      test.info().annotations.push({ type: "Resumo depois do festival", description: `${r.sugestao?.tipo}: ${r.sugestao?.texto}` });
    });

    // Até 15/10 a jornada cobria com Alimentação (o caso da Dani de 14/10). A regra de remanejo
    // dela manda tirar do desejo primeiro: com Outros sobrando, Alimentação nem é oferecida.
    await passo(c, "O que fazer? Lazer → cobrir com Outros (desejo primeiro, Alimentação não é opção)", async () => {
      await visitarPeloApp(p, ["Resumo", "Orçamento"]);
      await cobrirCom(p, OUT.ano, "LAZER", "Outros", false, { naoOferece: ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação"], anotar: c });
      await conferirTelaVelha(p, c, ["Orçamento", "Resumo"]);
      await conferirAvisoDaCategoria(p, c, "LAZER", "Lazer", false, "cobrir Lazer");
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "cobrir Lazer");
      await conferirLivre(p, c, orc, "cobrir Lazer");
    });

    // ------------------------------------------------------------------ domingo 18/10
    await dia(c, "2026-10-18 11:00", [p]);
    await passo(c, "Transporte sobe (Uber R$ 380) e ela toca no botão da sugestão", async () => {
      await lancarAMao(p, { valor: 380, categoria: "Transporte", descricao: "Uber aeroporto" });
      const r = await lerResumo(p, c);
      if (r.sugestao?.tipo === "categoria") {
        const { texto, rotulo } = await tocarNaSugestao(p);
        const depois = await lerResumo(p, c);
        if (depois.sugestao?.texto === texto) await c.anotar(p, { tipo: "aviso", telaDeOrigem: `Resumo (botão "${rotulo}")`, telaErrada: "Resumo", esperado: `"${texto}" some depois de tocar em ${rotulo}`, visto: "continua lá" });
      } else {
        test.info().annotations.push({ type: "sem sugestão de categoria", description: `${r.sugestao?.tipo}: ${r.sugestao?.texto}` });
      }
      await conferirGastoPorCategoria(p, c, OUT, "uber");
    });

    await passo(c, "Impostos sem plano: IPTU R$ 300 e ela cria o limite no lápis", async () => {
      await lancarAMao(p, { valor: 300, categoria: "Impostos", descricao: "IPTU" });
      const antes = await lerResumo(p, c);
      test.info().annotations.push({ type: "Resumo depois do IPTU", description: `${antes.sugestao?.tipo}: ${antes.sugestao?.texto}` });
      await lapis(p, OUT.ano, "Impostos", 400);
      const o = await lerOrcamento(p, c, OUT);
      if (!bate(o.categorias.IMPOSTOS?.plano, 400) || !bate(o.categorias.IMPOSTOS?.gasto, 300)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "lápis (Impostos)", telaErrada: "Orçamento", esperado: "Impostos R$ 300 de R$ 400", visto: o.categorias.IMPOSTOS?.texto ?? "(sem linha)" });
      const r = await lerResumo(p, c);
      if (r.sugestao?.texto?.startsWith("Impostos")) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "lápis (criou o limite de Impostos)", telaErrada: "Resumo (sugestão)", esperado: "a sugestão de Impostos some (o limite foi criado)", visto: r.sugestao.texto });
      await conferirAvisoDaCategoria(p, c, "IMPOSTOS", "Impostos", false, "limite de Impostos");
      await conferirGastoPorCategoria(p, c, OUT, "IPTU");
    });

    await passo(c, "Decidir: responder o cartão do topo (Segurar em, se houver)", async () => {
      // A pilha mostra um cartão por vez: "Pular este" até chegar no de ritmo (ou acabar).
      let dec = await lerDecidir(p, c);
      for (let i = 0; i < 5 && dec.cartoes.length && !dec.cartoes.some((x) => x.id.startsWith("ritmo-")); i++) {
        const pular = p.getByRole("button", { name: "Pular este" });
        if (!(await pular.count())) break;
        await pular.first().click();
        await p.waitForTimeout(700);
        dec = { ...dec, cartoes: await Promise.all((await p.locator("[data-cartao]").all()).map(async (el) => ({ id: (await el.getAttribute("data-cartao")) ?? "", texto: (await el.innerText()).split("\n").slice(0, 3).join(" | ") }))) };
      }
      const ritmo = dec.cartoes.find((x) => x.id.startsWith("ritmo-"));
      if (ritmo) {
        const chave = ritmo.id.slice("ritmo-".length);
        await p.locator(`[data-cartao="${ritmo.id}"]`).getByRole("button", { name: /^Segurar em/ }).first().click();
        await p.waitForLoadState("networkidle").catch(() => undefined);
        await p.waitForTimeout(700);
        const depois = await lerDecidir(p, c);
        if (depois.cartoes.some((x) => x.id === ritmo.id)) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "Decidir (Segurar em)", telaErrada: "Decidir", esperado: `cartão ${ritmo.id} some`, visto: "continua" });
        const r = await lerResumo(p, c);
        const nome = ritmo.texto.split(" ")[0];
        if (r.sugestao?.tipo === "categoria" && r.sugestao.texto.startsWith(nome)) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "Decidir (Segurar em)", telaErrada: "Resumo (sugestão)", esperado: `sugestão de ${nome} (${chave}) some depois de segurar`, visto: r.sugestao.texto });
      } else {
        test.info().annotations.push({ type: "Decidir sem cartão de ritmo", description: dec.cartoes.map((x) => x.id).join(", ") });
      }
    });

    // ------------------------------------------------------------------ segunda 19/10
    await dia(c, "2026-10-19 08:00", [p]);
    await passo(c, "lápis: Transporte de R$ 800 para R$ 900", async () => {
      const antes = await lerOrcamento(p, c, OUT);
      const decAntes = await lerDecidir(p, c);
      await visitarPeloApp(p, ["Orçamento", "Resumo"]);
      await lapis(p, OUT.ano, "Transporte", 900);
      await conferirTelaVelha(p, c, ["Orçamento", "Resumo"]);
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "lápis");
      if (!bate(orc.categorias.TRANSPORTE?.plano, 900)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "lápis", telaErrada: "Orçamento", esperado: "Transporte de R$ 900", visto: orc.categorias.TRANSPORTE?.texto ?? "(sem linha)" });
      if (antes.plano != null && !bate(orc.plano, antes.plano + 100)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "lápis", telaErrada: "Orçamento (plano do mês)", esperado: brl(antes.plano + 100), visto: brl(orc.plano) });
      const { dec, livreOrc, widgetMes } = await conferirLivre(p, c, orc, "lápis");
      // Subir o plano em R$ 100 sobe o livre do mês em R$ 100 em todo lugar (15/10/2026: a renda
      // não limita mais o livre; plano acima da renda vira aviso à parte).
      const livreAntes = antes.livres ?? (antes.acimaDoPlano != null ? -antes.acimaDoPlano : null);
      if (livreAntes != null && livreOrc != null && !bate(livreOrc - livreAntes, 100)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "lápis (+R$ 100 em Transporte)", telaErrada: "Orçamento (R$ X livres)", esperado: `${brl(livreAntes + 100)} livres (era ${brl(livreAntes)})`, visto: brl(livreOrc) });
      if (decAntes.livres != null && dec.livres != null && !bate(dec.livres - decAntes.livres, 100)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "lápis (+R$ 100 em Transporte)", telaErrada: "Decidir (R$ X livres)", esperado: `${brl(decAntes.livres + 100)} livres (era ${brl(decAntes.livres)})`, visto: `${brl(dec.livres)} livres` });
      if (livreAntes != null && widgetMes != null && !bate(widgetMes - livreAntes, 100)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "lápis (+R$ 100 em Transporte)", telaErrada: "widget (livre do mês)", esperado: brl(livreAntes + 100), visto: brl(widgetMes) });
    });

    await passo(c, "apagar o Show e Desfazer", async () => {
      const antes = await gastoDe("LAZER");
      await apagarLancamento(p, OUT.ano, OUT.mes, "Show", true);
      const t = await lerTransacoes(p, c, OUT);
      if (!t.linhas.some((l) => l.descricao === "Show")) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Desfazer", telaErrada: "Transações", esperado: "o Show de volta na lista", visto: "não voltou" });
      await esperarDelta("LAZER", antes, 0, "Desfazer");
      await conferirGastoPorCategoria(p, c, OUT, "desfazer");
    });

    await passo(c, "apagar o Uber aeroporto (sem desfazer)", async () => {
      const antes = await gastoDe("TRANSPORTE");
      await apagarLancamento(p, OUT.ano, OUT.mes, "Uber aeroporto");
      await esperarDelta("TRANSPORTE", antes, -380, "Remover");
      await conferirGastoPorCategoria(p, c, OUT, "apagar");
    });

    await passo(c, "mover a Drogasil para o Ateliê (Empresa)", async () => {
      const antes = await gastoDe("SAUDE");
      await moverParaPerfil(p, OUT.ano, OUT.mes, "Drogasil", "Ateliê");
      await esperarDelta("SAUDE", antes, -28, "Enviar para outro perfil");
      const t = await lerTransacoes(p, c, OUT);
      if (t.linhas.some((l) => l.descricao === "Drogasil")) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Enviar para outro perfil", telaErrada: "Transações (Pessoal)", esperado: "Drogasil fora do Pessoal", visto: "continua na lista" });
      await conferirGastoPorCategoria(p, c, OUT, "mover");
      await conferirAvisoDaCategoria(p, c, "SAUDE", "Saúde", false, "mover Drogasil");
    });

    // ------------------------------------------------------------------ terça 20/10
    await dia(c, "2026-10-20 12:30", [p]);
    await passo(c, "criar a meta Notebook e guardar R$ 300", async () => {
      const guardadoAntes = (await lerResumo(p, c)).heroi;
      await criarMeta(p, "Notebook", 4000);
      await conferirMetas(p, c, "criar meta", { Notebook: 0 });
      await aporteNaMeta(p, "Notebook", 300);
      await conferirMetas(p, c, "aporte", { Notebook: 300 });
      const t = await lerTransacoes(p, c, OUT);
      if (!t.linhas.some((l) => /Notebook|Guardado/.test(`${l.descricao} ${l.categoria}`) && bate(Math.abs(l.valor), 300))) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Metas (Adicionar)", telaErrada: "Transações", esperado: "o aporte de R$ 300 na lista do mês", visto: "não aparece" });
      const guardadoDepois = (await lerResumo(p, c)).heroi;
      const g = (h: string) => Number((h.match(/Guardado em 2026\s*R\$\s*([\d.]+)/)?.[1] ?? "0").replace(/\./g, ""));
      if (g(guardadoAntes) && !bate(g(guardadoDepois) - g(guardadoAntes), 300)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Metas (Adicionar)", telaErrada: "Resumo (Guardado em 2026)", esperado: brl(g(guardadoAntes) + 300), visto: brl(g(guardadoDepois)) });
    });

    await passo(c, "apagar a meta Notebook", async () => {
      await apagarMeta(p, "Notebook");
      const m = await conferirMetas(p, c, "apagar meta");
      if (m.metas.Notebook != null) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "Metas (Apagar)", telaErrada: "Metas", esperado: "Notebook some", visto: "continua" });
      const w = await lerWidget(p, BASE);
      if (!("erro" in w) && w.metas.some((x) => x.nome === "Notebook")) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Metas (Apagar)", telaErrada: "widget", esperado: "Notebook fora do widget", visto: "continua no widget" });
    });

    // ------------------------------------------------------------------ quarta 21/10
    await dia(c, "2026-10-21 19:00", [p]);
    await passo(c, "extrato novo de outubro (dias 16 a 20)", async () => {
      await importarArquivo(p, ARQ("ana-extrato-outubro.csv"));
      const { orc } = await conferirGastoPorCategoria(p, c, OUT, "extrato outubro");
      await conferirLivre(p, c, orc, "extrato outubro");
      const r = await lerResumo(p, c);
      test.info().annotations.push({ type: "Resumo depois do extrato", description: `${r.heroi} | ${r.sugestao?.texto}` });
    });

    await passo(c, "Empresa: vendeu R$ 300 no Ateliê", async () => {
      const pessoalAntes = await lerOrcamento(p, c, OUT);
      await trocarPerfil(p, "Ateliê");
      await abrir(p, "/empresa", c, "Empresa");
      await vendiNaEmpresa(p, 300);
      await abrir(p, "/empresa", c, "Empresa (depois da venda)");
      // Lançamentos abre no último mês fechado (o padrão da Empresa): a venda de hoje não está lá.
      await abrir(p, "/empresa/lancamentos", c, "Empresa: lançamentos");
      if (!/Venda[\s\S]{0,80}300,00/.test(await textoVisivel(p))) await c.anotar(p, { tipo: "decisao", telaDeOrigem: "Empresa (Vendi)", telaErrada: "Empresa: Lançamentos (abre no mês passado)", esperado: "a venda que ela acabou de registrar à vista", visto: `abre em ${(await textoVisivel(p)).match(/Mês passado · \w+ \d{4}/)?.[0] ?? "outro mês"}` });
      await abrir(p, "/empresa/lancamentos?periodo=mes", c, "Empresa: lançamentos do mês");
      const lista = await textoVisivel(p);
      if (!/Venda[\s\S]{0,80}300,00/.test(lista)) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Empresa (Vendi)", telaErrada: "Empresa: lançamentos", esperado: "a venda de R$ 300 na lista", visto: "não aparece" });
      await trocarPerfil(p, "Pessoal");
      const pessoalDepois = await lerOrcamento(p, c, OUT);
      if (!bate(pessoalAntes.plano, pessoalDepois.plano) || !bate(pessoalAntes.livres, pessoalDepois.livres)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Empresa (Vendi)", telaErrada: "Orçamento (Pessoal)", esperado: `Pessoal igual: ${brl(pessoalAntes.livres)} livres`, visto: `${brl(pessoalDepois.livres)} livres` });
    });

    // ------------------------------------------------------------------ segunda 02/11 (virou o mês)
    await dia(c, "2026-11-02 08:30", [p]);
    definirMesAtual(NOV);
    await passo(c, "virar o mês: novembro abre e outubro fica igual", async () => {
      const r = await lerResumo(p, c);
      test.info().annotations.push({ type: "Resumo em 02/11", description: `${r.caso} | ${r.heroi} | ${r.sugestao?.texto}` });
      const { orc } = await conferirGastoPorCategoria(p, c, NOV, "virou o mês");
      if (!bate(orc.categorias.TRANSPORTE?.plano, 900)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "lápis (19/10, \"de outubro em diante\")", telaErrada: "Orçamento de novembro", esperado: "Transporte R$ 900", visto: orc.categorias.TRANSPORTE?.texto ?? "(sem linha)" });
      await conferirMesPassado(p, c, OUT, "virou o mês");
      const nov = await conferirLivre(p, c, orc, "virou o mês");
      // Dia 2 com o plano de novembro montado (o plano vale até dezembro): o livre é o plano menos o
      // que saiu, nunca "R$ 0" por falta de dado, e o Posso comprar diz o mesmo número.
      if (nov.livreOrc == null || nov.livreOrc < 1) await c.anotar(p, { tipo: "numero", telaDeOrigem: "virar o mês", telaErrada: "Orçamento de novembro", esperado: "o livre de novembro (plano menos o que saiu)", visto: nov.livreOrc == null ? "sem número" : brl(nov.livreOrc), chave: `${PERFIL}|livre-nov-orc` });
      if (!nov.comprar || !/novembro/.test(nov.comprar.frase) || /R\$\s*0(?!\d)/.test(nov.comprar.frase)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "virar o mês", telaErrada: "Posso comprar", esperado: `Seu livre de novembro é ${nov.livreOrc == null ? "?" : brl(nov.livreOrc)}`, visto: nov.comprar?.frase ?? "(não abriu)", chave: `${PERFIL}|livre-nov-comprar` });
    });

    // "Paguei" vira gasto (15/10/2026, versão B): o aluguel de novembro venceu dia 1. Um toque no
    // círculo, "Pronto", e o gasto entra no Resumo, no Orçamento e no livre do mês.
    let moradiaDepoisDoPaguei: number | null = null;
    await passo(c, "Recorrentes: Paguei no aluguel de novembro vira gasto", async () => {
      const antes = await lerOrcamento(p, c, NOV);
      const resumoAntes = await lerResumo(p, c);
      await visitarPeloApp(p, ["Resumo", "Orçamento", "Transações"]);
      const chips = await pagueiNaConta(p, "Aluguel");
      test.info().annotations.push({ type: "Paguei no aluguel", description: `${chips.dia} · ${chips.origem}` });
      if (chips.dia !== "Hoje") await c.anotar(p, { tipo: "texto", telaDeOrigem: "Recorrentes (Paguei)", telaErrada: "Recorrentes (linha aberta)", esperado: "o dia abre em Hoje", visto: chips.dia });
      const entrou = p.locator("[data-entrou-nos-gastos]");
      if (!(await entrou.count()) || !/Aluguel[\s\S]*2\.200,00/.test(await entrou.innerText())) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Recorrentes (Paguei)", telaErrada: "Recorrentes", esperado: "Entrou nos gastos: Aluguel R$ 2.200,00", visto: (await entrou.count()) ? await entrou.innerText() : "não aparece" });
      if (await p.getByRole("button", { name: "Marcar Aluguel como paga" }).count()) await c.anotar(p, { tipo: "tela", telaDeOrigem: "Recorrentes (Paguei)", telaErrada: "Recorrentes", esperado: "o aluguel paga", visto: "continua com o Paguei" });
      await conferirTelaVelha(p, c, ["Resumo", "Orçamento", "Transações"]);
      const { orc, trans } = await conferirGastoPorCategoria(p, c, NOV, "Paguei aluguel");
      moradiaDepoisDoPaguei = orc.categorias.MORADIA?.gasto ?? null;
      if (!bate((orc.categorias.MORADIA?.gasto ?? 0) - (antes.categorias.MORADIA?.gasto ?? 0), 2200)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes (Paguei)", telaErrada: "Orçamento (Moradia)", esperado: `Moradia ${brl((antes.categorias.MORADIA?.gasto ?? 0) + 2200)}`, visto: orc.categorias.MORADIA?.texto ?? "(sem linha)" });
      if (trans.linhas.filter((l) => l.descricao === "Aluguel" && bate(l.valor, -2200)).length !== 1) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Recorrentes (Paguei)", telaErrada: "Transações 11/2026", esperado: "uma linha Aluguel de R$ 2.200", visto: trans.linhas.filter((l) => /Aluguel/.test(l.descricao)).map((l) => `${l.descricao} ${brl(l.valor)}`).join(", ") || "nenhuma" });
      const { livreOrc } = await conferirLivre(p, c, orc, "Paguei aluguel");
      const livreAntes = antes.livres ?? (antes.acimaDoPlano != null ? -antes.acimaDoPlano : null);
      if (livreAntes != null && livreOrc != null && !bate(livreAntes - livreOrc, 2200)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes (Paguei)", telaErrada: "Orçamento (livre do mês)", esperado: `${brl(livreAntes - 2200)} (era ${brl(livreAntes)})`, visto: brl(livreOrc) });
      const resumo = await lerResumo(p, c);
      test.info().annotations.push({ type: "Resumo antes e depois do Paguei", description: `${resumoAntes.heroi} || ${resumo.heroi}` });
      if (resumoAntes.gastoNoHeroi != null && resumo.gastoNoHeroi != null && /gast/i.test(resumo.heroi) && !bate(resumo.gastoNoHeroi - resumoAntes.gastoNoHeroi, 2200) && !bate(resumoAntes.gastoNoHeroi - resumo.gastoNoHeroi, 2200)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes (Paguei)", telaErrada: "Resumo", esperado: "o herói do Resumo muda R$ 2.200", visto: `${brl(resumoAntes.gastoNoHeroi)} → ${brl(resumo.gastoNoHeroi)}` });
    });

    await passo(c, "fechar outubro", async () => {
      await fecharMes(p, "outubro");
      const r = await lerResumo(p, c);
      if (r.sugestao?.texto?.startsWith("Fechar outubro")) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "Fechamento", telaErrada: "Resumo", esperado: "o \"Fechar outubro\" some", visto: r.sugestao.texto });
      const passado = await conferirMesPassado(p, c, OUT, "fechar outubro");
      const fechar = await p.locator('[data-fechamento="fechar"]').count();
      await abrir(p, "/mensal/foco?mes=2026-10", c, "Resumo de outubro");
      if (fechar || (await p.locator('[data-fechamento="fechar"]').count())) await c.anotar(p, { tipo: "aviso", telaDeOrigem: "Fechamento", telaErrada: "Resumo de outubro", esperado: "outubro fechado", visto: "ainda oferece Fechar" });
      void passado;
    });

    // ------------------------------------------------------------------ quarta 04/11
    await dia(c, "2026-11-04 21:00", [p]);
    await passo(c, "extrato de novembro (dias 2 a 4) com o aluguel do Paguei: fica um só", async () => {
      await importarArquivo(p, ARQ("ana-extrato-novembro.csv"), async (pg) => {
        // O PIX do aluguel é o mesmo do Paguei de 02/11: "já estava no app (Paguei)", não entra de novo.
        const link = pg.locator("[data-ja-no-app]");
        if (!(await link.count())) {
          await c.anotar(pg, { tipo: "sumiu", telaDeOrigem: "Importar (extrato com o aluguel)", telaErrada: "Conferência", esperado: "1 já estava no app (o aluguel do Paguei)", visto: "nada já no app" });
          return;
        }
        await link.click();
        const lista = await pg.locator("[data-confirmacao-do-arquivo]").innerText();
        if (!/ALUGUEL[\s\S]{0,120}já estava no app \(Paguei\)/i.test(lista)) await c.anotar(pg, { tipo: "texto", telaDeOrigem: "Importar (extrato com o aluguel)", telaErrada: "Conferência", esperado: "PIX ENVIADO ALUGUEL · já estava no app (Paguei)", visto: lista.split("\n").filter((l) => /ALUGUEL|Paguei|já esta/i.test(l)).join(" / ") || "(sem a linha)" });
      });
      const { orc, trans } = await conferirGastoPorCategoria(p, c, NOV, "extrato novembro");
      const alugueis = trans.linhas.filter((l) => bate(l.valor, -2200));
      if (alugueis.length !== 1) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Importar (extrato com o aluguel)", telaErrada: "Transações 11/2026", esperado: "um aluguel de R$ 2.200 (o do Paguei virou o do extrato)", visto: alugueis.map((l) => `${l.descricao} (${l.categoria})`).join(", ") || "nenhum" });
      if (moradiaDepoisDoPaguei != null && !bate(orc.categorias.MORADIA?.gasto, moradiaDepoisDoPaguei)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Importar (extrato com o aluguel)", telaErrada: "Orçamento (Moradia)", esperado: `Moradia ${brl(moradiaDepoisDoPaguei)} (o aluguel não conta duas vezes)`, visto: orc.categorias.MORADIA?.texto ?? "(sem linha)" });
      await conferirLivre(p, c, orc, "extrato novembro");
      await conferirMetas(p, c, "novembro");
      await conferirMesPassado(p, c, OUT, "extrato novembro");
    });
  } finally {
    c.salvar();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});

// Avisos de Ana que o módulo de avisos ainda não resolve: nenhum nesta rodada (ver o relatório).
testeDosAvisos(PERFIL, []);
