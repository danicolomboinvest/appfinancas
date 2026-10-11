import type { ModoDaConta } from "@/lib/casal/acerto";

/**
 * O acerto do "conta por conta", refeito na tela a cada toque (sem esperar o servidor). É a mesma
 * conta do calcularAcerto (lib/casal/acerto.ts), só que sobre as contas já somadas; o teste confere
 * que as duas dão o mesmo valor.
 */

export type ContaParaAcerto = { chave: string; valor: number; pagou: { A: number; B: number } };

export function saldoDasContas(
  contas: ContaParaAcerto[],
  regras: Record<string, ModoDaConta | null | undefined>,
  fracoes: { renda: number; geral: number },
): { saldoA: number; fora: number; totalDaCasa: number } {
  let saldoA = 0;
  let fora = 0;
  let total = 0;
  for (const c of contas) {
    const modo = regras[c.chave];
    if (modo === "um_paga") {
      fora++;
      continue;
    }
    const f = modo === "renda" ? fracoes.renda : modo === "meio" ? 0.5 : fracoes.geral;
    saldoA += c.pagou.A - c.valor * f;
    total += c.valor;
  }
  return { saldoA: Math.round(saldoA * 100) / 100, fora, totalDaCasa: total };
}

/** Quem pagou a conta inteira (só assim dá para "um paga tudo"); nulo = os dois pagaram. */
export function quemPagouTudo(c: ContaParaAcerto): "A" | "B" | null {
  if (c.pagou.B === 0 && c.pagou.A > 0) return "A";
  if (c.pagou.A === 0 && c.pagou.B > 0) return "B";
  return null;
}

/** "Lucas manda R$ 458 pra Ana", em partes, para a tela montar com as bolinhas. */
export function direcao(saldoA: number): { de: "A" | "B"; para: "A" | "B"; valor: number } | null {
  const valor = Math.round(Math.abs(saldoA));
  if (valor < 1) return null;
  return saldoA > 0 ? { de: "B", para: "A", valor } : { de: "A", para: "B", valor };
}
