import { ModuleTabs } from "@/components/shell/ModuleTabs";

const TABS = [
  { href: "/mensal", label: "Visão mensal" },
  { href: "/mensal/gastos", label: "Só gastos" },
];

/** O registro (digitar/gravar áudio) foi unificado no RegistrarDrawer, aberto pelo "+" central
 * da tab bar (mobile) ou pelo botão "Registrar" da sidebar (desktop) — ver AppShell.tsx. */
export default function MensalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTabs tabs={TABS} />
      {children}
    </>
  );
}
