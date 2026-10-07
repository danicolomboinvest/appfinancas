/**
 * Textos das Contas a pagar (05/10/2026), na voz do Padrão. Cada tema sobrescreve em
 * `vozes/<tema>.ts`. Prefixo `contas`.
 *
 * Os números e as datas chegam já formatados (texto). As funções aceitam qualquer coisa: o teste
 * de jargão chama todas com ("Mercado", "R$ 10", 3).
 */

import type { Situacao } from "@/lib/contas/contas";

export type TextosContas = {
  contasTitulo: string;
  contasSub: string;
  contasVazio: string;
  contasVazioSub: string;
  contasNova: string;
  contasEditarTitulo: string;
  contasNome: string;
  contasNomeExemplo: string;
  contasValor: string;
  contasValorMuda: string;
  contasValorMudaHint: string;
  contasVencimento: string;
  contasRepete: string;
  contasRepeteHint: string;
  contasLembrar: string;
  contasLembrarHint: string;
  contasSalvar: string;
  contasCancelar: string;
  contasApagar: string;
  /** Soma das atrasadas e das que vencem em 7 dias (as de valor que muda ficam de fora). */
  contasTotalSemana: (valor: string) => string;
  contasPaguei: string;
  contasDesfazer: string;
  /** Depois do "paguei". `proxima` vem formatada ("10/11") ou vazia na que não repete. */
  contasPagaToast: (nome: string, proxima?: string | null) => string;
  /** "Atrasada há 2 dias", "Vence hoje", "Vence amanhã", "Vence em 4 dias", "Vence 20/11". */
  contasQuando: (situacao: Situacao, dias: number, data: string) => string;
  contasValorVaria: string;
  contasRepeteSelo: string;
  contasGrupoAtrasadas: string;
  contasGrupoSemana: string;
  contasGrupoDepois: string;
  contasGrupoPagas: string;
  contasPagaEm: (data: string) => string;
  // Foco
  contasFocoEy: string;
  contasFocoTitulo: (atrasadas: number, naSemana: number) => string;
  contasFocoVerTodas: string;
  contasFocoAnotar: string;
  contasFocoNenhuma: string;
  // Gaveta do "+"
  contasRegistrar: string;
  contasRegistrarSub: string;
  // Lembrete (notificação e e-mail)
  contasLembreteTitulo: (nome: string, quando: "vespera" | "dia") => string;
  contasLembreteCorpo: (valor: string | null) => string;
  contasEmailAssunto: (nome: string, total: number) => string;
  contasEmailIntro: string;
  contasEmailBotao: string;
  contasEmailRodape: string;
};

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const dias = (d: number) => `${d} ${d === 1 ? "dia" : "dias"}`;

export const PADRAO_CONTAS: TextosContas = {
  contasTitulo: "Contas a pagar",
  contasSub: "Anote o que vence e o app avisa um dia antes e no dia.",
  contasVazio: "Nenhuma conta anotada",
  contasVazioSub: "O app avisa um dia antes e no dia.",
  contasNova: "Nova conta",
  contasEditarTitulo: "Editar conta",
  contasNome: "O que é",
  contasNomeExemplo: "Ex.: luz, aluguel, escola",
  contasValor: "Valor",
  contasValorMuda: "O valor muda todo mês",
  contasValorMudaHint: "Luz, água, fatura do cartão. O lembrete vem do mesmo jeito.",
  contasVencimento: "Vence em",
  contasRepete: "Repete todo mês",
  contasRepeteHint: "Quando você marcar que pagou, ela volta para o mês seguinte.",
  contasLembrar: "Me lembrar",
  contasLembrarHint: "Um dia antes e no dia do vencimento.",
  contasSalvar: "Salvar",
  contasCancelar: "Cancelar",
  contasApagar: "Apagar conta",
  contasTotalSemana: (valor) => `${valor} para pagar nos próximos 7 dias.`,
  contasPaguei: "Paguei",
  contasDesfazer: "Desfazer",
  contasPagaToast: (nome, proxima) => (proxima ? `${nome} paga. A próxima vence ${proxima}.` : `${nome} paga.`),
  contasQuando: (situacao, d, data) => {
    switch (situacao) {
      case "atrasada": return `Atrasada há ${dias(Math.abs(n(d)))}`;
      case "hoje": return "Vence hoje";
      case "amanha": return "Vence amanhã";
      case "semana": return `Vence em ${dias(n(d))}`;
      default: return `Vence ${data}`;
    }
  },
  contasValorVaria: "Valor muda",
  contasRepeteSelo: "Todo mês",
  contasGrupoAtrasadas: "Atrasadas",
  contasGrupoSemana: "Próximos 7 dias",
  contasGrupoDepois: "Mais adiante",
  contasGrupoPagas: "Pagas há pouco",
  contasPagaEm: (data) => `Paga em ${data}`,
  contasFocoEy: "Contas a pagar",
  contasFocoTitulo: (atrasadas, naSemana) => {
    const a = n(atrasadas);
    const s = n(naSemana);
    if (a > 0) return a === 1 ? "1 conta atrasada" : `${a} contas atrasadas`;
    return s === 1 ? "1 conta vence esta semana" : `${s} contas vencem esta semana`;
  },
  contasFocoVerTodas: "Ver todas",
  contasFocoAnotar: "Anotar conta",
  contasFocoNenhuma: "Nada vencendo nos próximos 7 dias.",
  contasRegistrar: "Conta a pagar",
  contasRegistrarSub: "Anote o vencimento e o app lembra.",
  contasLembreteTitulo: (nome, quando) => (quando === "vespera" ? `${nome} vence amanhã` : `${nome} vence hoje`),
  contasLembreteCorpo: (valor) => (valor ? `${valor}. Quando pagar, marque no app.` : "Confira o valor e marque no app quando pagar."),
  contasEmailAssunto: (nome, total) => (n(total) > 1 ? `${n(total)} contas vencendo` : `${nome} está vencendo`),
  contasEmailIntro: "Lembrete das contas que você anotou:",
  contasEmailBotao: "Abrir minhas contas",
  contasEmailRodape: "Você recebe este lembrete porque marcou \"Me lembrar\" na conta. Dá para desligar em cada uma.",
};
