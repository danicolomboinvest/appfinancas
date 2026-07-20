import { PillTabs } from "@/components/shell/PillTabs";

// Ordem pedida: Metas → Reserva → Aposentadoria. Rótulos curtos pra caberem todos sem rolar.
const TABS = [
  { href: "/planejamento/metas", label: "Metas" },
  { href: "/planejamento/reserva-emergencia", label: "Reserva" },
  { href: "/planejamento/acumulo", label: "Aposentadoria" },
];

export default function PlanejamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PillTabs tabs={TABS} fit />
      {children}
    </>
  );
}
