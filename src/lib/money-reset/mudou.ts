import { marco } from "./missoes";

/**
 * "O que já mudou no seu SPI", na tela de missão feita. A regra é a do `mudou` em missoes.ts:
 * sempre verdade. Quem pulou o passo pelo atalho honesto ("Não uso cartão", "Não tenho dívida",
 * "Seguir mesmo assim" sem extrato) não pode ler que as parcelas entraram ou que o Raio-X guardou
 * uma decisão que ela nunca tomou. Aqui a lista sai do que aconteceu de verdade; vazia, a tela
 * esconde o cartão. Puro.
 */

type Resposta = { texto: string; dados: unknown } | undefined;

/** Só os campos que importam aqui, de cada formato de DadosDoMarco (dados.ts). */
export type DadosParaMudou = {
  n: number;
  itens?: unknown[];
  decididos?: Record<string, string>;
  fixas?: unknown[];
  parcelas?: number;
  pior?: string | null;
  guardar?: number | null;
  fatias?: unknown[];
  dividas?: unknown[];
};

export function oQueMudou(n: number, dados: DadosParaMudou, respostas: Record<string, Resposta>): string[] {
  const m = marco(n);
  if (!m) return [];
  // A missão foi aberta sem os números (a Dani conferindo): fica o texto da missão.
  if (dados.n !== n) return m.mudou;
  switch (n) {
    case 2:
      if (respostas.fatura?.texto === "sem cartao") return ["Anotado: você não usa cartão de crédito"];
      return m.mudou;
    case 3: {
      if (!dados.itens?.length) return [];
      const escolhas = Object.values(dados.decididos ?? {});
      if (escolhas.length === 0) return [];
      const cortou = escolhas.some((e) => e === "raiox_cancelar" || e === "raiox_metade");
      return cortou ? m.mudou : [m.mudou[0]];
    }
    case 4: {
      const out: string[] = [];
      if ((dados.fixas?.length ?? 0) > 0 || (dados.parcelas ?? 0) > 0) out.push(m.mudou[0]);
      const negociar = (respostas.fixas?.dados as { negociar?: unknown } | null | undefined)?.negociar;
      if (typeof negociar === "string" && negociar) out.push(m.mudou[1]);
      return out;
    }
    case 5:
      // Sem a categoria que passa da régua não há teto: fica só a dica combinada.
      if (!dados.pior) return respostas.dica?.texto ? ["A dica da semana ficou combinada"] : [];
      return m.mudou;
    case 12:
      if (!dados.guardar || !dados.fatias?.length) return [];
      return m.mudou;
    case 13:
      if (respostas.dividas?.texto === "nenhuma" || !dados.dividas?.length) return ["Anotado: nenhuma dívida em aberto"];
      return m.mudou;
    default:
      return m.mudou;
  }
}
