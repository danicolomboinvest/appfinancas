/**
 * "Antes de cancelar" (direção B "Folha", escolhida pela Dani em 11/10/2026). Uma pergunta, a
 * ajuda certa para aquele motivo e o "Quero cancelar mesmo" sempre à vista. Puro, sem banco.
 *
 * - Achei caro: 2 meses grátis, que adiam a próxima cobrança (a equipe soma os dias na Hubla e no
 *   Admin › Acessos em até 48 horas).
 * - Difícil de usar: a dúvida por texto ou ditada; a resposta vem do app@.
 * - Algo não está certo: a pessoa descreve e a equipe corrige em até 48 horas.
 * - Não uso mais: sem pausa; um aviso por e-mail 7 dias antes da renovação.
 * - Outro motivo: campo livre, opcional.
 * Cada oferta, uma vez a cada 12 meses por pessoa. Quem pagou no iPhone vê só o caminho da Apple.
 *
 * Os 7 dias do reembolso (direito de arrependimento, ajuste da Dani em 11/10): até 7 dias da compra,
 * a folha começa por "Ainda dá tempo", com o "Me avisa" (e-mail 1 dia antes do prazo acabar). Depois
 * dos 7 dias não há devolução: cancelar só impede a próxima renovação, e o acesso vai até a data.
 */
export type Motivo = "caro" | "dificil" | "errado" | "naouso" | "outro";
export type TipoDePedido = "meses_gratis" | "duvida" | "contestacao" | "aviso_renovacao" | "conversa" | "aviso_reembolso";

export const MOTIVOS: { chave: Motivo; rotulo: string }[] = [
  { chave: "caro", rotulo: "Achei caro" },
  { chave: "dificil", rotulo: "Difícil de usar" },
  { chave: "errado", rotulo: "Algo não está certo" },
  { chave: "naouso", rotulo: "Não uso mais" },
  { chave: "outro", rotulo: "Outro motivo" },
];

export const PEDIDO_DO_MOTIVO: Record<Motivo, TipoDePedido> = {
  caro: "meses_gratis",
  dificil: "duvida",
  errado: "contestacao",
  naouso: "aviso_renovacao",
  outro: "conversa",
};

export const MESES_GRATIS = 2;
export const PRAZO_HORAS = 48;
export const DIAS_DO_AVISO = 7;
export const AREAS = ["Saldo", "Orçamento", "Cartão", "Metas", "Outro"] as const;

const ANO_MS = 365 * 86_400_000;

/** A oferta volta a valer 12 meses depois do último pedido do mesmo tipo. */
export function ofertaDisponivel(ultimo: Date | null, agora: Date): boolean {
  return !ultimo || agora.getTime() - ultimo.getTime() >= ANO_MS;
}

/** O dia do aviso de quem escolheu "Não uso mais": 7 dias antes da renovação. */
export function diaDoAviso(renovacao: Date): Date {
  return new Date(Date.UTC(renovacao.getUTCFullYear(), renovacao.getUTCMonth(), renovacao.getUTCDate() - DIAS_DO_AVISO));
}

/** Os avisos que saem hoje: abertos, do tipo aviso, com o dia já chegado. */
export function avisosDeHoje<T extends { tipo: string; estado: string; avisarEm: Date | null }>(pedidos: T[], hoje: Date): T[] {
  return pedidos.filter((p) => (p.tipo === "aviso_renovacao" || p.tipo === "aviso_reembolso") && p.estado === "aberto" && !!p.avisarEm && p.avisarEm.getTime() <= hoje.getTime());
}

export const DIAS_DO_REEMBOLSO = 7;

/** O último dia para pedir o dinheiro de volta: a data da compra mais 7 dias. */
export function fimDoReembolso(compra: Date): Date {
  return new Date(Date.UTC(compra.getUTCFullYear(), compra.getUTCMonth(), compra.getUTCDate() + DIAS_DO_REEMBOLSO));
}

/** Ainda dá para pedir o reembolso? Vale até o fim do 7º dia depois da compra. */
export function dentroDoReembolso(compra: Date, hoje: Date): boolean {
  return hoje.getTime() < fimDoReembolso(compra).getTime() + 86_400_000;
}

/** O lembrete do "Me avisa": 1 dia antes de o prazo acabar. */
export function diaDoLembreteDoReembolso(compra: Date): Date {
  const fim = fimDoReembolso(compra);
  return new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate() - 1));
}

export type Tela = "reembolso" | "motivos" | "oferta" | "feito" | "caminho";
export type Acao = "escolher" | "aceitar" | "cancelar" | "voltar" | "contar";

/**
 * Por onde a folha anda. "cancelar" (o "Quero cancelar mesmo", que está em toda tela) leva sempre
 * ao caminho da Hubla ou da Apple. Quem pagou no iPhone começa direto no caminho.
 */
export function proximaTela(atual: Tela, acao: Acao): Tela {
  if (acao === "cancelar") return "caminho";
  if (acao === "escolher") return "oferta";
  if (acao === "aceitar") return "feito";
  if (acao === "contar") return "motivos";
  if (atual === "caminho" || atual === "feito") return "motivos";
  return "motivos";
}

export function telaInicial(via: "site" | "apple", noReembolso = false): Tela {
  if (via === "apple") return "caminho";
  return noReembolso ? "reembolso" : "motivos";
}
