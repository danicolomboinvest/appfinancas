import { Car, RefreshCw, ShoppingBag, Ticket, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { MARCAS } from "@/lib/marcas/catalogo";
import type { TipoDaCoisinha } from "@/lib/planning/plano-da-meta";

const ICONE: Record<TipoDaCoisinha, LucideIcon> = { assinatura: RefreshCw, delivery: UtensilsCrossed, corrida: Car, compras: ShoppingBag, lazer: Ticket };

/**
 * O logo de uma coisinha: o logo real da marca (catálogo do app, a mesma regra dos lançamentos) e,
 * sem marca, o quadrado neutro com o ícone do tipo. "Uber e 99" usa o da Uber.
 */
export function LogoDaCoisinha({ marca, tipo, size = 44 }: { marca: string | null; tipo: TipoDaCoisinha; size?: 36 | 40 | 44 }) {
  const slug = marca === "uber+99" ? "uber" : marca;
  const descricao = slug ? (MARCAS.find((m) => m.slug === slug)?.apelidos[0] ?? null) : null;
  return <LogoDoLancamento descricao={descricao} icon={ICONE[tipo]} size={size} />;
}
