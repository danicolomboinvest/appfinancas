import { MAIOR_VALOR } from "@/lib/dinheiro/digitado";
/**
 * O "Digitar" do protótipo aprovado (11/10/2026): o valor sai de um teclado na tela, em
 * centavos, como numa maquininha ("4", "5", "9", "0" → 45,90). Sem teclado do celular, nada sobe
 * por cima da folha. Puro, para testar.
 */
export const MAX_CENTAVOS = MAIOR_VALOR * 100 - 1; // 9.999.999.999,99 na moeda dela (pesos: ver MAIOR_VALOR)

export function teclar(centavos: number, tecla: string): number {
  if (tecla === "del") return Math.floor(centavos / 10);
  if (!/^\d{1,2}$/.test(tecla)) return centavos;
  const novo = Number(String(centavos) + tecla);
  return novo > MAX_CENTAVOS ? centavos : novo;
}

/** Centavos → "45.90" (o formato do campo `amount` do servidor). */
export const paraDecimal = (centavos: number) => (centavos / 100).toFixed(2);

/** "Hoje", "Ontem" ou outra data → "YYYY-MM-DD" no relógio do Brasil. */
export function dataDoChip(chip: "hoje" | "ontem" | string, hoje: Date): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (chip === "ontem") d.setDate(d.getDate() - 1);
  else if (chip !== "hoje") return chip;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * O que falta antes de mandar para o servidor (14/10/2026). Gasto sem categoria ia até o servidor
 * e voltava "Escolha uma categoria": em 4 dias foram 15 vezes no registro de erros de produção, e
 * cada uma era uma ida e volta na rede de quem estava com o dedo no Salvar. Agora o aparelho já
 * responde na hora. Vazio = pode salvar.
 */
export function faltaParaSalvar(centavos: number, ehGasto: boolean, categoria: string | null): string | null {
  if (!centavos) return "Digite o valor primeiro";
  if (ehGasto && !categoria) return "Escolha a categoria";
  return null;
}

/** O dia que ela disse na fala vira o chip do Digitar: "ontem" é o chip Ontem; "anteontem", a data. */
export function chipDaFala(quando: "ontem" | "anteontem" | undefined, hoje: Date): string {
  if (quando === "ontem") return "ontem";
  if (quando === "anteontem") {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 2);
    return dataDoChip(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, hoje);
  }
  return "hoje";
}

const MESES_POR_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * A linha embaixo de "Repetir todo mês" (14/10/2026). Dizia "Vai aparecer em Recorrentes", mas o
 * app lança o mesmo valor em cada mês até dezembro, e nada aparece em Recorrentes. Agora diz o
 * que acontece. `data` = "AAAA-MM-DD" do lançamento.
 */
export function textoDoRepetir(data: string): string {
  const mes = Number(data.slice(5, 7));
  if (!(mes >= 1 && mes <= 12)) return "Lança também nos próximos meses, até dezembro.";
  if (mes === 12) return "Em dezembro, fica só este mês.";
  if (mes === 11) return "Lança também em dezembro.";
  return `Lança também de ${MESES_POR_EXTENSO[mes]} a dezembro.`;
}

/**
 * O teclado de verdade no Digitar (18/10/2026, a Dani, pedido de uma cliente no computador): a
 * tecla do teclado físico vira a tecla da tela. Números entram, Backspace e Delete apagam; o resto
 * (Enter, letras, setas) não mexe no valor. Null = não é tecla do valor.
 */
export function teclaDoTeclado(key: string): string | null {
  if (/^\d$/.test(key)) return key;
  if (key === "Backspace" || key === "Delete") return "del";
  return null;
}

/**
 * O teclado numérico do celular (18/10/2026): tocar no valor grande abre o teclado do aparelho, e
 * o que está no campo vira centavos como na maquininha ("4590" → 45,90). Só os dígitos contam
 * (vírgula, ponto e espaço que o teclado do aparelho põe são ignorados). Null = passou do
 * máximo, o valor fica como estava (como no teclado da tela).
 */
export function centavosDoCampo(texto: string): number | null {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "");
  if (!digitos) return 0;
  const n = Number(digitos);
  return n > MAX_CENTAVOS ? null : n;
}
