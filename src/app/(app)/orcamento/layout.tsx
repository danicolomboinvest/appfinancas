import { PillTabs } from "@/components/shell/PillTabs";
import { FLOW_TABS } from "@/components/shell/flow-tabs";

/** O Orçamento é uma sub-aba do Fluxo (item 4), mostra as mesmas abas do /mensal pra a
 * navegação ser contínua (Visão mensal / Só gastos / Orçamento). */
export default function OrcamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PillTabs tabs={FLOW_TABS} fit />
      {children}
    </>
  );
}
