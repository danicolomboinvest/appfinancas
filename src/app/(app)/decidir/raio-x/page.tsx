import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { carregarRaioX } from "@/app/(app)/mensal/foco/dados";
import { RaioX } from "./RaioX";

export default async function RaioXPage() {
  const ctx = await getRequiredSession();
  // Decidir é da pessoa (regra dos 90% da renda, pequenos gastos): a empresa não vê no menu.
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const now = nowInBrazil();
  const { itens, decididos } = await carregarRaioX(ctx, now.getFullYear(), now.getMonth() + 1);
  const jaDecidido = Object.fromEntries([...decididos.entries()].map(([k, v]) => [k, v.tipo])) as Record<string, "raiox_cancelar" | "raiox_metade" | "raiox_manter">;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/decidir" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> Decidir
      </Link>
      <PageHeader title={t.raioxTitulo} />
      {itens.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-ink-muted">{t.raioxVazio}</p>
        </Card>
      ) : (
        <RaioX itens={itens} decididos={jaDecidido} />
      )}
      <ReportarErro tela="Raio-X dos pequenos gastos" regra="mesmo estabelecimento em 3+ meses; fora moradia, saúde, educação e impostos" />
    </div>
  );
}
