import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { carregarAcertoDoMes } from "@/lib/repositories/casal.repo";
import { estadoDoFechamentoDoMes, letraDeQuemOlha } from "@/lib/repositories/nos-dois.repo";
import { mesParaFechar } from "@/lib/casal-login/fechamento";
import { outraLetra } from "@/lib/casal-login/regras";
import { prisma } from "@/lib/db/prisma";
import { FecharOMes } from "@/components/casal-login/FecharOMes";

export const metadata = { title: "Fechar o mês · Nós dois" };

/** Fechar o mês a dois: o mês anterior, com o "Confere" de cada um (protótipo aprovado, tela f). */
export default async function FecharOMesPage() {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) redirect("/mensal/foco");
  const hoje = nowInBrazil();
  const { ano, mes } = mesParaFechar({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 });
  const [acerto, fechamento, minha] = await Promise.all([carregarAcertoDoMes(ctx, ano, mes), estadoDoFechamentoDoMes(ctx, ano, mes), letraDeQuemOlha(ctx)]);
  // A letra da titular: a de quem não é o par.
  const par = ctx.par ? null : await prisma.membroCasal.findFirst({ where: { profileId: ctx.profileId, saiuEm: null }, select: { letra: true } });
  if (!ctx.par && !par) redirect("/divisao");
  const titular = ctx.par ? outraLetra(ctx.par.letra) : minha;
  const diferenca = Math.round(Math.abs(acerto.saldoA));
  return (
    <FecharOMes
      ano={ano}
      mes={mes}
      fechamento={fechamento}
      pessoas={{ minha, titular, nomes: { A: acerto.config.nomeA, B: acerto.config.nomeB } }}
      acerto={{ diferenca, devedor: acerto.saldoA > 0 ? "B" : "A", totalDaCasa: acerto.totalDaCasa, pagou: acerto.pagou, acertado: acerto.acertado }}
    />
  );
}
