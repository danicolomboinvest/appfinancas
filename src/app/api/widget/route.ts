import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { contextoDaConta } from "@/lib/auth/session";
import { listGoalsWithProgress } from "@/lib/repositories/goal.repo";
import { preferenciaDeModo } from "@/lib/profiles/themes";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { carregarFoco } from "@/app/(app)/mensal/foco/dados";
import { chaveDoCabecalho, donoDaChave } from "@/lib/widget/token";
import { numerosDoWidget } from "@/lib/widget/numeros";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "private, no-store" };

/**
 * Os números do widget do iPhone (11/10/2026): livre até domingo, por dia, fim do mês e as
 * metas, do perfil que está aberto no app. Só com a chave do widget (Authorization: Bearer
 * spiw_...), nunca com a sessão: a extensão do widget não tem cookie, e a chave só abre isto.
 *
 * Os números saem de carregarFoco, a mesma função do Resumo: o widget nunca diz outra coisa.
 */
export async function GET(request: Request) {
  const chave = chaveDoCabecalho(request.headers.get("authorization"));
  if (!chave) return NextResponse.json({ erro: "sem-chave" }, { status: 401, headers: SEM_CACHE });
  const userId = await donoDaChave(chave);
  if (!userId) return NextResponse.json({ erro: "chave-invalida" }, { status: 401, headers: SEM_CACHE });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, currency: true, theme: true } });
  if (!user) return NextResponse.json({ erro: "chave-invalida" }, { status: 401, headers: SEM_CACHE });
  // O mesmo contexto do app (o casal e o par inclusos): o widget nunca diz outra coisa.
  const ctx = await contextoDaConta(user);

  try {
    const [d, metas] = await Promise.all([carregarFoco(ctx), listGoalsWithProgress(ctx)]);
    const pref = preferenciaDeModo(user.theme);
    const corpo = numerosDoWidget({
      livre: d.foco.livre,
      livreDoMes: d.livreDoMes,
      agora: nowInBrazil(),
      instante: new Date(),
      moeda: user.currency,
      tema: ctx.profileTheme,
      modo: pref === "auto" ? "auto" : pref === "dark" ? "escuro" : "claro",
      metas: metas.map((g) => ({ id: g.id, name: g.name, computedCurrentAmount: g.computedCurrentAmount, targetAmount: Number(g.targetAmount) })),
    });
    return NextResponse.json(corpo, { headers: SEM_CACHE });
  } catch (erro) {
    console.error("[widget] não deu para montar os números", erro);
    return NextResponse.json({ erro: "falhou" }, { status: 500, headers: SEM_CACHE });
  }
}
