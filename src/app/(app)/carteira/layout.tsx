import { ModuleTabs } from "@/components/shell/ModuleTabs";

const TABS = [
  { href: "/carteira", label: "Meus Ativos" },
  { href: "/carteira/por-objetivo", label: "Por Objetivo" },
  { href: "/carteira/estrategia", label: "Estratégia" },
];

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTabs tabs={TABS} />
      {children}
    </>
  );
}
