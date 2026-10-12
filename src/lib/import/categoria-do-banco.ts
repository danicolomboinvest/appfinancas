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
  // 12/10/2026: "comércio de alimentos", "alimentos", "food", "fast food", "lanchonete / bar" (C6),
  // "bares e restaurantes" (BTG), "RESTAURANTES" (Inter), "restaurante" (Nubank).
  [/aliment|supermerc|mercado|mercearia|restaur|padaria|panifica|lanchonete|\bbares?\b|\bfood\b|confeitaria|hortifruti|a[cç]ougue|delivery/, "ALIMENTACAO"],
  [/sa[uú]de|farm[aá]c|drogaria|hospital|cl[ií]nica|m[eé]dic|odonto|[oó]tica|laborat/, "SAUDE"],
  [/ve[ií]cul|combust|posto|autom[oó]v|transporte|estacion|ped[aá]gio|mobilidade|gasolina/, "TRANSPORTE"],
  [/educa|escola|livrar|curso/, "EDUCACAO"],
  [/turismo|entret|hobby|lazer|viage|hotel|cinema|a[eé]rea|hospedag|streaming/, "LAZER"],
  [/casa|resid[eê]n|moradia|constru|mobili|decora/, "MORADIA"],
];
/**
 * MCC (o código de ramo da maquininha, 4 dígitos), quando o arquivo traz ele em vez do nome do
 * ramo. Só os códigos que não deixam dúvida; loja de departamento, serviço e afins ficam de fora.
 */
function categoriaDoMcc(mcc: number): ParentCategory | null {
  if ([5411, 5422, 5441, 5451, 5462, 5499, 5811, 5812, 5813, 5814].includes(mcc)) return "ALIMENTACAO";
  if ([5912, 8011, 8021, 8031, 8041, 8042, 8043, 8049, 8050, 8062, 8071, 8099].includes(mcc)) return "SAUDE";
  if ([4111, 4121, 4131, 4784, 5541, 5542, 7523, 7531, 7538, 7542].includes(mcc)) return "TRANSPORTE";
  if ([5942, 8211, 8220, 8241, 8244, 8249, 8299].includes(mcc)) return "EDUCACAO";
  if ((mcc >= 3000 && mcc <= 3999) || [4411, 4511, 4722, 7011, 7832, 7922, 7991, 7996].includes(mcc)) return "LAZER";
  return null;
}

export function categoriaDoBancoParaOApp(texto: string | null | undefined): ParentCategory | null {
  if (!texto) return null;
  const mcc = texto.trim().match(/^(?:mcc\s*)?(\d{4})$/i);
  if (mcc) return categoriaDoMcc(Number(mcc[1]));
  const t = texto.toLowerCase().normalize("NFC").replace(/[_]+/g, " ");
  for (const [re, categoria] of MAPA) if (re.test(t)) return categoria;
  return null;
}
