import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { carregarAcertoDoMes } from "@/lib/repositories/casal.repo";
import { letraDeQuemOlha } from "@/lib/repositories/nos-dois.repo";
import { outraLetra } from "@/lib/casal-login/regras";
import { ContaPorConta } from "@/components/casal-login/ContaPorConta";
import { MESES } from "../dados-da-tela";

export const metadata = { title: "Conta por conta · Nós dois" };

/** Conta por conta: o jeito de dividir cada conta da casa (aberto pelo passo a passo). */
export default async function ContaPorContaPage() {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) redirect("/dashboard");
  const hoje = nowInBrazil();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const acerto = await carregarAcertoDoMes(ctx, ano, mes);
  // Sem par, letraDeQuemOlha já dá "A" para a titular.
  const letraTitular = ctx.par ? outraLetra(ctx.par.letra) : await letraDeQuemOlha(ctx);
  return (
    <ContaPorConta
      contas={acerto.contas}
      nomes={{ A: acerto.config.nomeA, B: acerto.config.nomeB }}
      letraTitular={letraTitular}
      fracaoRenda={acerto.fracaoRenda}
      divisao={acerto.config.divisao}
      pctA={acerto.config.pctA ?? null}
      nomeDoMes={MESES[mes - 1]}
    />
  );
}
