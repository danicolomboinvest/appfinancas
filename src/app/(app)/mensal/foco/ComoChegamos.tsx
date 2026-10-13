import type { FocoLivre } from "@/lib/decisoes/foco";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { RendaQueVaria } from "./RendaQueVaria";

type Livre = Exclude<FocoLivre, { tipo: "semOrcamento" }>;

/** "2,6": semanas com uma casa, sem ",0". */
const semanas = (n: number) => (Math.round(n * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/**
 * "Como chegamos nesse valor" (regra A, 13/10/2026): a cascata em barras, no lugar da tabela de 7
 * linhas. Renda, menos o guardar, menos as contas, menos o que já saiu do dia a dia; o que sobra,
 * dividido pelas semanas que faltam. Cada barra começa onde a anterior parou, então o olho vê o
 * dinheiro sendo tirado da renda até sobrar o pedaço da semana.
 */
export function ComoChegamos({ livre, money, rendaSoOQueEntrou }: { livre: Livre; money: (v: number) => string; rendaSoOQueEntrou: boolean }) {
  const s = livre.semana;
  const temRenda = livre.renda !== null;
  const base = Math.max(1, temRenda ? (livre.renda as number) : livre.planejado);
  const guardar = temRenda ? Math.max(0, livre.guardar ?? 0) : 0;
  type Passo = { rotulo: string; valor: number; tom: "base" | "guardar" | "contas" | "gasto" | "resto"; menos?: boolean; forte?: boolean };
  const passos: Passo[] = [
    { rotulo: temRenda ? (livre.rendaFonte === "entrou" ? "Renda que já entrou" : "Renda do mês") : "Orçamento do mês", valor: temRenda ? (livre.renda as number) : livre.planejado, tom: "base" },
    ...(guardar >= 1 ? [{ rotulo: "Guardar primeiro", valor: guardar, tom: "guardar" as const, menos: true }] : []),
    { rotulo: "Contas fixas e parcelas", valor: livre.contas.total, tom: "contas", menos: true },
    ...(s.semDestino >= 1 ? [{ rotulo: "Sem destino no orçamento", valor: s.semDestino, tom: "contas" as const, menos: true }] : []),
    { rotulo: livre.tipo === "estimativa" ? "Já gasto, pelo ritmo do plano" : "Já gasto no dia a dia", valor: s.gastoAntes, tom: "gasto", menos: true },
    { rotulo: "Sobra do mês", valor: s.sobraNoInicio, tom: "resto", forte: true },
  ];
  const COR: Record<Passo["tom"], string> = {
    base: "bg-[color-mix(in_srgb,var(--color-accent)_35%,transparent)]",
    guardar: "bg-success",
    contas: "bg-info",
    gasto: "bg-[var(--color-atencao)]",
    resto: "bg-accent-strong",
  };
  let usado = 0;
  const barras = passos.map((p) => {
    if (p.tom === "base") return { left: 0, width: 100 };
    if (p.tom === "resto") return { left: Math.min(100, (usado / base) * 100), width: Math.max(0, Math.min(100, (Math.max(0, p.valor) / base) * 100)) };
    const left = Math.min(100, (usado / base) * 100);
    const width = Math.max(0, Math.min(100 - left, (Math.max(0, p.valor) / base) * 100));
    usado += Math.max(0, p.valor);
    return { left, width };
  });
  const semanaCheia = s.diasNaSemana === 7;

  return (
    <div className="flex flex-col gap-3 text-ink" data-como-chegamos>
      <p className="text-[14px] text-ink-muted">Já tiramos o guardar e as contas do mês. O resto, dividido pelas semanas.</p>
      <div className="flex flex-col gap-2.5">
        {passos.map((p, i) => (
          <div key={p.rotulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
            <span className={`min-w-0 text-[14px] ${p.forte ? "font-semibold" : ""}`}>{p.rotulo}</span>
            <span className="whitespace-nowrap text-right text-[14.5px] font-semibold tabular-nums">
              {p.menos ? "− " : p.valor < 0 ? "− " : ""}
              {money(Math.abs(p.valor))}
            </span>
            <div className="relative col-span-2 h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <i className={`absolute inset-y-0 rounded-full ${COR[p.tom]}`} style={{ left: `${barras[i].left}%`, width: `${barras[i].width}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3.5 py-3">
        <span className="min-w-0 text-[14px]">
          {semanaCheia
            ? `÷ ${semanas(s.diasAteOFimDoMes / 7)} semanas que faltam`
            : `Semana de ${s.diasNaSemana} ${s.diasNaSemana === 1 ? "dia" : "dias"} neste mês, de ${s.diasAteOFimDoMes} que faltam`}
        </span>
        <b className="whitespace-nowrap text-2xl font-semibold tabular-nums text-accent-strong">{money(s.valor)}</b>
      </div>
      {s.cortadoPelaRenda && <p className="rounded-xl bg-[var(--color-atencao-fundo)] px-3 py-2 text-[13px] text-ink">Seu orçamento passa da renda menos o guardar. Usamos o limite da renda.</p>}
      {s.chegouDepois >= 1 && (
        <p className="text-[13px] text-ink-muted">
          {money(s.chegouDepois)} chegaram depois, com data de antes desta semana. Entram na conta da próxima.
        </p>
      )}
      {livre.contas.pendentes >= 1 && <p className="text-[13px] text-ink-muted">Nas contas, {money(livre.contas.pendentes)} ainda vão sair: já estão separados.</p>}
      <RendaQueVaria ligado={rendaSoOQueEntrou} />
      <p className="text-[12.5px] text-ink-muted">É o seu orçamento, não o saldo do banco. Compras no cartão contam no dia da compra.</p>
      <ReportarErro tela="Foco: para gastar nesta semana" regra="(renda − guardar − contas fixas e parcelas − dia a dia já gasto antes da semana) ÷ dias que faltam × dias da semana no mês; o valor fica fixo até domingo" />
    </div>
  );
}
