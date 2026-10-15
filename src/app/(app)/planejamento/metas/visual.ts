import { chaveDoMes, type StatusDaMeta } from "@/lib/metas/projecao";
import type { MetaDaTela } from "@/lib/repositories/metas.repo";
import type { MetaParaEditar } from "./FolhaDaMeta";
import type { MoneyFormatter } from "@/lib/money";
import { prazoApertado, type LimiteDasMetas } from "@/lib/metas/prazo-que-cabe";

/**
 * O jeito de cada tema na área Metas (protótipos aprovados, rota #metas). A estrutura é a mesma
 * nos quatro; mudam onde fica o anel do cartão e alguns textos curtos:
 *
 * - Girly: anel ao lado do valor, embaixo da foto; "Nova meta" com o + à direita.
 * - Padrão: anel em cima da foto, valor e "de R$" na mesma linha.
 * - Manifestação e Titânio: anel na foto, barra e a chegada ("out/2028 · 20%") embaixo.
 */
export type JeitoDasMetas = {
  anelNaFoto: boolean;
  barraEChegada: boolean;
  /** "de R$ 71.000 · R$ 2.527 por mês" numa linha (Padrão) ou em duas (os outros). */
  resumoNumaLinha: boolean;
  /** "Guardado nas metas" em cima de tudo (Manifestação e Titânio) ou ao lado do anel. */
  rotuloNoTopo: boolean;
  /** Na "Próxima a chegar", o nome inteiro (Manifestação e Titânio) ou o curto. */
  proximaNomeInteiro: boolean;
  novaMetaSub: string;
  novaMetaMaisNaFrente: boolean;
};

export function jeitoDasMetas(tema: string): JeitoDasMetas {
  if (tema === "girly") {
    return { anelNaFoto: false, barraEChegada: false, resumoNumaLinha: false, rotuloNoTopo: false, proximaNomeInteiro: false, novaMetaSub: "Comece mais um sonho", novaMetaMaisNaFrente: false };
  }
  if (tema === "padrao") {
    return { anelNaFoto: true, barraEChegada: false, resumoNumaLinha: true, rotuloNoTopo: false, proximaNomeInteiro: false, novaMetaSub: "Comece mais um sonho", novaMetaMaisNaFrente: true };
  }
  return { anelNaFoto: true, barraEChegada: true, resumoNumaLinha: false, rotuloNoTopo: true, proximaNomeInteiro: true, novaMetaSub: "Nome, valor, prazo e foto", novaMetaMaisNaFrente: true };
}

export const TEXTO_DO_STATUS: Record<StatusDaMeta, string> = {
  ON_TRACK: "No ritmo",
  BEHIND: "Atrasada",
  ACHIEVED: "Concluída",
  SEM_PRAZO: "Sem prazo",
};

/** "Nova" só nos primeiros dias da meta (e ainda sem nenhum aporte). */
export const DIAS_DO_SELO_NOVA = 7;

export type TipoDoSelo = "concluida" | "prazo-apertado" | "atrasada" | "nova" | "no-ritmo" | "sem-prazo";
export type SeloDaMeta = { tipo: TipoDoSelo; texto: string };

/**
 * Um selo só por meta, o mais útil (15/10/2026: a Reserva aparecia ao mesmo tempo com "Prazo
 * apertado", "Nova" e "Próxima a chegar"). A ordem:
 * 1. Concluída;
 * 2. Prazo apertado (pede por mês mais do que cabe; o toque leva ao prazo que cabe);
 * 3. Atrasada;
 * 4. Nova: só nos primeiros dias, sem aporte, e se nada acima vale nem ela é a "Próxima a chegar";
 * 5. No ritmo / Sem prazo.
 * A "Próxima a chegar" nunca é uma meta de prazo apertado (ver `proximaAChegar` na página).
 */
export function seloDaMeta(e: { status: StatusDaMeta; nova: boolean; inicio: Date; hoje: Date; apertada: boolean; proxima?: boolean }): SeloDaMeta {
  if (e.status === "ACHIEVED") return { tipo: "concluida", texto: TEXTO_DO_STATUS.ACHIEVED };
  if (e.apertada) return { tipo: "prazo-apertado", texto: "Prazo apertado" };
  if (e.status === "BEHIND") return { tipo: "atrasada", texto: TEXTO_DO_STATUS.BEHIND };
  const dias = (e.hoje.getTime() - e.inicio.getTime()) / 86_400_000;
  if (e.nova && !e.proxima && dias < DIAS_DO_SELO_NOVA) return { tipo: "nova", texto: "Nova" };
  return e.status === "SEM_PRAZO" ? { tipo: "sem-prazo", texto: TEXTO_DO_STATUS.SEM_PRAZO } : { tipo: "no-ritmo", texto: TEXTO_DO_STATUS.ON_TRACK };
}

/** Prazo apertado: com prazo, aberta, e pedindo por mês mais do que cabe. A da Viagem edita no assistente dela, então fica sem. */
export function metaApertada(x: Pick<MetaDaTela, "prazo" | "daViagem" | "plano">, limite: LimiteDasMetas | null): boolean {
  return Boolean(x.prazo) && !x.daViagem && x.plano.status !== "ACHIEVED" && prazoApertado(x.plano.porMesNecessario, limite);
}

/** O que a folha de edição recebe de uma meta (lista e detalhe). */
export function metaParaEditar(meta: MetaDaTela): MetaParaEditar {
  return {
    id: meta.id,
    nome: meta.nome,
    tipo: meta.icon,
    alvo: meta.alvo,
    guardado: meta.guardado,
    prazo: meta.prazo ? chaveDoMes(meta.prazo.getFullYear(), meta.prazo.getMonth() + 1) : null,
    foto: meta.foto,
    combinado: meta.combinado,
    taxaAnual: meta.taxaAnual,
  };
}

/** A meta que nasceu no assistente de Viagem edita lá, com a viagem inteira. */
export const editarEmDaMeta = (meta: MetaDaTela) => (meta.daViagem ? `/viagem?meta=${meta.id}` : undefined);

/**
 * Um lançamento dela (o Pix achado, o aporte do mês, cada linha do "Mês a mês"): com os centavos
 * quando tem. Os totais da meta seguem redondos; o que ela digitou com centavos aparece igual
 * (14/10/2026: digitou R$ 1.000,01 e a linha mostrava R$ 1.000, como se o centavo tivesse sumido).
 */
export const valorDoLancamento = (money: MoneyFormatter, valor: number) => money(valor, { round: Math.round(Math.abs(valor) * 100) % 100 === 0 });

/**
 * O calendário do "Para quando?" (meses de 0 a 11, `hojeMi` = ano * 12 + mês de hoje). Trocar de
 * ano mantém o mês, ou pula para o primeiro que ainda vale. Null: o ano não tem mês que vale (em
 * dezembro, o ano de hoje inteiro já passou; antes, o "Ano anterior" caía em dezembro de hoje, um
 * prazo que o servidor recusa).
 */
export function mesAoTrocarDeAno(ano: number, mes: number, hojeMi: number): number | null {
  if (ano * 12 + mes > hojeMi) return mes;
  const primeiro = hojeMi + 1;
  return Math.floor(primeiro / 12) === ano ? primeiro % 12 : null;
}

/** O prazo da meta é deste mês ou de antes: não vale mais (a meta que venceu, ao editar). */
export const prazoJaPassou = (prazo: { ano: number; mes: number }, hojeMi: number) => prazo.ano * 12 + prazo.mes <= hojeMi;
