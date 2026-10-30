import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { acertoDaCasa } from "@/lib/repositories/casa.repo";
import { casaNaTela } from "@/lib/casa/regras";
import { lerMesEscolhido } from "@/lib/visao-geral/periodo";
import { getDiaInicioMes } from "@/lib/repositories/user.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { Bolinha, ParDeAvatares } from "@/components/casal-login/visual";
import { Escolhas } from "./Escolhas";
import { rotuloDaDivisao, rotuloPelaRenda } from "@/lib/casa/escolhas";

export const metadata = { title: "Acerto do mês · SPI Finance" };

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * O Acerto do mês do Casal simples (protótipo aprovado: "o acerto vira um cartão"). Quem manda
 * para quem, quanto cada um pagou, o jeito de dividir e o "Marcar como acertado". Os meses já
 * acertados e fechados a dois no Nós dois continuam aparecendo aqui.
 */
export default async function AcertoPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getRequiredSession();
  const casa = casaNaTela(ctx.casa);
  if (!casa) notFound();
  const agora = nowInBrazil();
  const { mes: mesBusca } = await props.searchParams;
  const { ano, mes } = lerMesEscolhido(mesBusca, agora, await getDiaInicioMes(ctx));
  const [acerto, money] = await Promise.all([acertoDaCasa(ctx, ano, mes), serverMoney()]);
  if (!acerto) notFound();
  const m = (v: number) => money(v, { round: true });
  const valor = Math.round(Math.abs(acerto.euMando));
  const anterior = new Date(ano, mes - 2, 1);
  const seguinte = new Date(ano, mes, 1);
  const temSeguinte = seguinte.getFullYear() * 12 + seguinte.getMonth() <= agora.getFullYear() * 12 + agora.getMonth();
  const linkDoMes = (d: Date) => `/mensal/foco/acerto?mes=${d.getFullYear()}-${d.getMonth() + 1}`;
  // A proporção da renda mesmo quando a casa divide de outro jeito (o rótulo é da opção "Pela
  // renda"); sem a renda dos dois, avisa que falta em vez de calar. Só a proporção, nunca o valor.
  const pctCombinado = Math.round(acerto.divisao.pctEuCombinado);
  const rotuloRenda = rotuloPelaRenda(acerto.divisao);
  const pessoas = [acerto.eu, acerto.outro];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href="/mensal/foco" className="inline-flex min-h-11 items-center gap-1 self-start px-1 text-[15px] text-ink">
        <ChevronLeft size={18} aria-hidden /> Resumo
      </Link>

      <div className="flex items-center justify-between gap-2">
        <Link href={linkDoMes(anterior)} aria-label="Mês anterior" className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink">
          <ChevronLeft size={18} aria-hidden />
        </Link>
        <h1 className="text-center text-[17px] font-medium text-ink">
          Acerto de {MESES[mes - 1].toLowerCase()}
          {ano !== agora.getFullYear() ? ` de ${ano}` : ""}
        </h1>
        {temSeguinte ? (
          <Link href={linkDoMes(seguinte)} aria-label="Mês seguinte" className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-ink">
            <ChevronRight size={18} aria-hidden />
          </Link>
        ) : (
          <span className="size-11" aria-hidden />
        )}
      </div>

      <section className="flex flex-col items-center gap-3 rounded-[28px] border border-border bg-surface px-5 py-6 text-center" data-acerto-valor={acerto.euMando}>
        <ParDeAvatares titular={acerto.eu.papel === "titular" ? acerto.eu.nome : acerto.outro.nome} par={acerto.eu.papel === "par" ? acerto.eu.nome : acerto.outro.nome} size={56} />
        {valor < 1 ? (
          <b className="text-[26px] font-medium text-ink">Quites</b>
        ) : (
          <>
            <span className="text-[15px] text-ink-muted">{acerto.euMando > 0 ? `Você manda para ${acerto.outro.nome}` : `${acerto.outro.nome} manda para você`}</span>
            <b className="text-[2.5rem] font-light leading-none tracking-[-0.03em] tabular-nums text-ink">{m(valor)}</b>
          </>
        )}
        <span className="flex flex-wrap items-center justify-center gap-2 text-[13px]">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-ink-muted">Da casa {m(acerto.totalDaCasa)}</span>
          {acerto.fechado && <span className="rounded-full bg-success-soft px-3 py-1 text-success">Fechado a dois</span>}
        </span>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        {pessoas.map((p) => (
          <div key={p.letra} className="flex min-w-0 flex-col gap-2 rounded-3xl border border-border bg-surface p-4" data-pessoa-do-acerto={p.letra}>
            <span className="flex min-w-0 items-center gap-2">
              <Bolinha nome={p.nome} cor={p.papel} size={26} />
              <span className="truncate text-[15px] text-ink">{p === acerto.eu ? "Você" : p.nome}</span>
            </span>
            <span className="text-[13px] text-ink-muted">Pagou</span>
            <b className="text-[1.35rem] font-light leading-none tabular-nums text-ink">{m(acerto.pagou[p.letra])}</b>
            <span className="text-[13px] text-ink-muted">Parte</span>
            <b className="text-[1.05rem] font-light leading-none tabular-nums text-ink">{m(acerto.parte[p.letra])}</b>
          </div>
        ))}
      </div>

      {acerto.gastosDaCasa.length > 0 && (
        <section className="flex flex-col gap-2" data-gastos-da-casa>
          <h2 className="px-1 text-[15px] font-medium text-ink">No acerto</h2>
          <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
            {acerto.gastosDaCasa.map((g) => {
              const p = g.quem === "eu" ? acerto.eu : acerto.outro;
              return (
                <div key={g.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                  <Bolinha nome={p.nome} cor={p.papel} size={28} />
                  <span className="min-w-0 flex-1">
                    <b className="block break-words text-[15px] font-medium text-ink">{g.descricao}</b>
                    <small className="text-[13px] text-ink-muted" data-gasto-do-acerto={g.deQuem}>
                      {g.quem === "eu" ? "Você pagou" : `${p.nome} pagou`}
                      {g.deQuem === "casa" ? (g.pctEu !== null ? ` · ${rotuloDaDivisao(g.pctEu)}` : "") : g.deQuem === "eu" ? " · seu" : ` · de ${acerto.outro.nome}`}
                      {g.dia ? ` · ${g.dia.slice(8, 10)}/${g.dia.slice(5, 7)}` : ""}
                    </small>
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-ink">{money(g.valor)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Escolhas
        divisao={acerto.config.divisao}
        rotuloRenda={rotuloRenda}
        rotuloCombinado={typeof acerto.config.pctA === "number" ? `Combinado ${pctCombinado}% e ${100 - pctCombinado}%` : null}
        ano={ano}
        mes={mes}
        acertado={acerto.acertado}
        temValor={valor >= 1}
      />

      <p className="px-1 text-[13px] text-ink-muted">Entra o que é da casa e o que um pagou pelo outro. Para trocar, abra o gasto.</p>
    </div>
  );
}
