import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth/auth.config";
import { getRequiredSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ehCasal } from "@/lib/profiles/casal";
import { PARENT_CATEGORY_LABEL } from "@/lib/categories";
import { TIPO_DO_LANCAMENTO, dataCsv, dinheiroCsv, montarCsv } from "@/lib/export/csv-brasil";
import { contentDispositionAttachment } from "@/lib/http/content-disposition";
import { lancamentosQuePodeMexer, lancamentosVisiveis } from "@/lib/casal-login/privacidade";
import { podeBaixarCopia } from "@/lib/casal-login/acesso";
import { lerConfigCasal } from "@/lib/casal/acerto";
import { ultimoVinculoComoPar } from "@/lib/repositories/casal-login.repo";
import { destinoDe } from "@/lib/repositories/nos-dois.repo";

/**
 * A planilha do Nós dois (proposta aprovada: "Lucas baixa o que lançou").
 * - Titular: tudo do casal que ela vê (o só meu do par nunca entra).
 * - Par: só o que ELE lançou, inclusive o só meu dele. Vale enquanto ele está no Nós dois, com o
 *   Casal pausado, e por 90 dias depois de sair.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Entre para baixar.", { status: 401 });
  const ctx = await getRequiredSession();

  let where: Prisma.MonthlyEntryWhereInput | null = null;
  let casal: unknown = null;
  if (ctx.par) {
    where = lancamentosQuePodeMexer(ctx);
  } else if (ehCasal(ctx.profileKind)) {
    where = lancamentosVisiveis(ctx);
  } else {
    // Saiu (ou está nos perfis próprios): o último Nós dois em que foi par, nos 90 dias.
    const v = await ultimoVinculoComoPar(ctx.userId);
    if (v && podeBaixarCopia(v.saiuEm, new Date())) {
      where = { profileId: v.profileId, OR: [{ userId: v.profile.userId, autorUserId: ctx.userId }, { userId: ctx.userId }] };
      casal = v.profile.casal;
    }
  }
  if (!where) return new NextResponse("Nada para baixar.", { status: 404 });

  if (!casal) {
    const perfil = await prisma.financialProfile.findUnique({ where: { id: ctx.profileId }, select: { casal: true } });
    casal = perfil?.casal ?? null;
  }
  const nomes = lerConfigCasal(casal);
  const linhas = await prisma.monthlyEntry.findMany({
    where,
    select: { year: true, month: true, entryDate: true, category: true, parentCategory: true, description: true, subcategory: true, amount: true, pessoa: true, doCasal: true, soMeu: true },
    orderBy: [{ year: "asc" }, { month: "asc" }, { entryDate: "asc" }],
  });
  const destino = { nosso: "Nosso", "da-pessoa": "De cada um", "so-meu": "Só meu" } as const;
  const csv = montarCsv(
    ["Ano", "Mês", "Data", "Tipo", "Categoria", "Descrição", "Valor", "Quem", "Destino"],
    linhas.map((l) => [
      String(l.year),
      String(l.month),
      dataCsv(l.entryDate),
      TIPO_DO_LANCAMENTO[l.category] ?? l.category,
      l.parentCategory ? PARENT_CATEGORY_LABEL[l.parentCategory] : "",
      l.description || l.subcategory || "",
      dinheiroCsv(l.amount),
      l.pessoa === "A" ? nomes.nomeA : l.pessoa === "B" ? nomes.nomeB : "",
      l.category === "EXPENSE" ? destino[destinoDe(l)] : "",
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDispositionAttachment(ctx.par ? "o-que-eu-lancei-nos-dois.csv" : "nos-dois.csv"),
      "Cache-Control": "no-store",
    },
  });
}
