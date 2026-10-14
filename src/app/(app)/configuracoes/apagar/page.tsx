import { getRequiredSession } from "@/lib/auth/session";
import { naAppDaApple } from "@/lib/apple/app-da-apple";
import { prisma } from "@/lib/db/prisma";
import { PARTES, type Parte } from "@/lib/limpar-dados/regras";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { listImportBatches } from "@/lib/repositories/import-batch.repo";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { ApagarDadosOuConta } from "./ApagarDadosOuConta";

export const metadata = { title: "Apagar dados ou conta · SPI Finance" };

/**
 * Configurações › Apagar dados ou conta: limpar e recomeçar (a conta fica) ou apagar a conta.
 * Ver ApagarDadosOuConta.tsx.
 */
export default async function ApagarDadosOuContaPage() {
  const ctx = await getRequiredSession();
  const ehPar = Boolean(ctx.par && ctx.donoId && ctx.donoId !== ctx.userId);
  const [naApple, assinaturasApple, meus, comReset, [ultimoLote]] = await Promise.all([
    naAppDaApple(),
    prisma.assinaturaApple.count({ where: { userId: ctx.userId, revogadaEm: null } }),
    listProfiles(ctx.userId),
    ehPar ? Promise.resolve(false) : temMoneyReset(ctx.userId),
    // A saída menor do "Importei errado" e do "Apareceu repetido": a última importação deste perfil.
    listImportBatches(ctx, 1),
  ]);
  // Aviso de que apagar a conta não cancela a assinatura: no app iOS, ou para quem assinou por lá.
  const avisoDaApple = naApple || assinaturasApple > 0;

  // Os perfis que ela pode limpar: os dela e, para o par, o Nós dois aberto agora (só o lado dele sai).
  const perfis = meus.map((p) => ({ id: p.id, nome: p.name }));
  if (!perfis.some((p) => p.id === ctx.profileId)) {
    const aberto = await prisma.financialProfile.findUnique({ where: { id: ctx.profileId }, select: { name: true } });
    perfis.unshift({ id: ctx.profileId, nome: aberto?.name ?? "Nós dois" });
  }

  // O que aparece para escolher: o Money Reset só para quem tem; o par não tem a área de investimentos.
  const partesVisiveis: Parte[] = PARTES.filter((p) => (p !== "moneyReset" || comReset) && (p !== "carteira" || !ehPar));

  const ultimaImportacao = ultimoLote
    ? { id: ultimoLote.id, fatura: ultimoLote.docType === "fatura", arquivo: ultimoLote.fileName, em: ultimoLote.createdAt.toISOString(), lancamentos: ultimoLote.entryCount + ultimoLote.parcelasFuturas }
    : null;

  return <ApagarDadosOuConta avisoDaApple={avisoDaApple} perfis={perfis} perfilAtual={ctx.profileId} partesVisiveis={partesVisiveis} ultimaImportacao={ultimaImportacao} />;
}
