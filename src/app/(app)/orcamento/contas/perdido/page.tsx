import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getUserCurrency } from "@/lib/money-server";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { MOEDA_DO_PRECO_DO_SPI, PRECO_DO_SPI_POR_ANO } from "@/lib/dinheiro-perdido/config";
import { carregarDinheiroPerdido } from "./dados";
import { TelaDoDinheiroPerdido } from "./TelaDoDinheiroPerdido";

/**
 * Dinheiro perdido (versão B aprovada em 12/10/2026, com o ajuste da Dani): em cima, "Até agora",
 * o que já voltou para o bolso contra o preço do SPI; embaixo, "Achei para conferir", as cartas,
 * uma por vez. A lista inteira (o A) fica atrás do "Ver tudo".
 */
export default async function DinheiroPerdidoPage() {
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/orcamento/contas");
  const [dados, moeda] = await Promise.all([carregarDinheiroPerdido(ctx), getUserCurrency()]);
  const { vivos, ...tela } = dados;
  void vivos;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/orcamento/contas" aria-label="Voltar para Recorrentes" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-ink-muted active:scale-95">
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
        </Link>
        <h1 className="titulo-tema min-w-0 text-[1.6rem] font-medium leading-tight text-ink">Dinheiro perdido</h1>
      </div>
      <TelaDoDinheiroPerdido {...tela} precoDoSpi={moeda === MOEDA_DO_PRECO_DO_SPI ? PRECO_DO_SPI_POR_ANO : null} />
    </div>
  );
}
