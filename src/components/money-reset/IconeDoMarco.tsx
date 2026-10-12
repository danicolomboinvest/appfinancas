import {
  ChartColumn,
  ChartPie,
  CircleOff,
  Coffee,
  CreditCard,
  Droplets,
  Flag,
  Heart,
  Hourglass,
  LifeBuoy,
  Mic,
  PiggyBank,
  Plane,
  Receipt,
  Scale,
  ScanSearch,
  ScrollText,
  ShieldCheck,
  CalendarDays,
  Target,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { IconeDoMarco as Chave } from "@/lib/money-reset/missoes";

/** Um desenho por marco (sem emoji): é o que aparece no mapa, no cartão "agora" e na missão. */
export const ICONES_DOS_MARCOS: Record<Chave, LucideIcon> = {
  extrato: ScrollText,
  cartao: CreditCard,
  raiox: ScanSearch,
  fixas: Receipt,
  escapa: Droplets,
  voz: Mic,
  motivo: Heart,
  orcamento: ChartPie,
  guardar: PiggyBank,
  reserva: LifeBuoy,
  sonho: Plane,
  divisao: Waypoints,
  dividas: Scale,
  regra: ShieldCheck,
  semana: CalendarDays,
  espera: Hourglass,
  semgasto: CircleOff,
  ritual: Coffee,
  alvo: Target,
  comparar: ChartColumn,
  fim: Flag,
};

export function IconeDoMarco({ icone, size = 18, strokeWidth = 1.9, className }: { icone: Chave; size?: number; strokeWidth?: number; className?: string }) {
  const Icone = ICONES_DOS_MARCOS[icone];
  return <Icone size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
