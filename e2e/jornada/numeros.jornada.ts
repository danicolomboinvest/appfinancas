import fs from "node:fs";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { Caderno, dia, exigirSemAchados, novaPagina, passo } from "./comum";
import { entrar, fecharMes, importarArquivo, lancarAMao, naoEParcela } from "./acoes";
import { conferirGastoPorCategoria, conferirLivre, conferirMatriz, conferirMesPassado, conferirMetas, definirMesAtual } from "./conferir";
import { lerMesPassadoDosNumeros, lerOrcamento, lerParcelas, lerPossoComprar, lerResumoDosNumeros, lerTransacoes, somarTransacoes } from "./telas";
import { bate, brl } from "./dinheiro";
import { PASTA_DE_SAIDA } from "./achados";

/**
 * Os números da Duda (pedido da dona, 15/10/2026: "as coisas precisam bater certinho"). Cada número
 * que aparece em mais de uma tela é conferido em todas (conferirMatriz), depois de cada ação:
 *  - "Não é parcela" numa compra parcelada da semente;
 *  - a fatura do cartão em CSV e em PDF (o print já está na jornada da Clara);
 *  - fechar o mês;
 *  - a virada do ano: dezembro fecha e janeiro de 2027 abre sem plano, sem "R$ 0" inventado.
 */
const OUT = { ano: 2026, mes: 10 };
const NOV = { ano: 2026, mes: 11 };
const DEZ = { ano: 2026, mes: 12 };
const JAN = { ano: 2027, mes: 1 };
const PERFIL = "duda";
const PLANO_DE_GUARDAR = 600;
const ARQ = (n: string) => path.join(__dirname, "arquivos", n);

/** Uma fatura FICTÍCIA do Nubank em PDF, com a estrutura que o leitor conhece. */
async function gerarFaturaPdf(p: Page): Promise<string> {
  const linhas = [
    "Nu Pagamentos S.A.",
    "FATURA 25 OUT 2026 EMISSÃO E ENVIO 18 OUT 2026",
    "RESUMO DA FATURA ATUAL",
    "Total a pagar: R$ 151,30",
    "TRANSAÇÕES DE 11 OUT A 18 OUT",
    "14 OUT Farmacia Sao Joao R$ 61,30",
    "15 OUT Livraria Cultura R$ 90,00",
    "Em cumprimento à regulação do Banco Central",
  ];
  const pg = await p.context().newPage();
  await pg.setContent(`<html><body style="font-family:Helvetica;font-size:12px">${linhas.map((l) => `<div>${l}</div>`).join("")}</body></html>`);
  fs.mkdirSync(PASTA_DE_SAIDA, { recursive: true });
  const arquivo = path.join(PASTA_DE_SAIDA, "duda-fatura-nubank.pdf");
  await pg.pdf({ path: arquivo, format: "A4" });
  await pg.close();
  return arquivo;
}

test("Duda: o mesmo número em todas as telas, da parcela à virada do ano", async ({ page: p }) => {
  test.setTimeout(14 * 60_000);
  const c = new Caderno(PERFIL);
  await novaPagina(p, c);
  definirMesAtual(OUT);
  /** As parcelas que Recorrentes de outubro diz que continuam em novembro, dezembro e janeiro. */
  let parcelasPrevistas: Record<string, number> = {};
  try {
    // ------------------------------------------------------------------ quinta 15/10
    await dia(c, "2026-10-15 09:00", [p]);
    await passo(c, "abrir o app (retrato de partida)", async () => {
      await entrar(p, "duda@exemplo.test");
      const { orc } = await conferirMatriz(p, c, OUT, [9, 10], "partida", { planoDeGuardar: PLANO_DE_GUARDAR });
      // Os números da semente, à mão: outubro gastou R$ 2.402,40 e guardou R$ 450 (600 − 150).
      if (!bate(orc.gastou, 2402.4, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "semente", telaErrada: "Orçamento", esperado: "Gastou R$ 2.402", visto: brl(orc.gastou) });
      await conferirGastoPorCategoria(p, c, OUT, "partida");
      await conferirLivre(p, c, orc, "partida");
      await conferirMetas(p, c, "partida", { "Viagem Chile": 950 });
      await conferirMesPassado(p, c, { ano: 2026, mes: 9 }, "partida");
    });

    await passo(c, "Não é parcela: o Curso Online sai das parcelas em todo lugar", async () => {
      const antes = await lerParcelas(p, c);
      const curso = antes.itens.find((x) => x.nome.startsWith("Curso Online"));
      if (!curso) {
        await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "semente", telaErrada: "Recorrentes (Parcelas)", esperado: "Curso Online 2 de 6", visto: antes.itens.map((x) => x.nome).join(", ") || "(nenhuma)" });
        return;
      }
      const gastoAntes = (await lerOrcamento(p, c, OUT)).gastou;
      await naoEParcela(p, "Curso Online");
      const depois = await lerParcelas(p, c);
      if (depois.itens.some((x) => x.nome.startsWith("Curso Online"))) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes (Não é parcela)", telaErrada: "Recorrentes (Parcelas)", esperado: "Curso Online fora das parcelas", visto: "continua na lista" });
      if (!bate(depois.topo, (antes.topo ?? 0) - curso.valor, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes (Não é parcela)", telaErrada: "Recorrentes (Parcelas, topo)", esperado: brl((antes.topo ?? 0) - curso.valor), visto: brl(depois.topo) });
      // O gasto do mês não muda: o lançamento continua, só deixa de ser parcela.
      const gastoDepois = (await lerOrcamento(p, c, OUT)).gastou;
      if (!bate(gastoAntes, gastoDepois, 0.01)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes (Não é parcela)", telaErrada: "Orçamento (Gastou)", esperado: `igual: ${brl(gastoAntes)}`, visto: brl(gastoDepois) });
      const t = await lerTransacoes(p, c, OUT);
      if (!t.linhas.some((l) => l.descricao.startsWith("Curso Online"))) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Recorrentes (Não é parcela)", telaErrada: "Transações", esperado: "Curso Online continua na lista do mês", visto: "sumiu" });
      // O Resumo (Próximos meses) e o Posso comprar também deixam de contar o curso.
      await conferirMatriz(p, c, OUT, [9, 10], "não é parcela", { planoDeGuardar: PLANO_DE_GUARDAR });
      const comprar = await lerPossoComprar(p, c).catch(() => null);
      if (comprar && /Curso Online/.test(comprar.frase)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes (Não é parcela)", telaErrada: "Posso comprar", esperado: "sem o Curso Online nas parcelas", visto: comprar.frase });
    });

    // ------------------------------------------------------------------ sexta 16/10
    await dia(c, "2026-10-16 19:00", [p]);
    await passo(c, "fatura do Nubank em CSV", async () => {
      const antes = somarTransacoes(await lerTransacoes(p, c, OUT));
      const parcAntes = await lerParcelas(p, c);
      await importarArquivo(p, ARQ("duda-fatura-nubank.csv"));
      const depois = somarTransacoes(await lerTransacoes(p, c, OUT));
      // As quatro compras de outubro (R$ 510,40); o "Pagamento recebido" da fatura anterior não é gasto.
      if (!bate(depois.gastou - antes.gastou, 510.4, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "fatura CSV", telaErrada: "Transações (gasto do mês)", esperado: `+R$ 510,40 (de ${brl(antes.gastou)} para ${brl(antes.gastou + 510.4)})`, visto: brl(depois.gastou) });
      if (!bate(depois.entrou, antes.entrou, 0.01)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "fatura CSV", telaErrada: "Transações (entrou)", esperado: `igual: ${brl(antes.entrou)} (pagamento da fatura não é renda)`, visto: brl(depois.entrou) });
      const parc = await lerParcelas(p, c);
      const tenis = parc.itens.find((x) => /Loja de Tenis/i.test(x.nome));
      if (!tenis || !bate(tenis.valor, 210, 0.01) || tenis.total !== 3) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "fatura CSV", telaErrada: "Recorrentes (Parcelas)", esperado: "Loja de Tenis 1 de 3, R$ 210", visto: tenis ? `${tenis.nome} ${tenis.atual} de ${tenis.total} ${brl(tenis.valor)}` : "não está" });
      else if (!bate(parc.topo, (parcAntes.topo ?? 0) + 210, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "fatura CSV", telaErrada: "Recorrentes (Parcelas, topo)", esperado: brl((parcAntes.topo ?? 0) + 210), visto: brl(parc.topo) });
      const { orc } = await conferirMatriz(p, c, OUT, [9, 10], "fatura CSV", { planoDeGuardar: PLANO_DE_GUARDAR });
      await conferirGastoPorCategoria(p, c, OUT, "fatura CSV");
      await conferirLivre(p, c, orc, "fatura CSV");
    });

    // ------------------------------------------------------------------ sábado 17/10
    await dia(c, "2026-10-17 10:00", [p]);
    await passo(c, "fatura do Nubank em PDF", async () => {
      const antes = somarTransacoes(await lerTransacoes(p, c, OUT));
      await importarArquivo(p, await gerarFaturaPdf(p));
      const depois = somarTransacoes(await lerTransacoes(p, c, OUT));
      if (!bate(depois.gastou - antes.gastou, 151.3, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "fatura PDF", telaErrada: "Transações (gasto do mês)", esperado: `+R$ 151,30 (de ${brl(antes.gastou)} para ${brl(antes.gastou + 151.3)})`, visto: brl(depois.gastou) });
      const { orc, res } = await conferirMatriz(p, c, OUT, [9, 10], "fatura PDF", { planoDeGuardar: PLANO_DE_GUARDAR });
      await conferirGastoPorCategoria(p, c, OUT, "fatura PDF");
      await conferirLivre(p, c, orc, "fatura PDF");
      // As parcelas de outubro que continuam: conferidas de novo em Recorrentes de cada mês.
      const parc = await lerParcelas(p, c);
      const continuam = (k: number) => parc.itens.filter((x) => x.faltam >= k).reduce((s, x) => s + x.valor, 0);
      parcelasPrevistas = { Nov: continuam(2), Dez: continuam(3), Jan: continuam(4) };
      test.info().annotations.push({ type: "Parcelas previstas em 17/10", description: `${JSON.stringify(parcelasPrevistas)} | Próximos meses do Resumo: ${JSON.stringify(res.proximos)}` });
    });

    // ------------------------------------------------------------------ segunda 02/11
    await dia(c, "2026-11-02 08:30", [p]);
    definirMesAtual(NOV);
    await passo(c, "fechar outubro: os números de outubro não mudam", async () => {
      const antes = await lerMesPassadoDosNumeros(p, c, OUT);
      const transAntes = somarTransacoes(await lerTransacoes(p, c, OUT));
      await fecharMes(p, "outubro");
      const depois = await lerMesPassadoDosNumeros(p, c, OUT);
      const transDepois = somarTransacoes(await lerTransacoes(p, c, OUT));
      if (!bate(antes.ficou, depois.ficou, 0.01)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Fechar outubro", telaErrada: "Resumo de outubro", esperado: `ficou com você ${brl(antes.ficou)} (como antes de fechar)`, visto: brl(depois.ficou) });
      for (const k of ["entrou", "gastou", "guardou"] as const) {
        if (!bate(transAntes[k], transDepois[k], 0.01)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Fechar outubro", telaErrada: `Transações de outubro (${k})`, esperado: brl(transAntes[k]), visto: brl(transDepois[k]) });
      }
      const parc = await lerParcelas(p, c);
      if (parcelasPrevistas.Nov != null && !bate(parc.topo ?? 0, parcelasPrevistas.Nov, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes de outubro (parcelas que continuam em novembro)", telaErrada: "Recorrentes de novembro (Parcelas)", esperado: brl(parcelasPrevistas.Nov), visto: brl(parc.topo) });
      await conferirMatriz(p, c, NOV, [9, 10, 11], "fechar outubro", {});
      await conferirMesPassado(p, c, OUT, "fechar outubro");
    });

    // ------------------------------------------------------------------ dezembro
    await dia(c, "2026-12-20 12:00", [p]);
    definirMesAtual(DEZ);
    // A sessão dura 30 dias: dois meses depois ela entra de novo.
    await entrar(p, "duda@exemplo.test");
    await passo(c, "dezembro: salário, presentes e as parcelas que a fatura projetou", async () => {
      await lancarAMao(p, { valor: 6000, categoria: "Salário", descricao: "Salário", entrada: true });
      await lancarAMao(p, { valor: 400, categoria: "Lazer", descricao: "Presentes" });
      const parc = await lerParcelas(p, c);
      if (parcelasPrevistas.Dez != null && !bate(parc.topo ?? 0, parcelasPrevistas.Dez, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes de outubro (parcelas que continuam em dezembro)", telaErrada: "Recorrentes de dezembro (Parcelas)", esperado: brl(parcelasPrevistas.Dez), visto: brl(parc.topo) });
      const { orc } = await conferirMatriz(p, c, DEZ, [9, 10, 11, 12], "dezembro", {});
      await conferirGastoPorCategoria(p, c, DEZ, "dezembro");
      await conferirLivre(p, c, orc, "dezembro");
    });

    await dia(c, "2026-12-30 21:00", [p]);
    await passo(c, "ceia no dia 30", async () => {
      await lancarAMao(p, { valor: 250, categoria: "Alimentação", descricao: "Ceia" });
      await conferirMatriz(p, c, DEZ, [9, 10, 11, 12], "ceia", {});
    });

    // ------------------------------------------------------------------ virada do ano
    await dia(c, "2027-01-02 09:00", [p]);
    definirMesAtual(JAN);
    await entrar(p, "duda@exemplo.test");
    await passo(c, "virar o ano: dezembro inteiro no Resumo, janeiro sem plano e sem R$ 0", async () => {
      const dez = somarTransacoes(await lerTransacoes(p, c, DEZ));
      const ficou = Math.round(dez.entrou - dez.gastou - dez.guardou);
      const mp = await lerMesPassadoDosNumeros(p, c, DEZ);
      if (!bate(mp.ficou, ficou, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Transações de dezembro", telaErrada: "Resumo de dezembro (na virada)", esperado: `ficou com você ${brl(ficou)}`, visto: brl(mp.ficou) });
      // Janeiro: sem plano, o livre não vira R$ 0 em lugar nenhum.
      const comprar = await lerPossoComprar(p, c).catch(() => null);
      if (comprar && (!/janeiro/.test(comprar.frase) || /R\$\s*0(?!\d)/.test(comprar.frase))) await c.anotar(p, { tipo: "numero", telaDeOrigem: "virar o ano", telaErrada: "Posso comprar", esperado: "Monte o plano de janeiro (sem R$ 0)", visto: comprar.frase });
      // O "Guardado em" do Resumo é do ano novo (ou não aparece), nunca o de 2026 em janeiro.
      const res = await lerResumoDosNumeros(p, c);
      if (res.guardadoNoAno && res.guardadoNoAno.ano !== 2027) await c.anotar(p, { tipo: "numero", telaDeOrigem: "virar o ano", telaErrada: "Resumo (Guardado em)", esperado: "Guardado em 2027 (ou nada)", visto: `Guardado em ${res.guardadoNoAno.ano}` });
      const parc = await lerParcelas(p, c);
      if (parcelasPrevistas.Jan != null && !bate(parc.topo ?? 0, parcelasPrevistas.Jan, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Recorrentes de outubro (parcelas que continuam em janeiro)", telaErrada: "Recorrentes de janeiro (Parcelas)", esperado: brl(parcelasPrevistas.Jan), visto: brl(parc.topo) });
      await conferirMatriz(p, c, JAN, [1], "virada do ano", {});
      await conferirMesPassado(p, c, DEZ, "virada do ano");
    });

    await passo(c, "fechar dezembro: 2026 fica como estava", async () => {
      const antes = await lerMesPassadoDosNumeros(p, c, DEZ);
      await fecharMes(p, "dezembro");
      const depois = await lerMesPassadoDosNumeros(p, c, DEZ);
      if (!bate(antes.ficou, depois.ficou, 0.01)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Fechar dezembro", telaErrada: "Resumo de dezembro", esperado: `ficou com você ${brl(antes.ficou)}`, visto: brl(depois.ficou) });
      await conferirMesPassado(p, c, DEZ, "fechar dezembro");
      await conferirMetas(p, c, "janeiro");
    });
  } finally {
    c.salvar();
  }
  exigirSemAchados(PERFIL, ["numero", "texto", "tela", "sumiu"]);
});
