/**
 * O ícone de categoria de cada tema.
 *
 * Dois temas trocam o ícone de linha por emoji: o Girly (a Dani pediu "não sei se coloca
 * emoji", e os desenhos aprovados já traziam 🛒 🏠 💅) e o Sem filtro, que ri da situação — o
 * leão 🦁 nos impostos é a piada que todo brasileiro entende. Os outros cinco ficam com o
 * ícone de linha, cada um no seu estilo (ver CategoryIcon e as variáveis --icon-* dos temas).
 *
 * Fica num arquivo próprio pra não sujar `categories.ts`, que é do app inteiro.
 */

import type { ProfileThemeKey } from "./themes";

type Mapa = { mae: Record<string, string>; personalizado: Record<string, string>; renda: string; investimento: string; nenhum: string };

const GIRLY: Mapa = {
  mae: { MORADIA: "🏠", ALIMENTACAO: "🍓", TRANSPORTE: "🚗", SAUDE: "💗", LAZER: "💅", EDUCACAO: "📚", IMPOSTOS: "🧾", OUTROS: "🎀" },
  personalizado: {
    wrench: "🔧", gamepad: "🎮", tag: "🏷️", sparkles: "✨", paw: "🐾", baby: "🍼", gift: "🎁", plane: "✈️", coffee: "☕",
    shirt: "👗", dumbbell: "🏋️‍♀️", music: "🎵", scissors: "💇‍♀️", pill: "💊", dog: "🐶", cat: "🐱", heart: "💖", book: "📖", laptop: "💻", phone: "📱",
  },
  renda: "💸",
  investimento: "🐷",
  nenhum: "🎀",
};

const SEM_FILTRO: Mapa = {
  mae: { MORADIA: "🏠", ALIMENTACAO: "🍕", TRANSPORTE: "🚕", SAUDE: "💊", LAZER: "🍻", EDUCACAO: "🎓", IMPOSTOS: "🦁", OUTROS: "🤷‍♀️" },
  personalizado: {
    wrench: "🔧", gamepad: "🎮", tag: "🏷️", sparkles: "✨", paw: "🐾", baby: "🍼", gift: "🎁", plane: "✈️", coffee: "☕",
    shirt: "👕", dumbbell: "🏋️", music: "🎧", scissors: "💇", pill: "💊", dog: "🐶", cat: "🐱", heart: "❤️", book: "📖", laptop: "💻", phone: "📱",
  },
  renda: "🤑",
  investimento: "📈",
  nenhum: "🤷‍♀️",
};

const POR_TEMA: Partial<Record<ProfileThemeKey, Mapa>> = { girly: GIRLY, semfiltro: SEM_FILTRO };

export type CategoriaParaEmoji =
  | { kind: "parent"; value: string }
  | { kind: "custom"; iconKey?: string | null }
  | { kind: "income" }
  | { kind: "investment" }
  | { kind: "none" };

/** O emoji desta categoria no tema, ou undefined quando o tema usa ícone de linha. */
export function emojiDaCategoria(tema: string, c: CategoriaParaEmoji): string | undefined {
  const m = POR_TEMA[tema as ProfileThemeKey];
  if (!m) return undefined;
  if (c.kind === "parent") return m.mae[c.value] ?? m.nenhum;
  if (c.kind === "custom") return (c.iconKey && m.personalizado[c.iconKey]) || m.nenhum;
  if (c.kind === "income") return m.renda;
  if (c.kind === "investment") return m.investimento;
  return m.nenhum;
}
