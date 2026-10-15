/**
 * O nome do lançamento para MOSTRAR na importação (07/10/2026): sem o "Compra no débito - " ou o
 * "Transferência enviada pelo Pix - " na frente, que no celular ocupava a linha inteira e cortava
 * justamente o nome da loja ("Compra no débito - ..."). O meio vira uma etiqueta curta ao lado.
 *
 * Só para a tela: o que vai para o banco, para as regras e para a busca de repetidos continua sendo
 * a descrição original, inteira.
 */
const SEP = String.raw`\s*(?:[-–:·]\s*)?`;
const PREFIXOS: { re: RegExp; meio: string }[] = [
  { re: new RegExp(String.raw`^transfer[êe]ncia\s+(?:pix\s+)?enviad[ao]\s+(?:pelo\s+|via\s+)?(?:pix\s+)?(?:para\s+)?` + SEP, "i"), meio: "Pix enviado" },
  { re: new RegExp(String.raw`^transfer[êe]ncia\s+(?:pix\s+)?recebid[ao]\s+(?:pelo\s+|via\s+)?(?:pix\s+)?(?:de\s+)?` + SEP, "i"), meio: "Pix recebido" },
  { re: new RegExp(String.raw`^pix\s+enviad[ao]\s+(?:para\s+)?` + SEP, "i"), meio: "Pix enviado" },
  { re: new RegExp(String.raw`^pix\s+recebid[ao]\s+(?:de\s+)?` + SEP, "i"), meio: "Pix recebido" },
  { re: new RegExp(String.raw`^(?:ted|doc)\s+(?:enviad[ao]|recebid[ao])\s+` + SEP, "i"), meio: "Transferência" },
  { re: new RegExp(String.raw`^compra\s+(?:no\s+)?d[ée]bito\s+` + SEP, "i"), meio: "Débito" },
  { re: new RegExp(String.raw`^compra\s+(?:no\s+)?cr[ée]dito\s+` + SEP, "i"), meio: "Crédito" },
  // "Pagamento de boleto efetuado DAS-SIMPLES" (Nubank PJ): sem o "efetuado", a tela mostrava "efetuado DAS-SIMPLES".
  { re: new RegExp(String.raw`^pagamento\s+de\s+boleto\s+(?:efetuado\s+|devolvido\s+)?` + SEP, "i"), meio: "Boleto" },
  { re: new RegExp(String.raw`^d[ée]bito\s+autom[áa]tico\s+` + SEP, "i"), meio: "Débito automático" },
];
// Os antigos, com o separador obrigatório: "Transferência enviada - X", "Compra no débito - X".
PREFIXOS.push(
  { re: /^transfer[êe]ncia\s+enviada\s*[-–:]\s*/i, meio: "Transferência" },
  { re: /^transfer[êe]ncia\s+recebida\s*[-–:]\s*/i, meio: "Transferência" },
  { re: /^compra\s+no\s+d[ée]bito\s*[-–:]\s*/i, meio: "Débito" },
  { re: /^compra\s+no\s+cr[ée]dito\s*[-–:]\s*/i, meio: "Crédito" },
  { re: /^pagamento\s+de\s+boleto\s*[-–:]\s*/i, meio: "Boleto" },
);

/** CPF/CNPJ, agência e conta, e o banco entre parênteses: vão para o detalhe, não para o nome. */
const DOCUMENTO = /^[\d.\/\-•*\s]+$|\b\d{2,3}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
const BANCO = /\(\d{3,4}\)\s*$|\b(banco|bco|unibanco|ag[êe]ncia|ag|conta|cc)\b/i;
/** "LIMITADA", "LTDA", "S.A.", "ME", "EIRELI", "EPP" no fim do nome da empresa. */
const SUFIXO_SOCIETARIO = /[\s,.]+(limitada|ltda\.?|s\.?\/?a\.?|me|eireli|epp|mei)\.?$/i;

/** Do que sobrou depois do prefixo, o primeiro pedaço que é nome (não documento nem banco). */
function soONome(resto: string): string {
  const pedacos = resto.split(/\s+[-–]\s+/).map((p) => p.trim()).filter(Boolean);
  const nome = pedacos.find((p) => !DOCUMENTO.test(p) && !(BANCO.test(p) && pedacos.indexOf(p) > 0)) ?? pedacos[0] ?? resto;
  let limpo = nome.replace(/\s*\(\d{3,4}\)\s*$/, "").trim();
  for (let i = 0; i < 2; i++) limpo = limpo.replace(SUFIXO_SOCIETARIO, "").trim();
  return limpo || nome;
}

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
      if (resto) return { nome: capitalizar(soONome(resto)), meio };
    }
  }
  return { nome: capitalizar(texto.includes(" - ") ? soONome(texto) : texto), meio: null };
}
