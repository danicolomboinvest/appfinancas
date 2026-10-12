import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { carregarAcertoDoMes } from "@/lib/repositories/casal.repo";
import { lancamentosDoMesNoCasal, letraDeQuemOlha } from "@/lib/repositories/nos-dois.repo";
import { outraLetra } from "@/lib/casal-login/regras";
import { LancamentosDoNossoMes } from "@/components/casal-login/LancamentosDoNossoMes";

export const metadata = { title: "Lançamentos · Nós dois" };

/** "‹ Nosso mês · Lançamentos" (protótipo, #casal-lancamentos): busca, filtros, total e a lista por dia. */
export default async function LancamentosDoCasalPage(props: { searchParams: Promise<{ quem?: string; busca?: string }> }) {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) redirect("/mensal/foco");
  const busca = await props.searchParams;
  const hoje = nowInBrazil();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const [acerto, itens] = await Promise.all([carregarAcertoDoMes(ctx, ano, mes), lancamentosDoMesNoCasal(ctx, ano, mes)]);
  const letraTitular = ctx.par ? outraLetra(ctx.par.letra) : await letraDeQuemOlha(ctx);
  const minhaLetra = ctx.par ? ctx.par.letra : letraTitular;
  const filtroInicial = busca.quem === "A" || busca.quem === "B" ? busca.quem : "tudo";
  return (
    <LancamentosDoNossoMes
      itens={itens}
      nomes={{ A: acerto.config.nomeA, B: acerto.config.nomeB }}
      letraTitular={letraTitular}
      minhaLetra={minhaLetra}
      mes={mes}
      saldoA={acerto.saldoA}
      acertado={acerto.acertado}
      filtroInicial={filtroInicial}
      focarBusca={busca.busca === "1"}
    />
  );
}
