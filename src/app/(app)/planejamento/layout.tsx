import { ModuleTabs } from "@/components/shell/ModuleTabs";

const TABS = [
  { href: "/planejamento/acumulo", label: "Acúmulo" },
  { href: "/planejamento/usufruto", label: "Liberdade Financeira" },
  { href: "/planejamento/projecao", label: "Projeção Patrimonial" },
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
