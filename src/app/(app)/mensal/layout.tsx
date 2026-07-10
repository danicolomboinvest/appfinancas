import { ModuleTabs } from "@/components/shell/ModuleTabs";
import { QuickExpenseFab } from "./QuickExpenseFab";
import { VoiceEntryFab } from "./VoiceEntryFab";

const TABS = [
  { href: "/mensal", label: "Visão mensal" },
  { href: "/mensal/gastos", label: "Só gastos" },
];

export default function MensalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTabs tabs={TABS} />
      {children}
      <VoiceEntryFab />
      <QuickExpenseFab />
    </>
  );
}
