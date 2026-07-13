import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { ExportCsvButton, ExportAssetsCsvButton } from "./ExportCsvButton";
import { DeleteAccountSection } from "./DeleteAccountSection";

export default function DadosPage() {
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: "Configurações", href: "/configuracoes/perfil" }, { label: "Dados" }]} />

      <PageHeader title="Dados" subtitle="Exporte seus dados ou exclua a conta." />

      <Card className="p-5">
        <p className="mb-3 text-sm text-ink-muted">
          Gera um arquivo CSV com todos os seus lançamentos mensais (renda, gastos e aportes), incluindo categoria-mãe
          e subcategoria.
        </p>
        <ExportCsvButton />
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-sm text-ink-muted">
          Gera um arquivo CSV com todos os ativos da sua carteira (nome, ticker, classe, quantidade, valor investido e
          valor atual).
        </p>
        <ExportAssetsCsvButton />
      </Card>

      <DeleteAccountSection />
    </div>
  );
}
