import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ExportCsvButton, ExportAssetsCsvButton } from "./ExportCsvButton";
import { DeleteAccountSection } from "./DeleteAccountSection";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { naAppDaApple } from "@/lib/apple/app-da-apple";
import { prisma } from "@/lib/db/prisma";

export default async function DadosPage() {
  // A sessão entra só pra saber em que voz a tela fala; as ações têm a delas.
  const ctx = await getRequiredSession();
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);
  // Aviso de que excluir a conta não cancela a assinatura: no app iOS, ou pra quem assinou por lá.
  const avisoDaApple = (await naAppDaApple()) || (await prisma.assinaturaApple.count({ where: { userId: ctx.userId, revogadaEm: null } })) > 0;

  return (
    <div className="flex flex-col gap-6">

      <PageHeader title={t.cfgDadosTitulo} />

      <Card className="p-5">
        <p className="mb-3 text-sm text-ink-muted">{t.cfgExportLancamentosDica}</p>
        <ExportCsvButton />
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm text-ink-muted">{t.cfgExportCarteiraDica}</p>
        <ExportAssetsCsvButton />
      </Card>

      <DeleteAccountSection avisoDaApple={avisoDaApple} />
    </div>
  );
}
