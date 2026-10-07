import { SettingsTabs } from "./SettingsTabs";

/** As telas de Configurações: a principal é a lista; as de dentro ganham a volta para ela. */
export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SettingsTabs />
      {children}
    </div>
  );
}
