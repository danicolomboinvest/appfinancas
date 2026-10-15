import { MARCAS } from "@/lib/marcas/catalogo";
import { normalizarDescricao } from "@/lib/marcas/marca";

/**
 * Os bancos que o cadastro do cartão oferece (15/10/2026), na ordem do mockup e depois os outros
 * grandes. O logo é o do catálogo de marcas (o mesmo das listas): `apelido` é o texto que o
 * LogoDoLancamento reconhece. "outro" não tem logo: quadrado neutro com o ícone do cartão.
 */
export type BancoDoCartao = { slug: string; nome: string; apelido: string };

const DO_CATALOGO = ["nubank", "itau", "inter", "c6bank", "santander", "bradesco", "bancodobrasil", "caixa", "btgpactual", "mercadopago", "picpay", "xp"];

export const BANCOS_DO_CARTAO: BancoDoCartao[] = [
  ...DO_CATALOGO.flatMap((slug) => {
    const m = MARCAS.find((x) => x.slug === slug);
    // Nome curto no botão: "C6 Bank" cabe, "XP Investimentos" vira "XP".
    return m ? [{ slug, nome: slug === "xp" ? "XP" : m.nome, apelido: m.apelidos[0] }] : [];
  }),
  { slug: "outro", nome: "Outro", apelido: "" },
];

export function bancoDoCartao(slug: string): BancoDoCartao {
  return BANCOS_DO_CARTAO.find((b) => b.slug === slug) ?? BANCOS_DO_CARTAO[BANCOS_DO_CARTAO.length - 1];
}

/** O nome que a tela mostra: o apelido dela, ou o nome do banco ("Cartão" quando é outro). */
export function nomeDoCartao(c: { banco: string; apelido: string | null }): string {
  if (c.apelido?.trim()) return c.apelido.trim();
  const b = bancoDoCartao(c.banco);
  return b.slug === "outro" ? "Cartão" : b.nome;
}

/**
 * O slug do banco que a importação reconheceu no arquivo ("Nubank", "Itaú", "C6 Bank", "BTG
 * Pactual", ver lib/import/profile.ts). Null quando não é um banco da lista.
 */
export function slugDoBancoLido(banco: string | null | undefined): string | null {
  if (!banco) return null;
  const t = normalizarDescricao(banco);
  if (!t) return null;
  const achado = BANCOS_DO_CARTAO.find((b) => b.slug !== "outro" && (normalizarDescricao(b.nome) === t || normalizarDescricao(b.apelido) === t));
  if (achado) return achado.slug;
  // "C6" sozinho, "BTG", "Banco Inter".
  const porMarca = MARCAS.find((m) => DO_CATALOGO.includes(m.slug) && m.apelidos.some((a) => ` ${t} `.includes(` ${a} `)));
  return porMarca?.slug ?? (t === "c6" ? "c6bank" : t === "inter" ? "inter" : null);
}

/**
 * Os 4 últimos dígitos do cartão impressos na fatura ("Final 1234", "**** 1234", "Final Cartão;1234"
 * na planilha do BTG). Fatura com cartão adicional traz mais de um: vale o que aparece mais vezes.
 */
export function finalDoCartao(texto: string): string | null {
  const conta = new Map<string, number>();
  const padroes = [
    /\bfinal(?:\s+(?:do\s+)?cart[ãa]o)?\s*[:;\-]?\s*(\d{4})\b/gi,
    /(?:[*•xX]{4}[\s.-]*){1,3}(\d{4})\b/g,
  ];
  for (const re of padroes) for (const m of texto.matchAll(re)) conta.set(m[1], (conta.get(m[1]) ?? 0) + 1);
  let melhor: string | null = null;
  for (const [f, n] of conta) if (melhor === null || n > (conta.get(melhor) ?? 0)) melhor = f;
  return melhor;
}
