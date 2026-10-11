import type { AcertoDoMes } from "@/lib/repositories/casal.repo";
import type { DadosDoRecibo } from "@/components/casal-login/ReciboDoAcerto";
import type { DadosDaDivisao } from "@/components/casal-login/CombinarDivisao";

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "Pela renda · 55 e 45", "Meio a meio", "Combinado · 60 e 40" ou "Por conta" (com regra por conta). */
export function rotuloDoJeito(a: AcertoDoMes): string {
  const temRegra = a.contas.some((c) => c.modo !== null);
  if (temRegra) return "Por conta";
  const p = Math.round(a.fracaoA * 100);
  if (a.config.divisao === "meio" || a.caiuParaMeio) return "Meio a meio";
  return `${a.config.divisao === "combinado" ? "Combinado" : "Pela renda"} · ${p} e ${100 - p}`;
}

export function dadosDoRecibo(a: AcertoDoMes, letraTitular: "A" | "B"): DadosDoRecibo {
  return {
    ano: a.ano,
    mes: a.mes,
    nomes: { A: a.config.nomeA, B: a.config.nomeB },
    letraTitular,
    saldoA: a.saldoA,
    pagou: a.pagou,
    parte: a.parte,
    totalDaCasa: a.totalDaCasa,
    jeito: rotuloDoJeito(a),
    acertado: a.acertado,
    semDono: a.semDono.quantidade,
  };
}

/**
 * Os dados do passo a passo. A renda vai em valor só para a titular, ou para o par quando ela
 * mostrou (o carregarAcertoDoMes já zera para o par; aqui ela nem é enviada).
 */
export function dadosDaDivisao(a: AcertoDoMes, o: { letraTitular: "A" | "B"; souPar: boolean; plano: number | null; mostrarRenda: boolean }): DadosDaDivisao {
  const nomeDoMes = MESES[a.mes - 1];
  const verValores = !o.souPar || o.mostrarRenda;
  return {
    nomes: { A: a.config.nomeA, B: a.config.nomeB },
    letraTitular: o.letraTitular,
    souPar: o.souPar,
    rendas: verValores ? { A: a.rendas.A, B: a.rendas.B } : null,
    fracaoRenda: a.fracaoRenda,
    base: o.plano ? { valor: o.plano, rotulo: "plano da casa" } : { valor: a.totalDaCasa, rotulo: `casa em ${nomeDoMes}` },
    divisao: a.config.divisao,
    pctA: a.config.pctA ?? null,
    mostrarRenda: o.mostrarRenda,
    contasComJeitoProprio: a.contas.filter((c) => c.modo !== null).length,
    nomeDoMes,
  };
}
