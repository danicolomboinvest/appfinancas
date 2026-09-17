import { PillTabs } from "@/components/shell/PillTabs";

const TABS = [
  { href: "/configuracoes/perfil", label: "Perfil" },
  { href: "/configuracoes/preferencias", label: "Preferências" },
  { href: "/configuracoes/categorias", label: "Categorias" },
  { href: "/configuracoes/notificacoes", label: "Notificações" },
  { href: "/configuracoes/conexoes", label: "Conexões" },
  { href: "/configuracoes/dados", label: "Dados" },
  { href: "/configuracoes/taxas", label: "Taxas" },
];

/**
 * No computador a sidebar lista as seções de Configurações. No celular não existia caminho
 * nenhum: "Mais › Configurações" caía no Perfil e Preferências (moeda, tema), Categorias e
 * Notificações ficavam inalcançáveis. As pílulas roláveis aparecem só no celular.
 */
export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="md:hidden">
        <PillTabs tabs={TABS} />
      </div>
      {children}
    </div>
  );
}
