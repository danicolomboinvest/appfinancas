import { ModuleTabs } from "@/components/shell/ModuleTabs";

const TABS = [
  { href: "/orcamento", label: "Planejar por categoria" },
  { href: "/orcamento/comparativo", label: "Planejado x Realizado" },
];

export default function OrcamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTabs tabs={TABS} />
      {children}
    </>
  );
}
