import { SettingsTabs } from "./SettingsTabs";
import { isPluggyConfigured } from "@/lib/pluggy/client";

/**
 * No computador a sidebar lista as seções de Configurações. No celular não existia caminho
 * nenhum: "Mais › Configurações" caía no Perfil e Preferências (moeda, tema), Categorias e
 * Notificações ficavam inalcançáveis. As pílulas aparecem só no celular.
 */
export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SettingsTabs openFinance={isPluggyConfigured()} />
      {children}
    </div>
  );
}
