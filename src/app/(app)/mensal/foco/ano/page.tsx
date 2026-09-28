import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { serverMoney } from "@/lib/money-server";
import { existeDecisao } from "@/lib/repositories/decisao.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { carregarViradaDoAno } from "./dados";
import { ViradaDoAno } from "./ViradaDoAno";

/** A virada do ano: fecha o ano que passou e pergunta como começar o novo. */
export default async function ViradaDoAnoPage() {
  const ctx = await getRequiredSession();
  const money = await serverMoney();
  const v = await carregarViradaDoAno(ctx, (x) => money(x, { round: true }));
  const feita = await existeDecisao(ctx, "virada_ano", String(v.ano));
  return (
    <div className="flex flex-col gap-5">
      <Link href="/mensal/foco" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> Foco
      </Link>
      <PageHeader title={`Fechar ${v.passado}, começar ${v.ano}`} />
      {feita ? (
        <p className="text-sm text-ink-muted">Você já começou {v.ano}. Bom ano!</p>
      ) : v.resumo.renda <= 0 && v.resumo.gastos <= 0 ? (
        <p className="text-sm text-ink-muted">Não achei lançamentos seus em {v.passado}, então não há ano pra fechar. Seu {v.ano} começa pelo Orçamento.</p>
      ) : (
        <ViradaDoAno v={v} />
      )}
    </div>
  );
}
