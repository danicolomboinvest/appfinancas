import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, CalendarClock, ChevronLeft, PiggyBank } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { planoDaMeta } from "@/lib/planning/plano-da-meta";
import { AVISO_EM, textoDoPrazoGravado, type PlanoGravado } from "@/lib/planning/plano-gravado";
import { passosDaRegua, textoDoPrazo } from "@/lib/planning/plano-da-meta-regua";
import { entradaDoPlano, lerPlano, metaDoPlano, planoDisponivel, previaDoTirar } from "@/lib/repositories/plano-da-meta.repo";
import { TelaDoPlano } from "./TelaDoPlano";
import { TirarPlano } from "./TirarPlano";
import { LogoDaCoisinha } from "./LogoDaCoisinha";
import "../../metas.css";

const chaveDoPrazo = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : null);

/**
 * O "Como vou juntar?" de uma meta (16/10/2026). Sem plano (ou com "Mudar o plano"): a tela para
 * montar. Com plano: o Combinado, com "Mudar o plano" e "Tirar o plano".
 */
export default async function PlanoDaMetaPage(props: PageProps<"/planejamento/metas/[id]/plano">) {
  const { id } = await props.params;
  const mudar = (await props.searchParams).mudar === "1";
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const meta = await metaDoPlano(ctx, id, hoje);
  if (!meta) notFound();
  const [disponivel, gravado] = await Promise.all([planoDisponivel(ctx), lerPlano(ctx, id)]);

  if (!disponivel) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5">
        <p className="rounded-[24px] border border-border bg-surface p-4 text-[15px] text-ink">O plano da meta ainda não funciona neste perfil.</p>
        <Link href={`/planejamento/metas/${id}`} className="flex min-h-[52px] items-center justify-center rounded-full bg-surface-2 text-base font-semibold text-ink">
          Voltar para a meta
        </Link>
      </div>
    );
  }

  if (gravado && !mudar) return <Combinado meta={meta} plano={gravado} />;

  const entrada = await entradaDoPlano(ctx, meta, hoje);
  const plano = planoDaMeta(entrada);
  if (!plano.mostra) notFound();
  // "Mudar o plano": abre com o que ela tinha escolhido (o que ainda existe nos gastos).
  // O gasto de hoje pode ter mudado desde o plano: o teto antigo vai para o passo mais perto da régua de agora.
  const inicial = gravado
    ? {
        itens: gravado.itens.flatMap((i) => {
          const c = plano.coisinhas.find((k) => k.id === i.id);
          if (!c) return [];
          if (c.acao === "cancelar") return [{ id: c.id, valor: 0 }];
          const passos = passosDaRegua(c.hoje);
          const valor = passos.reduce((melhor, v) => (Math.abs(v - i.teto) < Math.abs(melhor - i.teto) ? v : melhor), passos[0]);
          return [{ id: c.id, valor }];
        }),
        saida: gravado.saida,
        // O que tinha vindo das outras metas. Ao reabrir, o "por mês" delas já está mais baixo e a
        // régua começa do zero de novo (o que foi trazido já está na meta).
        trazer: [],
      }
    : null;
  return (
    <TelaDoPlano
      meta={{ id: meta.id, nome: meta.nome, alvo: meta.alvo, guardado: meta.guardado, prazo: chaveDoPrazo(meta.prazo), taxaAnual: meta.taxaAnual, rascunho: meta.rascunho }}
      plano={plano}
      hoje={{ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, dia: hoje.getDate() }}
      inicial={inicial}
    />
  );
}

async function Combinado({ meta, plano }: { meta: Awaited<ReturnType<typeof metaDoPlano>> & object; plano: PlanoGravado }) {
  const money = await serverMoney();
  const m = (v: number) => money(v, { round: Number.isInteger(Math.round(v * 100) / 100) });
  const prazo = meta.prazo ? textoDoPrazo(meta.prazo) : textoDoPrazoGravado(plano.prazo);
  const tetos = plano.itens.filter((i) => i.acao === "reduzir" && i.teto > 0);
  const cancelar = plano.itens.filter((i) => i.acao === "cancelar");
  const linha = "flex items-center gap-3";
  // O que o "Tirar o plano" faz com a meta (16/10/2026): volta aos valores de antes do plano, ou fica
  // como está quando ela mexeu na meta à mão depois.
  const previa = previaDoTirar(meta, plano);
  const avisoDoTirar =
    previa.acao === "voltar"
      ? `A meta volta para ${m(previa.valores.porMes)} por mês${previa.valores.prazo ? ` até ${textoDoPrazoGravado(previa.valores.prazo)}` : ""}${previa.valores.alvo !== meta.alvo ? `, de ${m(previa.valores.alvo)}` : ""}.`
      : previa.acao === "mexida"
        ? "A meta fica como está agora."
        : null;
  const devolve = (plano.trazidos ?? []).map((t) => t.nome).filter(Boolean);
  const avisoCompleto = [avisoDoTirar, devolve.length ? `O que veio de ${devolve.join(" e ")} volta para lá.` : null].filter(Boolean).join(" ") || null;
  const icone = "flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent-strong";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-plano="combinado">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-1 pt-1">
        <Link href="/planejamento/metas" className="flex min-h-11 items-center gap-0.5 justify-self-start pr-2 text-[15px] font-medium text-ink">
          <ChevronLeft size={18} aria-hidden /> Metas
        </Link>
        <h1 className="text-center text-[15px] font-semibold text-ink">Combinado</h1>
        <span />
      </div>
      <h2 className="text-[28px] font-semibold leading-tight text-ink">Seu plano</h2>
      <div className="flex items-center gap-3 rounded-[20px] border border-border bg-surface p-3.5">
        {meta.foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do banco do app ou a da pessoa (rota autenticada)
          <img src={meta.foto} alt="" className="size-[52px] shrink-0 rounded-[14px] object-cover" />
        ) : (
          <span className={icone}>
            <PiggyBank size={18} aria-hidden />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-[15px] font-semibold text-ink">{meta.nome}</b>
          <small className="text-[13px] tabular-nums text-ink-muted">
            {m(meta.alvo)}
            {prazo ? ` até ${prazo}` : ""}
          </small>
        </span>
        <span className="whitespace-nowrap text-[15px] font-semibold tabular-nums text-ink" data-por-mes>
          {m(meta.porMes)}/mês
        </span>
      </div>

      {(plano.trazidos?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-3.5" data-trazidos>
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Veio das outras metas</h3>
          {plano.trazidos!.map((t) => (
            <div key={t.id} className={linha}>
              <span className={icone}>
                <PiggyBank size={18} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-[14.5px] font-semibold text-ink">{t.nome}</b>
                <small className="text-[12.5px] tabular-nums text-ink-muted">
                  era {m(t.antes)} por mês, agora {m(t.depois)}
                </small>
              </span>
              <span className="whitespace-nowrap text-[14.5px] font-semibold tabular-nums text-ink">+{m(t.valor)}</span>
            </div>
          ))}
        </div>
      )}

      {plano.itens.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-3.5">
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">No seu mês</h3>
          {plano.itens.map((i) => (
            <div key={i.id} className={linha}>
              <LogoDaCoisinha marca={i.marca} tipo={i.tipo} size={36} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-[14.5px] font-semibold text-ink">{i.nome}</b>
                <small className="text-[12.5px] tabular-nums text-ink-muted">era {m(i.hoje)} por mês</small>
              </span>
              <span className="whitespace-nowrap text-[14.5px] font-semibold tabular-nums text-ink">{i.acao === "cancelar" ? "cancelar" : `até ${m(i.teto)}`}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-3.5">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Como o app acompanha</h3>
        <div className={linha}>
          <span className={icone}>
            <PiggyBank size={18} aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <b className="text-[14.5px] font-semibold text-ink">Guardar {m(meta.porMes)} por mês</b>
            <small className="text-[12.5px] text-ink-muted">na meta {meta.nome}</small>
          </span>
        </div>
        {tetos.length > 0 && (
          <div className={linha}>
            <span className={icone}>
              <Bell size={18} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <b className="text-[14.5px] font-semibold text-ink">Aviso no caminho</b>
              <small className="text-[12.5px] tabular-nums text-ink-muted">{tetos.map((t) => `${t.nome} em ${m(Math.floor(t.teto * AVISO_EM))}`).join(", ")}</small>
            </span>
          </div>
        )}
        {cancelar.length > 0 && (
          <div className={linha}>
            <span className={icone}>
              <CalendarClock size={18} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col">
              <b className="text-[14.5px] font-semibold text-ink">Lembrete de cancelar</b>
              <small className="text-[12.5px] text-ink-muted">{cancelar.map((c) => c.nome).join(", ")}, no dia da cobrança</small>
            </span>
          </div>
        )}
      </div>

      <Link href={`/planejamento/metas/${meta.id}/plano?mudar=1`} className="flex min-h-[52px] w-full items-center justify-center rounded-full bg-ink px-5 text-base font-semibold text-canvas">
        Mudar o plano
      </Link>
      <TirarPlano metaId={meta.id} aviso={avisoCompleto} />
    </div>
  );
}
