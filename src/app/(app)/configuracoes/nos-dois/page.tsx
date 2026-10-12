import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { prisma } from "@/lib/db/prisma";
import { normalizeEmail } from "@/lib/repositories/allowedEmail.repo";
import { nosDoisDaTitular } from "@/lib/repositories/casal-login.repo";
import { outraLetra } from "@/lib/casal-login/regras";
import { ConfigDaTitular, ConfigDoPar } from "@/components/casal-login/ConfigNosDois";

export const metadata = { title: "Nós dois · Configurações" };

/** Preço do Casal mostrado à titular (o par nunca vê preço do Casal). Igual ao do branch de cobrança. */
const PRECO_DO_CASAL = 27;

/** Configurações › Nós dois: a da titular (par, plano, remover) ou a do par (quem paga, sair). */
export default async function ConfigNosDoisPage() {
  const ctx = await getRequiredSession();
  if (ctx.par) {
    const m = await prisma.membroCasal.findUnique({ where: { id: ctx.par.membroId }, select: { entrouEm: true } });
    return <ConfigDoPar nomeTitular={ctx.par.nomeTitular} entrouEmIso={(m?.entrouEm ?? new Date()).toISOString()} />;
  }
  if (!ehCasal(ctx.profileKind)) redirect("/configuracoes/perfis");

  const [nosDois, conta] = await Promise.all([
    nosDoisDaTitular(ctx),
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } }),
  ]);
  // "Renova em": hoje o Casal vale junto com o acesso dela ao app. Sem prazo gravado, a linha não aparece.
  const acesso = conta ? await prisma.allowedEmail.findUnique({ where: { email: normalizeEmail(conta.email) }, select: { expiresAt: true } }) : null;
  const renovaEm = acesso?.expiresAt ? acesso.expiresAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }) : null;
  const letraTitular = nosDois.par ? outraLetra(nosDois.par.letra) : "A";
  return (
    <ConfigDaTitular
      nomeTitular={letraTitular === "A" ? nosDois.config.nomeA : nosDois.config.nomeB}
      par={nosDois.par ? { nome: nosDois.par.nome, entrouEmIso: nosDois.par.entrouEm.toISOString() } : null}
      mostrarRenda={nosDois.config.mostrarRenda === true}
      precoDoCasal={PRECO_DO_CASAL}
      renovaEm={renovaEm}
    />
  );
}
