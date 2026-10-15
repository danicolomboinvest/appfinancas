import { nomeParecido } from "./parecido-manual";
import { ORIGEM_CARTAO, ORIGEM_CONTA, ORIGEM_DINHEIRO } from "@/lib/contas/paguei";

/**
 * O extrato chegou com o pagamento de uma conta que ela já marcou como "Paguei" (15/10/2026).
 *
 * O "Paguei" cria o gasto na hora (lib/contas/paguei.ts). Quando o extrato ou a fatura traz o
 * mesmo pagamento, os dois viram um só: fica a linha do extrato, com a categoria e a ligação da
 * conta, e o lançamento do "Paguei" sai. A tela mostra "já estava no app (Paguei)".
 *
 * O que faz o par (todas juntas):
 * - gasto com gasto, valor positivo;
 * - o mesmo valor (até R$ 0,01) ou, na conta que varia (luz, água), até 2% de diferença;
 * - até 5 dias entre o dia do "Paguei" e o do arquivo;
 * - a mesma origem quando houver: o "Paguei" da Conta Nubank só casa com o extrato do Nubank. O
 *   genérico ("Pix ou débito", "Cartão") casa com qualquer conta ou cartão do mesmo tipo. Dinheiro
 *   nunca está no extrato.
 *
 * Quase certo (o app junta sozinho e mostra em "já estavam no app", com "Anotar também"):
 * a origem é a mesma conta do arquivo E (o valor é igual OU o nome bate com o da conta).
 * Também quase certo: o genérico com valor igual e o nome que bate.
 * O resto que passa no critério é dúvida: vira a pergunta "É o mesmo?". Nada sai sem ela ver.
 * Uma linha com dois "Paguei" possíveis (ou o contrário) também vira dúvida.
 *
 * Puro, sem banco: import-actions busca os "Paguei" e aplica o resultado.
 */

export const TOLERANCIA_PAGUEI = {
  /** Distância máxima entre os dias. */
  dias: 5,
  /** Diferença máxima no valor da conta que varia. */
  varia: 0.02,
  /** "Valor igual". */
  centavo: 0.01,
} as const;

const DIA_MS = 86_400_000;

export type PagueiNoApp = {
  /** O id do lançamento que o "Paguei" criou. */
  id: string;
  contaAPagarId: string;
  /** O nome da conta ("Aluguel"). */
  nomeDaConta: string;
  amount: number;
  /** "AAAA-MM-DD". */
  date: string;
  /** "conta:nubank", "conta", "cartao", "dinheiro" ou null (sem origem guardada). */
  origem: string | null;
  /** A conta varia (luz): aceita até 2% de diferença. */
  varia: boolean;
};

export type LinhaParaPaguei = {
  key: number;
  /** "AAAA-MM-DD". */
  date: string;
  description: string;
  /** Com sinal, como seria gravado. */
  valor: number;
  category: string;
};

export type CasamentoComPaguei = { tipo: "certo" | "duvida"; paguei: PagueiNoApp };

function diasEntre(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DIA_MS);
}

/**
 * A origem do "Paguei" combina com a conta do arquivo? "mesma" (a mesma conta ou cartão),
 * "tipo" (um dos dois é genérico, do mesmo tipo, ou o "Paguei" não tem origem), ou null (não
 * combina: outro banco, conta com cartão, dinheiro). `contaDoArquivo` vem de origemDoLote, ou do
 * genérico ("conta", "cartao") quando o nome do arquivo não diz o banco.
 */
export function origemCombina(origem: string | null, contaDoArquivo: string | null): "mesma" | "tipo" | null {
  if (origem === ORIGEM_DINHEIRO) return null;
  if (origem === null || contaDoArquivo === null) return "tipo";
  const tipoDoArquivo = contaDoArquivo.startsWith("cartao") ? ORIGEM_CARTAO : ORIGEM_CONTA;
  const tipoDaOrigem = origem === ORIGEM_CONTA || origem === ORIGEM_CARTAO ? origem : origem.startsWith("cartao") ? ORIGEM_CARTAO : ORIGEM_CONTA;
  if (tipoDaOrigem !== tipoDoArquivo) return null;
  // Um dos dois é genérico (o "Paguei" em "Pix ou débito", ou o arquivo que não diz o banco).
  if (origem === ORIGEM_CONTA || origem === ORIGEM_CARTAO || contaDoArquivo === ORIGEM_CONTA || contaDoArquivo === ORIGEM_CARTAO) return "tipo";
  return origem === contaDoArquivo ? "mesma" : null;
}

/** O valor do arquivo cabe no valor do "Paguei"? Igual, ou até 2% na conta que varia. */
export function valorCombina(valorDoArquivo: number, p: Pick<PagueiNoApp, "amount" | "varia">): { cabe: boolean; igual: boolean } {
  const dif = Math.abs(Math.abs(valorDoArquivo) - Math.abs(p.amount));
  const igual = dif <= TOLERANCIA_PAGUEI.centavo + 1e-9;
  return { cabe: igual || (p.varia && dif <= Math.abs(p.amount) * TOLERANCIA_PAGUEI.varia + 1e-9), igual };
}

/** Esta linha é o pagamento deste "Paguei"? "certo", "duvida" ou null. */
export function compararComPaguei(linha: LinhaParaPaguei, p: PagueiNoApp, contaDoArquivo: string | null): "certo" | "duvida" | null {
  if (linha.category !== "EXPENSE" || !(linha.valor > 0) || !(p.amount > 0)) return null;
  if (!Number.isFinite(Date.parse(`${linha.date}T12:00:00Z`)) || !Number.isFinite(Date.parse(`${p.date}T12:00:00Z`))) return null;
  if (diasEntre(linha.date, p.date) > TOLERANCIA_PAGUEI.dias) return null;
  const v = valorCombina(linha.valor, p);
  if (!v.cabe) return null;
  const origem = origemCombina(p.origem, contaDoArquivo);
  if (!origem) return null;
  const nomeBate = nomeParecido(linha.description, p.nomeDaConta);
  if (origem === "mesma" && (v.igual || nomeBate)) return "certo";
  if (origem === "tipo" && v.igual && nomeBate) return "certo";
  return "duvida";
}

/**
 * Casa as linhas do arquivo com os "Paguei". Cada "Paguei" casa com UMA linha e cada linha com um
 * "Paguei": o mais perto no dia e no valor ganha. A linha (ou o "Paguei") que tinha mais de um par
 * possível fica como dúvida, para ela escolher.
 */
export function casarComPaguei(linhas: LinhaParaPaguei[], pagueis: PagueiNoApp[], contaDoArquivo: string | null): Map<number, CasamentoComPaguei> {
  const pares: { linha: LinhaParaPaguei; p: PagueiNoApp; tipo: "certo" | "duvida"; dias: number; dif: number }[] = [];
  for (const linha of linhas) {
    for (const p of pagueis) {
      const tipo = compararComPaguei(linha, p, contaDoArquivo);
      if (tipo) pares.push({ linha, p, tipo, dias: diasEntre(linha.date, p.date), dif: Math.abs(Math.abs(linha.valor) - p.amount) });
    }
  }
  const porLinha = new Map<number, number>();
  const porPaguei = new Map<string, number>();
  for (const x of pares) {
    porLinha.set(x.linha.key, (porLinha.get(x.linha.key) ?? 0) + 1);
    porPaguei.set(x.p.id, (porPaguei.get(x.p.id) ?? 0) + 1);
  }
  pares.sort((a, b) => Number(a.tipo === "duvida") - Number(b.tipo === "duvida") || a.dif - b.dif || a.dias - b.dias);
  const resultado = new Map<number, CasamentoComPaguei>();
  const usados = new Set<string>();
  for (const x of pares) {
    if (resultado.has(x.linha.key) || usados.has(x.p.id)) continue;
    usados.add(x.p.id);
    const disputado = (porLinha.get(x.linha.key) ?? 0) > 1 || (porPaguei.get(x.p.id) ?? 0) > 1;
    resultado.set(x.linha.key, { tipo: disputado ? "duvida" : x.tipo, paguei: x.p });
  }
  return resultado;
}

/**
 * Conferência na gravação (o id veio do cliente): o lançamento ainda é um "Paguei" que casa com a
 * linha pelo critério de cima (dúvida também vale: ela respondeu "É o mesmo"). Protege de um id
 * trocado; fora disso a linha entra como nova e nada é apagado.
 */
export function confirmaOPaguei(linha: Pick<LinhaParaPaguei, "date" | "valor">, p: Pick<PagueiNoApp, "amount" | "date" | "varia">): boolean {
  if (!(linha.valor > 0) || !(p.amount > 0)) return false;
  if (diasEntre(linha.date, p.date) > TOLERANCIA_PAGUEI.dias) return false;
  return valorCombina(linha.valor, p).cabe;
}
