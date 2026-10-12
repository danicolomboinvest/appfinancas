import { PillTabs } from "@/components/shell/PillTabs";
import { ADMIN_NAV_SECTION } from "@/components/shell/nav-sections";

/**
 * As telas do Admin em abas dentro da área (11/10/2026): o ☰ não abre subitens em área nenhuma,
 * então a lista que ficava no menu virou as abas daqui. A permissão continua em cada página.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tabs = (ADMIN_NAV_SECTION.children ?? []).map((c) => ({ href: c.href, label: c.label }));
  return (
    <>
      <PillTabs tabs={tabs} />
      {children}
    </>
  );
}
