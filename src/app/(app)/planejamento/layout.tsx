import { ModuleTabs } from "@/components/shell/ModuleTabs";

const TABS = [
  { href: "/planejamento/acumulo", label: "Independência Financeira" },
  { href: "/planejamento/reserva-emergencia", label: "Reserva de Emergência" },
  { href: "/planejamento/metas", label: "Metas" },
];

export default function PlanejamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTabs tabs={TABS} />
      {children}
    </>
  );
}
