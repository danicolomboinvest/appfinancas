import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { ExportCsvButton, ExportAssetsCsvButton } from "./ExportCsvButton";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";

export default async function DadosPage() {
  // A sessão entra só pra saber em que voz a tela fala; as ações têm a delas.
  const ctx = await getRequiredSession();
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: t.cfgBreadcrumb, href: "/configuracoes/perfil" }, { label: t.cfgAbaDados }]} />

      <PageHeader title={t.cfgDadosTitulo} subtitle={t.cfgDadosSub} />

      <Card className="p-5">
        <p className="mb-3 text-sm text-ink-muted">{t.cfgExportLancamentosDica}</p>
        <ExportCsvButton />
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm text-ink-muted">{t.cfgExportCarteiraDica}</p>
        <ExportAssetsCsvButton />
      </Card>

      <DeleteAccountSection />
    </div>
  );
}
