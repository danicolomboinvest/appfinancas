import type { ParentCategory } from "@prisma/client";

/**
 * A categoria que o próprio banco escreve na fatura, traduzida para as categorias do app.
 *
 * Cliente (03/10/2026): "não aproveita as categorias que o PDF do banco traz". A fatura do Itaú
 * escreve embaixo de cada compra uma linha "alimentação SAO PAULO" (categoria + cidade), que o
 * leitor ignorava. O banco sabe o ramo da loja pelo cadastro dela na maquininha, coisa que o app
 * só adivinha pelo nome: "PAG*JOSEMARIA" não diz nada, "alimentação" diz.
 *
 * Por palavra e não por lista fechada: cada banco escreve do seu jeito e o PDF corta o texto
 * ("turismo e entretenim"). Categoria genérica do banco ("outros", "diversos", "serviços",
 * "vestuário", "eletrônicos") não vira nada: aí o app continua com o palpite dele.
 */
const MAPA: [RegExp, ParentCategory][] = [
  [/alimenta|supermerc|mercado|restaurante|padaria|lanchonete|bares/, "ALIMENTACAO"],
  [/sa[uú]de|farm[aá]c|drogaria|hospital|cl[ií]nica|m[eé]dic|odonto|[oó]tica/, "SAUDE"],
  [/ve[ií]cul|combust|posto|autom[oó]v|transporte|estacion|ped[aá]gio|mobilidade/, "TRANSPORTE"],
  [/educa|escola|livrar|curso/, "EDUCACAO"],
  [/turismo|entret|hobby|lazer|viage|hotel|cinema|a[eé]rea|hospedag/, "LAZER"],
  [/casa|resid[eê]n|moradia|constru|mobili|decora/, "MORADIA"],
];

export function categoriaDoBancoParaOApp(texto: string | null | undefined): ParentCategory | null {
  if (!texto) return null;
  const t = texto.toLowerCase().normalize("NFC");
  for (const [re, categoria] of MAPA) if (re.test(t)) return categoria;
  return null;
}
