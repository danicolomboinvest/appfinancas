import { PillTabs } from "@/components/shell/PillTabs";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { ehEmpresa } from "@/lib/profiles/empresa";

// Ordem pedida: Metas → Reserva → Aposentadoria. Rótulos curtos pra caberem todos sem rolar.
// (Planejar Viagem mora fora daqui, em /viagem — entra pelo menu "Mais"/sidebar.)
// Os nomes vêm da voz do tema: no Girly são "Sonhos · Reserva · Liberdade".
const HREFS = ["/planejamento/metas", "/planejamento/reserva-emergencia", "/planejamento/acumulo"] as const;

export default async function PlanejamentoLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  // Uma empresa não se aposenta: no perfil Empresa a terceira aba (Aposentadoria) some, e
  // ficam só Metas e Caixa. A rota continua existindo; só não tem porta de entrada aqui.
  const hrefs = ehEmpresa(ctx.profileKind) ? HREFS.slice(0, 2) : HREFS;
  const tabs = hrefs.map((href, i) => ({ href, label: voz.titulos.planTabs[i] }));
  return (
    <>
      <PillTabs tabs={tabs} fit />
      {children}
    </>
  );
}
