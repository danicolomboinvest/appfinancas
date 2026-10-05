import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { conferirMissaoDoDia, lerReset } from "@/lib/repositories/money-reset.repo";
import { missao } from "@/lib/money-reset/missoes";
import { carregarDadosDaMissao } from "../../dados";
import { Missao } from "./Missao";

/** Uma missão do Money Reset: a abertura (por quê, o que ter em mãos, o caminho) e a tela do dia. */
export default async function MissaoPage(props: PageProps<"/money-reset/dia/[n]">) {
  const { n } = await props.params;
  const dia = Number(n);
  const m = missao(dia);
  if (!m) notFound();
  const ctx = await getRequiredSession();
  if (!(await temMoneyReset(ctx.userId))) notFound();
  let reset = await lerReset(ctx);
  if (await conferirMissaoDoDia(ctx, reset)) reset = await lerReset(ctx);

  const status = reset.estado.status[dia];
  const admin = ctx.role === "ADMIN";
  const fixasTotal = (reset.respostas.fixas?.dados as { total?: number } | undefined)?.total;
  const dados = status === "feita" || status === "hoje" || admin ? await carregarDadosDaMissao(ctx, dia, { fixasTotal }) : { dia };
  const respostas = Object.fromEntries(Object.entries(reset.respostas).map(([k, v]) => [k, { texto: v?.texto ?? "", dados: v?.dados ?? null }]));

  return (
    <Missao
      dia={dia}
      status={admin && status !== "feita" ? "hoje" : status}
      proxima={missao(dia + 1)?.t ?? null}
      dados={dados}
      respostas={respostas}
      amanha={new Date(reset.hoje.getTime() + 86_400_000).toISOString().slice(0, 10)}
      hoje={reset.hoje.toISOString().slice(0, 10)}
    />
  );
}
