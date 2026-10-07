/**
 * O nome do lançamento para MOSTRAR na importação (07/10/2026): sem o "Compra no débito - " ou o
 * "Transferência enviada pelo Pix - " na frente, que no celular ocupava a linha inteira e cortava
 * justamente o nome da loja ("Compra no débito - ..."). O meio vira uma etiqueta curta ao lado.
 *
 * Só para a tela: o que vai para o banco, para as regras e para a busca de repetidos continua sendo
 * a descrição original, inteira.
 */
const PREFIXOS: { re: RegExp; meio: string }[] = [
  { re: /^transfer[êe]ncia\s+enviada\s+(pelo\s+)?pix\s*[-–:]\s*/i, meio: "Pix enviado" },
  { re: /^transfer[êe]ncia\s+recebida\s+(pelo\s+)?pix\s*[-–:]\s*/i, meio: "Pix recebido" },
  { re: /^pix\s+enviado\s*[-–:]\s*/i, meio: "Pix enviado" },
  { re: /^pix\s+recebido\s*[-–:]\s*/i, meio: "Pix recebido" },
  { re: /^transfer[êe]ncia\s+enviada\s*[-–:]\s*/i, meio: "Transferência" },
  { re: /^transfer[êe]ncia\s+recebida\s*[-–:]\s*/i, meio: "Transferência" },
  { re: /^compra\s+no\s+d[ée]bito\s*[-–:]\s*/i, meio: "Débito" },
  { re: /^compra\s+no\s+cr[ée]dito\s*[-–:]\s*/i, meio: "Crédito" },
  { re: /^pagamento\s+de\s+boleto\s*[-–:]\s*/i, meio: "Boleto" },
  { re: /^d[ée]bito\s+autom[áa]tico\s*[-–:]\s*/i, meio: "Débito automático" },
];

/** Palavras que ficam minúsculas no meio do nome ("Escola de Idiomas"). */
const MIUDAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o"]);

/** "SUPERMERCADO EXEMPLO" vira "Supermercado Exemplo"; nome já com minúsculas fica como veio. */
function capitalizar(nome: string): string {
  if (/[a-zà-ú]/.test(nome)) return nome;
  return nome
    .toLowerCase()
    .split(/(\s+)/)
    .map((p, i) => (i > 0 && MIUDAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

export function nomeNaTela(descricao: string): { nome: string; meio: string | null } {
  const texto = descricao.trim();
  for (const { re, meio } of PREFIXOS) {
    if (re.test(texto)) {
      const resto = texto.replace(re, "").trim();
      if (resto) return { nome: capitalizar(resto), meio };
    }
  }
  return { nome: capitalizar(texto), meio: null };
}
