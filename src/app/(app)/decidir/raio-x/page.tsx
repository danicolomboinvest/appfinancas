import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { vozDoTema } from "@/lib/profiles/voice";
import { chaveDoTema } from "@/lib/profiles/themes";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { Card } from "@/components/ui/Card";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { carregarRaioX } from "@/app/(app)/mensal/foco/dados";
import { PERGUNTAS_DO_DECIDIR, tituloDaEsfera } from "@/lib/decisoes/esferas";
import type { EscolhaDoRaioX } from "@/lib/decisoes/raio-x";
import { lembretesDoRaioX } from "@/lib/assinaturas/lembretes";
import { RaioX } from "./RaioX";

export default async function RaioXPage() {
  const ctx = await getRequiredSession();
  // Decidir é da pessoa (regra dos 90% da renda, pequenos gastos): a empresa não tem.
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const now = nowInBrazil();
  const { itens, decididos, canceladas, respostas } = await carregarRaioX(ctx, now.getFullYear(), now.getMonth() + 1);
  // O lembrete de cancelar no dia da cobrança: só das que estão para cancelar, e só de quem pediu.
  const paraCancelar = itens.filter((i) => decididos.get(i.chave)?.tipo === "raiox_cancelar" && !canceladas.has(i.chave));
  const lembretes = paraCancelar.length > 0 ? await lembretesDoRaioX(ctx, paraCancelar, respostas) : {};
  const jaDecidido = Object.fromEntries([...decididos.entries()].map(([k, v]) => [k, v.tipo])) as Record<string, EscolhaDoRaioX>;
  const pergunta = PERGUNTAS_DO_DECIDIR.find((p) => p.chave === "raiox")!;

  return (
    <div className="flex flex-col gap-4">
      {/* O topo dos fluxos do Decidir: voltar à esquerda, a pergunta pequena à direita. */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/decidir" className="flex min-h-11 w-fit shrink-0 items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={18} aria-hidden /> {t.decTitulo}
        </Link>
      </div>
      {/* A pergunta no topo (protótipo, #decidir-raiox). */}
      <span className="-mt-1 text-[13px] font-medium text-ink-muted" data-pergunta-raiox>
        {tituloDaEsfera(pergunta, chaveDoTema(ctx.profileTheme))}
      </span>
      {itens.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-ink-muted">{t.raioxVazio}</p>
        </Card>
      ) : (
        <RaioX itens={itens} decididos={jaDecidido} canceladas={[...canceladas]} lembretes={lembretes} />
      )}
      <ReportarErro tela="Raio-X dos pequenos gastos" regra="mesmo estabelecimento em 3+ meses; fora moradia, saúde, educação e impostos" />
    </div>
  );
}
