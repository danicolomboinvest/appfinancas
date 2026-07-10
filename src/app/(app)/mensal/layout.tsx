import { ModuleTabs } from "@/components/shell/ModuleTabs";

const TABS = [
  { href: "/mensal", label: "Visão mensal" },
  { href: "/mensal/gastos", label: "Só gastos" },
];

/** QuickExpenseFab e VoiceEntryFab agora são globais (montados em AppShell.tsx) —
 * "Lançar rápido" funciona em qualquer tela do app, não só dentro do Fluxo Financeiro. */
export default function MensalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTabs tabs={TABS} />
      {children}
    </>
  );
}
