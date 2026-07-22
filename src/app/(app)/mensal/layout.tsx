import { PillTabs } from "@/components/shell/PillTabs";
import { FLOW_TABS } from "@/components/shell/flow-tabs";

/** O registro (digitar/gravar áudio) foi unificado no RegistrarDrawer, aberto pelo "+" central
 * da tab bar (mobile) ou pelo botão "Registrar" da sidebar (desktop), ver AppShell.tsx. */
export default function MensalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PillTabs tabs={FLOW_TABS} fit />
      {children}
    </>
  );
}
