import { chaveDoMes, type StatusDaMeta } from "@/lib/metas/projecao";
import type { MetaDaTela } from "@/lib/repositories/metas.repo";
import type { MetaParaEditar } from "./FolhaDaMeta";

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

export const textoDoSelo = (status: StatusDaMeta, nova: boolean) => (nova && status !== "ACHIEVED" ? "Nova" : TEXTO_DO_STATUS[status]);

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
