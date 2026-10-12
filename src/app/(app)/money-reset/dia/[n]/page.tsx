import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { lerResetConferido } from "@/lib/repositories/money-reset.repo";
import { MARCOS, marco, naVoz, vocabularioDaVoz } from "@/lib/money-reset/missoes";
import { feitoHoje } from "@/lib/money-reset/progresso";
import { vozDoTema } from "@/lib/profiles/voice";
import { carregarDadosDoMarco } from "../../dados";
import { Missao } from "./Missao";

/**
 * Uma missão do mapa (o endereço continua /money-reset/dia/N, para os atalhos antigos não
 * quebrarem; N agora é o marco). A missão acontece ali mesmo, com os números e as marcas dela;
 * feita, a tela mostra o que mudou no app e abre a próxima.
 */
export default async function MissaoPage(props: PageProps<"/money-reset/dia/[n]">) {
  const { n: param } = await props.params;
  const n = Number(param);
  const m = marco(n);
  if (!m) notFound();
  const ctx = await getRequiredSession();
  if (!(await temMoneyReset(ctx.userId))) notFound();
  const reset = await lerResetConferido(ctx);
  const v = vocabularioDaVoz(vozDoTema(ctx.profileTheme, ctx.profileKind));

  const admin = ctx.role === "ADMIN";
  const status = reset.estado.status[n];
  const fixasTotal = (reset.respostas.fixas?.dados as { total?: number } | undefined)?.total;
  const dados = status !== "fechado" || admin ? await carregarDadosDoMarco(ctx, n, { fixasTotal }) : { n };
  const respostas = Object.fromEntries(Object.entries(reset.respostas).map(([k, r]) => [k, { texto: r?.texto ?? "", dados: r?.dados ?? null }]));
  const atual = reset.estado.atual;
  // A semana do próximo marco tem história ainda não vista: "Continuar" passa por ela.
  const proxima = atual !== null ? marco(atual)! : null;
  const historiaAntes = proxima && proxima.semana > 1 && !reset.respostas[`historia${proxima.semana}` as const] ? proxima.semana : null;

  return (
    <Missao
      n={n}
      status={status}
      admin={admin}
      dados={dados}
      respostas={respostas}
      achei={reset.achei}
      atual={atual}
      historiaAntes={historiaAntes}
      feitaHoje={feitoHoje(reset.feitos.get(n), new Date())}
      mapa={{ status: reset.estado.status, semana: reset.estado.semana, titulos: MARCOS.map((x) => naVoz(x.t, v)) }}
      hoje={reset.hoje.toISOString().slice(0, 10)}
      amanha={new Date(reset.hoje.getTime() + 86_400_000).toISOString().slice(0, 10)}
    />
  );
}
