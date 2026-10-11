import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Banknote, BookOpen, Calendar, CalendarCheck, Circle, CreditCard, Flag, Hand, Handshake, Heart, Hourglass, House, Laptop, Moon,
  Pencil, PiggyBank, Plane, Scissors, Shirt, ShoppingBag, Smartphone, Sparkles, Tag, Target, ThumbsUp, TriangleAlert, Trophy, WandSparkles, Wrench, Zap,
} from "lucide-react";

/**
 * Sem emoji na interface (versão nova, 11/10/2026): onde o código ainda guarda um emoji como
 * "ícone" de uma opção (as categorias do Posso comprar?, o fim da compra, as conquistas), a tela
 * desenha o ícone de traço fino equivalente, dentro de um círculo, todos do mesmo jeito.
 */
const MAPA: Record<string, LucideIcon> = {
  "✏️": Pencil, "💸": Banknote, "💳": CreditCard, "🤷‍♀️": WandSparkles, "🧰": Wrench, "😍": Heart, "⚡": Zap,
  "💰": PiggyBank, "💤": Moon, "🙅": Hand, "✨": Sparkles, "🤝": Handshake, "🙌": ThumbsUp,
  "📱": Smartphone, "✈️": Plane, "👗": Shirt, "💻": Laptop, "🏠": House, "📚": BookOpen, "🛍️": ShoppingBag,
  "🏷️": Tag, "✂️": Scissors, "📅": Calendar, "⏳": Hourglass, "🎯": Target, "🏆": Trophy, "🗓️": CalendarCheck,
  "🏁": Flag, "⚠️": TriangleAlert,
};

export function iconeDoEmoji(emoji: string): LucideIcon {
  return MAPA[emoji] ?? MAPA[emoji.replace(/️/g, "")] ?? Circle;
}

export function IconeDeEmoji({ emoji, size = 44, className = "" }: { emoji: string; size?: number; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink shadow-[inset_0_0_0_1px_var(--color-border)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {createElement(iconeDoEmoji(emoji), { size: Math.round(size * 0.46), strokeWidth: 1.5 })}
    </span>
  );
}
