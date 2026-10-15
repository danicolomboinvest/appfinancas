import type { Page } from "@playwright/test";
import type { Caderno } from "./achados";
import { bate, brl } from "./dinheiro";
import { BASE } from "./config";
import {
  lerDecidir,
  lerGastos,
  lerMetas,
  lerOrcamento,
  lerPossoComprar,
  lerRecorrentes,
  lerResumo,
  lerTransacoes,
  lerWidget,
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

/** O "livre do mês" e o da semana: Orçamento, Recorrentes, Decidir, Posso comprar e widget. */
export async function conferirLivre(p: Page, c: Caderno, orc: RetratoDoOrcamento, origem: string) {
  const rec = await lerRecorrentes(p, c);
  const dec = await lerDecidir(p, c);
  const comprar = await lerPossoComprar(p, c).catch(() => null);
  const w = await lerWidget(p, BASE);
  const livreOrc = orc.livres ?? (orc.acimaDoPlano != null ? -orc.acimaDoPlano : null);
  if (rec.livre != null && livreOrc != null && !bate(rec.livre, livreOrc, 2)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: "Orçamento", telaErrada: "Recorrentes", esperado: `Livre ${brl(livreOrc)} (Orçamento: livres)`, visto: brl(rec.livre), chave: `${c.perfil}|livre-recorrentes|${origem}` });
  }
  if (dec.livres != null && livreOrc != null && !bate(dec.livres, livreOrc, 2)) {
    await c.anotar(p, { tipo: "decisao", telaDeOrigem: "Orçamento", telaErrada: "Decidir (pílula Posso comprar)", esperado: `${brl(livreOrc)} livres (Orçamento)`, visto: `${brl(dec.livres)} livres`, chave: `${c.perfil}|livre-decidir|${origem}` });
  }
  if (comprar?.livreDoMes != null && dec.livres != null && !bate(comprar.livreDoMes, dec.livres, 2)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: "Decidir", telaErrada: "Posso comprar", esperado: `livre ${brl(dec.livres)} (pílula do Decidir)`, visto: comprar.frase, chave: `${c.perfil}|livre-comprar|${origem}` });
  }
  if (comprar?.livreDoMes != null && livreOrc != null && !bate(comprar.livreDoMes, livreOrc, 2)) {
    await c.anotar(p, { tipo: "decisao", telaDeOrigem: "Orçamento", telaErrada: "Posso comprar", esperado: `livre ${brl(livreOrc)} (Orçamento: livres)`, visto: comprar.frase, chave: `${c.perfil}|livre-comprar-orc|${origem}` });
  }
  if (!("erro" in w) && dec.porDia != null && w.livre.porDia != null && !bate(dec.porDia, w.livre.porDia, 1)) {
    await c.anotar(p, { tipo: "numero", telaDeOrigem: "Decidir", telaErrada: "widget", esperado: `${brl(dec.porDia)} por dia (Decidir)`, visto: `${brl(w.livre.porDia)} por dia`, chave: `${c.perfil}|pordia-widget|${origem}` });
  }
  return { rec, dec, comprar, widget: w };
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
    ["Orçamento (aviso do topo)", !!orc.alerta && orc.alerta.startsWith(nome), orc.alerta ?? "(nenhum)"],
    ["Decidir (pilha)", dec.cartoes.some((x) => x.id === `estouro-${chave}` || x.id === `ritmo-${chave}`), dec.cartoes.map((x) => x.id).join(", ") || "(nenhum)"],
    ["Decidir (pílula acima)", !!dec.acima && dec.acima.includes(nome), dec.acima ?? "(nenhuma)"],
    ["Resumo (sugestão)", !!res.sugestao && res.sugestao.texto.startsWith(nome), res.sugestao?.texto ?? "(nenhuma)"],
  ];
  for (const [tela, aparece, visto] of lugares) {
    // Antes da resposta só exigimos o aviso onde ele é regra (Orçamento e Decidir); o Resumo
    // mostra uma sugestão por vez e pode estar mostrando outra.
    if (deveAparecer && !aparece && !tela.startsWith("Orçamento") && !tela.startsWith("Decidir (pilha)")) continue;
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

let mesDaJornada: Mes = { ano: 2026, mes: 10 };
export function mesAtual() {
  return mesDaJornada;
}
export function definirMesAtual(m: Mes) {
  mesDaJornada = m;
}
