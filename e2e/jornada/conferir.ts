import type { Page } from "@playwright/test";
import type { Caderno } from "./achados";
import { bate, brl } from "./dinheiro";
import { BASE } from "./config";
import {
  lerAssinaturaEmRecorrentes,
  lerAssinaturaNoDinheiroPerdido,
  lerAssinaturaNoRaioX,
  lerDecidir,
  lerGastos,
  lerMetas,
  lerOrcamento,
  lerPossoComprar,
  lerRecorrentes,
  lerResumo,
  lerTransacoes,
  lerWidget,
  lerCarteira,
  lerDecidirDaMeta,
  lerGastosDoAno,
  lerMesPassadoDosNumeros,
  lerParcelas,
  lerResumoDosNumeros,
  somarTransacoes,
  type Mes,
  type RetratoDoOrcamento,
} from "./telas";

/**
 * As conferências entre telas. Cada função lê as telas que mostram o número (ou o aviso) que a
 * ação mexeu e anota no caderno o que não bate.
 */

export type Retrato = {
  orcamento?: RetratoDoOrcamento;
  porNome?: Record<string, number>;
};

/** Nome que a cliente vê ("Saúde") a partir da chave ("SAUDE"), lido do próprio Orçamento. */
export function nomeDaCategoria(o: RetratoDoOrcamento, chave: string): string {
  return o.categorias[chave]?.texto.split(" | ")[0] ?? chave;
}

/**
 * O gasto por categoria no mês tem que ser o mesmo no Orçamento, em Gastos e na soma das
 * Transações. Devolve o retrato do Orçamento para as próximas conferências.
 */
export async function conferirGastoPorCategoria(p: Page, c: Caderno, m: Mes, origem: string, opcoes: { atual?: boolean } = {}) {
  const orc = await lerOrcamento(p, c, m, opcoes.atual ?? true);
  const gastos = await lerGastos(p, c, m);
  const trans = await lerTransacoes(p, c, m);
  const somaTrans: Record<string, number> = {};
  for (const l of trans.linhas) if (l.valor < 0 && l.categoria && !/Guardado|Entrada/.test(l.categoria)) somaTrans[l.categoria] = (somaTrans[l.categoria] ?? 0) - l.valor;

  for (const [chave, cat] of Object.entries(orc.categorias)) {
    const nome = nomeDaCategoria(orc, chave);
    if (chave === "SEM") continue;
    const g = gastos.categorias[nome] ?? 0;
    const t = somaTrans[nome] ?? 0;
    if (!bate(cat.gasto, g)) await c.anotar(p, { tipo: "numero", telaDeOrigem: `Orçamento ${m.mes}/${m.ano}`, telaErrada: `Gastos ${m.mes}/${m.ano}`, esperado: `${nome} ${brl(cat.gasto)} (Orçamento)`, visto: brl(g), chave: `${c.perfil}|gasto-gastos|${nome}|${origem}` });
    if (!bate(cat.gasto, t)) await c.anotar(p, { tipo: "numero", telaDeOrigem: `Orçamento ${m.mes}/${m.ano}`, telaErrada: `Transações ${m.mes}/${m.ano}`, esperado: `${nome} ${brl(cat.gasto)} (Orçamento)`, visto: `${brl(t)} somando a lista`, chave: `${c.perfil}|gasto-trans|${nome}|${origem}` });
  }
  const totalOrc = Object.entries(orc.categorias).reduce((s, [, x]) => s + x.gasto, 0);
  if (gastos.total != null && !bate(totalOrc, gastos.total, 2)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: `Orçamento ${m.mes}/${m.ano}`, telaErrada: `Gastos ${m.mes}/${m.ano}`, esperado: `total ${brl(totalOrc)} (soma das categorias do Orçamento)`, visto: brl(gastos.total), chave: `${c.perfil}|total-gastos|${origem}` });
  }
  if (orc.gastou != null && !bate(orc.gastou + (orc.aVencer ?? 0), totalOrc, 2)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: `Orçamento ${m.mes}/${m.ano}`, telaErrada: `Orçamento ${m.mes}/${m.ano} (topo)`, esperado: `Gastou + a vencer = ${brl(totalOrc)} (soma das categorias)`, visto: `Gastou ${brl(orc.gastou)} + a vencer ${brl(orc.aVencer ?? 0)}`, chave: `${c.perfil}|gastou-topo|${origem}` });
  }
  if (orc.plano != null && orc.livres != null && !bate(orc.plano - totalOrc, orc.livres, 2)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: `Orçamento ${m.mes}/${m.ano}`, telaErrada: `Orçamento ${m.mes}/${m.ano} (topo)`, esperado: `livres = plano − gasto = ${brl(orc.plano - totalOrc)}`, visto: brl(orc.livres), chave: `${c.perfil}|livres-topo|${origem}` });
  }
  if (trans.contagem != null && trans.contagem !== trans.linhas.length) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: `Transações ${m.mes}/${m.ano}`, telaErrada: `Transações ${m.mes}/${m.ano}`, esperado: `${trans.linhas.length} lançamentos (linhas na lista)`, visto: `"${trans.contagem} lançamentos"`, chave: `${c.perfil}|contagem|${origem}` });
  }
  return { orc, gastos, trans };
}

/**
 * O "livre do mês" é UM número só (decisão da dona, 15/10/2026, lib/planning/livre-do-mes): o
 * Orçamento, os Recorrentes, o Decidir, o Posso comprar e o widget dizem o mesmo. Diferença aqui é
 * "numero" (derruba o teste), não mais "decisao". O da semana ("Livre nesta semana") é outro número:
 * só confere o "por dia" do Decidir com o do widget.
 */
export async function conferirLivre(p: Page, c: Caderno, orc: RetratoDoOrcamento, origem: string) {
  const rec = await lerRecorrentes(p, c);
  const dec = await lerDecidir(p, c);
  const comprar = await lerPossoComprar(p, c).catch(() => null);
  const w = await lerWidget(p, BASE);
  const livreOrc = orc.livres ?? (orc.acimaDoPlano != null ? -orc.acimaDoPlano : null);
  const widgetMes = "erro" in w || !w.mes || w.mes.valor == null ? null : /acima/.test(w.mes.rotulo) ? -w.mes.valor : w.mes.valor;
  const telas: [string, number | null, string][] = [
    ["Recorrentes", rec.livre, rec.livre == null ? "(sem número)" : brl(rec.livre)],
    ["Decidir (pílula Posso comprar)", dec.livres, dec.livres == null ? "(sem número)" : `${brl(dec.livres)} livres`],
    ["Posso comprar", comprar?.livreDoMes ?? null, comprar?.frase ?? "(não abriu o passo 5)"],
    ["widget (livre do mês)", widgetMes, "erro" in w ? w.erro : w.mes ? `${w.mes.valor} ${w.mes.rotulo}` : "(sem o campo mes)"],
  ];
  if (livreOrc != null) {
    for (const [tela, valor, visto] of telas) {
      // Recorrentes sem o cartão "Renda com dono" (sem renda) não tem onde mostrar o livre.
      if (valor == null && tela === "Recorrentes" && !/Renda com dono/.test(rec.texto)) continue;
      if (valor == null || !bate(valor, livreOrc, 1)) {
        await c.anotar(p, { tipo: "numero", telaDeOrigem: "Orçamento", telaErrada: tela, esperado: `livre do mês ${brl(livreOrc)} (Orçamento)`, visto, chave: `${c.perfil}|livre-${tela}|${origem}` });
      }
    }
  }
  if (!("erro" in w) && dec.porDia != null && w.livre.porDia != null && !bate(dec.porDia, w.livre.porDia, 1)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: "Decidir", telaErrada: "widget", esperado: `${brl(dec.porDia)} por dia (Decidir)`, visto: `${brl(w.livre.porDia)} por dia`, chave: `${c.perfil}|pordia-widget|${origem}` });
  }
  return { rec, dec, comprar, widget: w, livreOrc, widgetMes };
}

/** Metas: a tela de Metas e o widget dizem o mesmo guardado. */
export async function conferirMetas(p: Page, c: Caderno, origem: string, esperado?: Record<string, number>) {
  const metas = await lerMetas(p, c);
  const w = await lerWidget(p, BASE);
  if ("erro" in w) {
    await c.anotar(p, { tipo: "tela", telaDeOrigem: "Metas", telaErrada: "widget (/api/widget)", esperado: "números do widget", visto: w.erro, chave: `${c.perfil}|widget-erro` });
  } else {
    for (const wm of w.metas) {
      const naTela = Object.entries(metas.metas).find(([nome]) => nome === wm.nome || nome.startsWith(wm.nome) || wm.nome.startsWith(nome));
      if (!naTela) continue;
      if (!bate(naTela[1], wm.atual, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "Metas", telaErrada: "widget", esperado: `${wm.nome} ${brl(naTela[1])} (Metas)`, visto: brl(wm.atual), chave: `${c.perfil}|meta-widget|${wm.nome}|${origem}` });
    }
    const nomesWidget = new Set(w.metas.map((x) => x.nome));
    for (const nome of Object.keys(metas.metas)) if (!nomesWidget.has(nome) && w.metas.length < 3) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "Metas", telaErrada: "widget", esperado: `meta ${nome} no widget`, visto: "não está", chave: `${c.perfil}|meta-sumiu-widget|${nome}|${origem}` });
  }
  const soma = Object.values(metas.metas).reduce((s, v) => s + v, 0);
  if (metas.total != null && !bate(soma, metas.total, Object.keys(metas.metas).length)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: "Metas (cartões)", telaErrada: "Metas (topo)", esperado: `Guardado nas metas ${brl(soma)} (soma dos cartões)`, visto: brl(metas.total), chave: `${c.perfil}|metas-total|${origem}` });
  }
  if (esperado) {
    for (const [nome, v] of Object.entries(esperado)) {
      const naTela = metas.metas[nome];
      if (naTela == null) await c.anotar(p, { tipo: "sumiu", telaDeOrigem: "ação", telaErrada: "Metas", esperado: `meta ${nome} com ${brl(v)}`, visto: "não está na tela", chave: `${c.perfil}|meta-esperada|${nome}|${origem}` });
      else if (!bate(naTela, v, 1)) await c.anotar(p, { tipo: "numero", telaDeOrigem: "ação", telaErrada: "Metas", esperado: `${nome} ${brl(v)}`, visto: brl(naTela), chave: `${c.perfil}|meta-valor|${nome}|${origem}` });
    }
  }
  return metas;
}

/**
 * O aviso de uma categoria que passou: depois de respondido, some em TODAS as telas (Orçamento,
 * Decidir, pílula do Decidir, Resumo). Antes de respondido, tem que estar nas mesmas telas.
 */
export async function conferirAvisoDaCategoria(p: Page, c: Caderno, chave: string, nome: string, deveAparecer: boolean, origem: string) {
  const orc = await lerOrcamento(p, c, mesAtual());
  const dec = await lerDecidir(p, c);
  const res = await lerResumo(p, c);
  const lugares: [string, boolean, string][] = [
    // Antes da resposta: o topo mostra um aviso por vez, então basta a linha da categoria dizer "passou".
    deveAparecer
      ? ["Orçamento (categoria)", (!!orc.alerta && orc.alerta.startsWith(nome)) || /passou R\$/.test(orc.categorias[chave]?.texto ?? ""), orc.categorias[chave]?.texto ?? "(sem linha)"]
      : ["Orçamento (aviso do topo)", !!orc.alerta && orc.alerta.startsWith(nome), orc.alerta ?? "(nenhum)"],
    ["Decidir (pilha)", dec.cartoes.some((x) => x.id === `estouro-${chave}` || x.id === `ritmo-${chave}`), dec.cartoes.map((x) => x.id).join(", ") || "(nenhum)"],
    ["Decidir (pílula acima)", !!dec.acima && dec.acima.includes(nome), dec.acima ?? "(nenhuma)"],
    ["Resumo (sugestão)", !!res.sugestao && res.sugestao.texto.startsWith(nome), res.sugestao?.texto ?? "(nenhuma)"],
  ];
  await conferirContagemDoDecidir(p, c, res, dec, origem);
  for (const [tela, aparece, visto] of lugares) {
    // Antes da resposta só exigimos o aviso onde ele é regra (Orçamento e Decidir); o Resumo
    // mostra uma sugestão por vez e pode estar mostrando outra.
    // A pilha do Decidir também mostra um cartão por vez ("1 de 3").
    if (deveAparecer && !aparece && !tela.startsWith("Orçamento")) continue;
    if (aparece !== deveAparecer) {
      await c.anotar(p, {
        tipo: "aviso",
        telaDeOrigem: origem,
        telaErrada: tela,
        esperado: deveAparecer ? `aviso de ${nome} aparecendo` : `aviso de ${nome} some (já respondido)`,
        visto,
        chave: `${c.perfil}|aviso|${chave}|${tela}|${deveAparecer}`,
      });
    }
  }
  return { orc, dec, res };
}

/**
 * O "Mais N no Decidir" do Resumo conta exatamente os cartões da pilha do Decidir (15/10/2026: o
 * Resumo dizia "Mais 1 no Decidir" e o Decidir, "Tudo resolvido"). E o Decidir não diz "Tudo
 * resolvido" com algo esperando ("Mais 1 pode esperar: assinaturas" sumia).
 */
export async function conferirContagemDoDecidir(p: Page, c: Caderno, res: Awaited<ReturnType<typeof lerResumo>>, dec: Awaited<ReturnType<typeof lerDecidir>>, origem: string) {
  // Resumo sem a linha (primeiros passos, primeira vez) não promete nada: só confere quando ela existe.
  if (res.maisNoDecidir !== null && res.maisNoDecidir !== dec.naPilha) {
    await c.anotar(p, {
      tipo: "numero",
      telaDeOrigem: "Decidir",
      telaErrada: "Resumo (Mais N no Decidir)",
      esperado: dec.naPilha === 0 ? "nada chamando para o Decidir (a pilha está vazia)" : `${dec.naPilha} no Decidir (cartões da pilha)`,
      visto: `${res.maisNoDecidir} no Decidir`,
      chave: `${c.perfil}|mais-no-decidir|${origem}`,
    });
  }
  if (dec.naPilha === 0 && dec.esperam > 0 && dec.zero === "Tudo resolvido por hoje") {
    await c.anotar(p, { tipo: "texto", telaDeOrigem: "Decidir", telaErrada: "Decidir (pilha vazia)", esperado: `"Nada urgente por hoje" e os ${dec.esperam} que esperam à vista`, visto: dec.zero, chave: `${c.perfil}|tudo-resolvido-com-espera|${origem}` });
  }
}

let mesDaJornada: Mes = { ano: 2026, mes: 10 };
export function mesAtual() {
  return mesDaJornada;
}
export function definirMesAtual(m: Mes) {
  mesDaJornada = m;
}

/**
 * Um mês que já passou: o Resumo daquele mês, o Orçamento daquele mês e Gastos daquele mês
 * mostram o mesmo gasto por categoria (os três olham o mês inteiro).
 */
export async function conferirMesPassado(p: Page, c: Caderno, m: Mes, origem: string) {
  const res = await lerResumo(p, c, m);
  const { orc, gastos } = await conferirGastoPorCategoria(p, c, m, `${origem} (${m.mes}/${m.ano})`, { atual: false });
  for (const [nome, v] of Object.entries(res.categorias)) {
    const g = gastos.categorias[nome];
    if (g == null && v.valor === 0) continue;
    if (!bate(v.valor, g ?? 0)) await c.anotar(p, { tipo: "numero", telaDeOrigem: `Gastos ${m.mes}/${m.ano}`, telaErrada: `Resumo de ${m.mes}/${m.ano}`, esperado: `${nome} ${brl(g ?? 0)} (Gastos do mês)`, visto: `${brl(v.valor)} (${v.texto})`, chave: `${c.perfil}|resumo-passado|${nome}|${origem}` });
  }
  return { res, orc, gastos };
}

/**
 * A mesma assinatura nas três telas (regra única, lib/assinaturas): a última resposta, dada em
 * qualquer uma, aparece igual no Raio-X, em Recorrentes e no Dinheiro perdido.
 */
export async function conferirAssinaturaNasTres(
  p: Page,
  c: Caderno,
  nome: string,
  esperado: { raiox: string; recorrentes: string; perdido: string },
  telaDeOrigem: string,
) {
  const visto = {
    raiox: await lerAssinaturaNoRaioX(p, c, nome),
    recorrentes: await lerAssinaturaEmRecorrentes(p, c, nome),
    perdido: await lerAssinaturaNoDinheiroPerdido(p, c, nome),
  };
  const telas = { raiox: "Raio-X", recorrentes: "Recorrentes", perdido: "Dinheiro perdido" } as const;
  for (const k of ["raiox", "recorrentes", "perdido"] as const) {
    if (visto[k] !== esperado[k])
      await c.anotar(p, { tipo: "numero", telaDeOrigem, telaErrada: telas[k], esperado: `${nome}: ${esperado[k]}`, visto: `${nome}: ${visto[k]}`, chave: `${c.perfil}|assinatura|${telas[k]}|${nome}|${c.acao}` });
  }
  return visto;
}

// ------------------------------------------------------------------ Matriz "mesmo número, várias telas"
/**
 * A matriz dos números (pedido da dona, 15/10/2026: "as coisas precisam bater certinho"). Cada número
 * que aparece em mais de uma tela é lido em todas elas e comparado com a conta feita a partir da
 * lista de Transações, que é o que ela conferiria à mão:
 *  - gasto do mês: Transações, Orçamento (Gastou + a vencer), Gastos e o herói do Resumo;
 *  - entrou, guardou e ficou com você: Transações, o Resumo do mês passado e o do mês atual;
 *  - guardado no ano: a soma dos meses em Transações e o "Guardado em <ano>" do Resumo;
 *  - gasto do ano: a soma dos meses e Gastos › Ano;
 *  - parcelas: o topo de Recorrentes, o título da lista e a soma das parcelas;
 *  - próximos meses: o que o Resumo promete para o mês seguinte e as parcelas que continuam;
 *  - carteira: o total e a soma do "Por tipo";
 *  - meta: o "Falta guardar" do Decidir e o guardado do mês.
 * `mesesDoAno` são os meses com lançamento no ano (para o "Guardado em" e o gasto do ano).
 */
export async function conferirMatriz(p: Page, c: Caderno, m: Mes, mesesDoAno: number[], origem: string, opcoes: { planoDeGuardar?: number } = {}) {
  const achar = async (telaErrada: string, esperado: string, visto: string, chave: string) =>
    c.anotar(p, { tipo: "numero", telaDeOrigem: `Transações (soma da lista) · ${origem}`, telaErrada, esperado, visto, chave: `${c.perfil}|matriz|${chave}|${origem}` });

  // Os meses do ano pela lista de Transações (a conta "à mão").
  const porMes: Record<number, ReturnType<typeof somarTransacoes>> = {};
  for (const mes of mesesDoAno) porMes[mes] = somarTransacoes(await lerTransacoes(p, c, { ano: m.ano, mes }));
  const doMes = porMes[m.mes] ?? somarTransacoes(await lerTransacoes(p, c, m));
  // Mês ainda sem gasto: a tela sem número (estado vazio) também bate com zero.
  const bateOuVazio = (visto: number | null | undefined, esperado: number, folga = 1) => (visto == null ? Math.abs(esperado) < 1 : bate(visto, esperado, folga));

  // Gasto do mês: Orçamento (Gastou + a vencer), Gastos e o herói do Resumo.
  const orc = await lerOrcamento(p, c, m);
  const gastos = await lerGastos(p, c, m);
  const gastouOrc = orc.gastou != null ? orc.gastou + (orc.aVencer ?? 0) : null;
  if (!bateOuVazio(gastouOrc, doMes.gastou)) await achar("Orçamento (Gastou + a vencer)", `${brl(doMes.gastou)} saíram`, brl(gastouOrc), "gasto-orc");
  if (!bateOuVazio(gastos.total, doMes.gastou)) await achar("Gastos (Gastou)", `${brl(doMes.gastou)} saíram`, brl(gastos.total), "gasto-gastos");
  // Recorrentes antes do Resumo: a primeira visita a Recorrentes cadastra a conta que achou no
  // histórico ("Já está em Contas"), e só depois disso a previsão do Resumo conta com ela.
  const parc = await lerParcelas(p, c);
  const res = await lerResumoDosNumeros(p, c);
  // O herói do Resumo conta até hoje: só confere quando não há conta "a vencer" no mês.
  if (!orc.aVencer && res.gastoNoHeroi != null && /saíram/.test(res.heroi) && !bate(res.gastoNoHeroi, doMes.gastou, 1)) await achar("Resumo (herói)", `${brl(doMes.gastou)} saíram`, res.heroi.slice(0, 80), "gasto-resumo");

  // Guardado no ano e gasto do ano.
  const guardadoAno = Object.values(porMes).reduce((s, v) => s + v.guardou, 0);
  if (res.guardadoNoAno && (res.guardadoNoAno.ano !== m.ano || !bate(res.guardadoNoAno.valor, guardadoAno, 1))) await achar(`Resumo (Guardado em ${m.ano})`, `Guardado em ${m.ano} ${brl(guardadoAno)}`, `Guardado em ${res.guardadoNoAno.ano} ${brl(res.guardadoNoAno.valor)}`, "guardado-ano");
  const gastoAno = Object.values(porMes).reduce((s, v) => s + v.gastou, 0);
  const gastosAno = await lerGastosDoAno(p, c, m.ano);
  if (mesesDoAno.length && !bateOuVazio(gastosAno, gastoAno, mesesDoAno.length)) await achar(`Gastos › Ano ${m.ano}`, `${brl(gastoAno)} (soma dos meses)`, brl(gastosAno), "gasto-ano");

  // Ficou com você no mês passado: o Resumo do mês atual e o do mês passado dizem o mesmo, e é
  // entrou − gastou − guardou da lista.
  const passado = m.mes === 1 ? { ano: m.ano - 1, mes: 12 } : { ano: m.ano, mes: m.mes - 1 };
  const listaPassado = passado.ano === m.ano && porMes[passado.mes] ? porMes[passado.mes] : somarTransacoes(await lerTransacoes(p, c, passado));
  const ficou = Math.round(listaPassado.entrou - listaPassado.gastou - listaPassado.guardou);
  const mp = await lerMesPassadoDosNumeros(p, c, passado);
  if (listaPassado.entrou > 0) {
    if (!bate(mp.ficou, ficou, 1)) await achar(`Resumo de ${passado.mes}/${passado.ano}`, `ficou com você ${brl(ficou)}`, brl(mp.ficou), "ficou-passado");
    const pct = Math.round((ficou / listaPassado.entrou) * 100);
    if (mp.pct != null && Math.abs(mp.pct - pct) > 1) await achar(`Resumo de ${passado.mes}/${passado.ano}`, `${pct}% do que entrou`, `${mp.pct}%`, "ficou-pct");
    if (res.ficouPassado != null && !bate(res.ficouPassado, ficou, 1)) await achar("Resumo (Ficou com você no mês passado)", brl(ficou), brl(res.ficouPassado), "ficou-atual");
  }

  // Parcelas: topo de Recorrentes, título da lista e a soma das parcelas.
  const somaParcelas = parc.itens.reduce((s, x) => s + x.valor, 0);
  if (parc.itens.length && !bate(parc.topo, somaParcelas, 1)) await achar("Recorrentes (Parcelas, topo)", `${brl(somaParcelas)} (soma da lista)`, brl(parc.topo), "parcelas-topo");
  if (parc.itens.length && !bate(parc.doTitulo, somaParcelas, 1)) await achar("Recorrentes (Parcelas R$ X/mês)", `${brl(somaParcelas)} (soma da lista)`, brl(parc.doTitulo), "parcelas-titulo");
  // O mês seguinte do Resumo ("Próximos meses"): as contas e assinaturas de Recorrentes e as
  // parcelas que continuam (a previsão, lib/previsao/proximos-meses).
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const proximo = nomes[m.mes % 12];
  const continuam = parc.itens.filter((x) => x.faltam >= 2).reduce((s, x) => s + x.valor, 0);
  const previsto = continuam + (parc.contas ?? 0) + (parc.assinaturas ?? 0);
  if (res.proximos[proximo] != null && !bate(res.proximos[proximo], previsto, 1)) await achar(`Resumo (Próximos meses, ${proximo})`, `${brl(previsto)} (contas ${brl(parc.contas ?? 0)} + assinaturas ${brl(parc.assinaturas ?? 0)} + parcelas que continuam ${brl(continuam)}, de Recorrentes)`, brl(res.proximos[proximo]), "proximo-mes");

  // Carteira: total e "Por tipo".
  const cart = await lerCarteira(p, c);
  const somaTipos = cart.porTipo.reduce((s, v) => s + v, 0);
  if (cart.porTipo.length && !bate(cart.total, somaTipos, cart.porTipo.length)) await achar("Carteira (Sua carteira)", `${brl(somaTipos)} (soma do Por tipo)`, brl(cart.total), "carteira");

  // Meta do mês: "Falta guardar R$ X dos R$ 600" = plano − guardado do mês.
  if (opcoes.planoDeGuardar) {
    const dm = await lerDecidirDaMeta(p, c);
    const falta = Math.max(0, opcoes.planoDeGuardar - doMes.guardou);
    if (dm.faltaGuardar && !bate(dm.faltaGuardar.falta, falta, 1)) await achar("Decidir (Falta guardar)", `faltam ${brl(falta)} dos ${brl(opcoes.planoDeGuardar)} (guardou ${brl(doMes.guardou)})`, brl(dm.faltaGuardar.falta), "falta-guardar");
  }
  return { porMes, doMes, orc, res, parc, cart };
}
