"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CalendarClock, Check, CreditCard, Landmark, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { Explica } from "@/components/ui/Explica";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { lerData } from "@/lib/contas/contas";
import { guardePorMes, mesesAte, regraDaConta, textoDaRegra, venceNesteMes } from "@/lib/contas/frequencia";
import { ehDoAno, faltaNoMes, pagaNoMes } from "@/lib/contas/recorrentes";
import { vibrar } from "@/lib/celebrar";
import { brilharQuandoAparecer } from "@/lib/ui/brilho";
import { desfazerPagamentoAction } from "./actions";
import { PagueiDaConta, type DadosDoPagueiNaTela, type PagueiFeito } from "./PagueiDaConta";
import { useAbrirConta } from "./folha-contexto";
import { iconeDaConta } from "./icone-da-conta";
import type { ContaSerial } from "./LinhaDaConta";

const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const diaDoIso = (iso: string) => Number(iso.slice(8, 10));

function Selo({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--color-dinheiro-faltou)_16%,var(--color-surface))] px-2 py-px text-[12px] text-ink">{children}</span>;
}

/** O valor com o "~" da aproximada; a conta antiga sem valor diz só "varia". */
function Valor({ c, riscado = false }: { c: ContaSerial; riscado?: boolean }) {
  const money = useMoney();
  if (c.valor === null) return <span className="text-[13px] text-ink-muted">varia</span>;
  return <span className={`shrink-0 text-[16px] tabular-nums ${riscado ? "text-ink-muted line-through" : "text-ink"}`}>{`${c.aproximado ? "~" : ""}${money(c.valor, { round: c.aproximado })}`}</span>;
}

/** Uma conta do mês: logo ou ícone, nome, quando vence, o valor e o círculo do "Paguei". */
function LinhaDoMes({ c, hoje, selo, onPaguei }: { c: ContaSerial; hoje: string; selo?: string; onPaguei: () => void }) {
  const abrir = useAbrirConta();
  const hojeD = lerData(hoje)!;
  const paga = pagaNoMes(c, hojeD);
  const venc = lerData(c.vencimento)!;
  const atrasada = !paga && venc.getTime() < hojeD.getTime();
  const regra = regraDaConta(c);
  const naoMensal = regra.tipo !== "nao_repete" && !(regra.tipo === "a_cada" && regra.unidade === "meses" && regra.n === 1);
  const parcela = c.parcelas && c.parcelas > 1 ? `${c.parcelaAtual ?? 1} de ${c.parcelas}` : null;
  const quando = paga
    ? `Pago dia ${diaDoIso(c.pagaEm!)}`
    : atrasada
      ? `Venceu dia ${venc.getUTCDate()}`
      : `${SEMANA[venc.getUTCDay()]}, dia ${venc.getUTCDate()}${naoMensal ? ` · ${textoDaRegra(regra)}` : ""}`;

  return (
    <li className="flex items-center gap-2.5 rounded-xl py-3" data-brilho={`conta-${c.id}`}>
      <button type="button" onClick={() => abrir({ conta: c })} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <LogoDoLancamento descricao={c.nome} icon={iconeDaConta(c.nome)} cor="var(--color-ink-muted)" />
        <span className="min-w-0 flex-1">
          <span className={`block break-words hyphens-auto text-[16px] leading-snug max-[359px]:text-[15px] ${paga ? "text-ink-muted line-through" : "text-ink"}`}>{c.nome}</span>
          <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className={`text-[13px] leading-snug ${atrasada ? "text-danger" : "text-ink-muted"}`}>{parcela ? `${parcela} · ${quando}` : quando}</span>
            {!paga && (c.aproximado || c.valor === null) && <Selo>varia</Selo>}
            {!paga && selo && <Selo>{selo}</Selo>}
            {c.origem === "historico" && <span className="shrink-0 rounded-full bg-surface-2 px-2 py-px text-xs text-ink-muted">do extrato</span>}
          </span>
        </span>
        <Valor c={c} riscado={paga} />
      </button>
      {paga ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" role="img" aria-label="Paga">
          <Check size={16} strokeWidth={2.2} aria-hidden />
        </span>
      ) : (
        <button
          type="button"
          onClick={onPaguei}
          aria-label={`Marcar ${c.nome} como paga`}
          data-paguei={c.id}
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-strong before:absolute before:-inset-1 before:content-['']"
        />
      )}
    </li>
  );
}

/** "Entrou nos gastos": o gasto que o "Paguei" acabou de criar, com de onde saiu e o dia. */
function EntrouNosGastos({ feito }: { feito: PagueiFeito }) {
  const money = useMoney();
  const I = feito.origem?.tipo === "cartao" ? CreditCard : feito.origem?.tipo === "dinheiro" ? Banknote : Landmark;
  const dia = `${Number(feito.dia.slice(8, 10))}/${feito.dia.slice(5, 7)}`;
  return (
    <div className="flex flex-col gap-2 aviso-sobe" data-entrou-nos-gastos>
      <p className="px-1 text-[14px] font-medium text-ink">Entrou nos gastos</p>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3">
        <LogoDoLancamento descricao={feito.nome} icon={iconeDaConta(feito.nome)} cor="var(--color-ink-muted)" />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[15px] font-medium leading-snug text-ink">{feito.nome}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] text-ink-muted">
            <I size={13} strokeWidth={1.8} className="shrink-0" aria-hidden />
            {feito.origem ? `${feito.origem.rotulo} · ${dia}` : dia}
          </span>
        </span>
        <span className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{money(feito.valor)}</span>
      </div>
    </div>
  );
}

/**
 * As contas do mês (protótipo aprovado): "Faltam R$ X em N contas", as pagas riscadas com o dia,
 * as que faltam com o dia da semana e o círculo para marcar como paga. As contas do ano moram na
 * seção delas.
 */
/** O "Paguei" de uma lista de contas: a linha aberta (uma por vez), o último gasto criado e o Desfazer. */
function usePaguei() {
  const router = useRouter();
  const { showToast } = useToast();
  const [aberta, setAberta] = useState<string | null>(null);
  const [feito, setFeito] = useState<PagueiFeito | null>(null);

  function pago(r: PagueiFeito) {
    setAberta(null);
    setFeito(r);
    vibrar("sucesso");
    // A linha volta paga e acende; a pílula curta traz o Desfazer (o gasto saiu desta tela).
    brilharQuandoAparecer(`conta-${r.contaId}`);
    showToast(`${r.nome} paga`, {
      label: "Desfazer",
      onClick: () => {
        setFeito((f) => (f?.lancamentoId === r.lancamentoId ? null : f));
        void desfazerPagamentoAction(r.contaId, r.antes, r.antesParcela, r.lancamentoId).then(() => router.refresh());
      },
    });
    router.refresh();
  }
  return { aberta, setAberta, feito, pago };
}

export function ContasAPagar({ contas, pagas, hoje, selos, paguei }: { contas: ContaSerial[]; pagas: ContaSerial[]; hoje: string; /** Um selo a mais por conta (id → texto): a guia do MEI "estimado pelo app". */ selos?: Record<string, string>; paguei: DadosDoPagueiNaTela }) {
  const money = useMoney();
  const abrir = useAbrirConta();
  const router = useRouter();
  const [, iniciar] = useTransition();
  const { aberta, setAberta, feito, pago } = usePaguei();
  const hojeD = lerData(hoje)!;
  const doMes = contas.filter((c) => !ehDoAno(c));
  const falta = faltaNoMes(doMes, hojeD);
  // Pagas primeiro (o começo do mês), depois as que faltam, pela data.
  const ordem = [...doMes].sort((a, b) => Number(pagaNoMes(b, hojeD)) - Number(pagaNoMes(a, hojeD)) || a.vencimento.localeCompare(b.vencimento));

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="titulo-tema text-lg font-medium text-ink">Contas</h2>
          {falta.quantas > 0 && (
            <p className="text-[13px] text-ink-muted">
              Faltam {falta.aproximado ? "~" : ""}
              {money(falta.total)} em {falta.quantas} {falta.quantas === 1 ? "conta" : "contas"}
            </p>
          )}
        </div>
        <button type="button" onClick={() => abrir({})} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm text-accent-strong active:scale-95">
          <Plus size={16} strokeWidth={1.8} aria-hidden /> Adicionar
        </button>
      </div>
      {ordem.length === 0 ? (
        <button type="button" onClick={() => abrir({})} className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border-strong bg-surface px-6 py-8 text-center">
          <CalendarClock size={24} className="text-ink-muted" aria-hidden />
          <span className="text-[15px] text-ink">Cadastre a primeira conta</span>
          <span className="text-[13px] text-ink-muted">O app lembra antes de vencer.</span>
        </button>
      ) : (
        <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-3">
          {ordem.map((c) =>
            aberta === c.id ? (
              <li key={c.id} className="py-2">
                <PagueiDaConta conta={c} dados={paguei} hoje={hoje} onPago={pago} onFechar={() => setAberta(null)} />
              </li>
            ) : (
              <LinhaDoMes key={c.id} c={c} hoje={hoje} selo={selos?.[c.id]} onPaguei={() => setAberta(c.id)} />
            ),
          )}
        </ul>
      )}
      {feito && <EntrouNosGastos feito={feito} />}
      {pagas.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-ink-muted">Pagas há pouco</summary>
          <ul className="divide-y divide-border pb-1">
            {pagas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{c.nome}</span>
                  <span className="block text-[13px] text-ink-muted">Pago dia {diaDoIso(c.pagaEm ?? c.vencimento)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => iniciar(async () => { await desfazerPagamentoAction(c.id, c.vencimento); router.refresh(); })}
                  className="min-h-11 shrink-0 px-2 text-[13px] font-medium text-accent-strong"
                >
                  Desfazer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Contas do ano (rodada 4, 6a): cada uma com o "guarde por mês" e o total para separar. */
export function ContasDoAno({ contas, hoje, paguei }: { contas: ContaSerial[]; hoje: string; paguei: DadosDoPagueiNaTela }) {
  const money = useMoney();
  const abrir = useAbrirConta();
  const { aberta, setAberta, feito, pago } = usePaguei();
  const hojeD = lerData(hoje)!;
  const doAno = contas.filter(ehDoAno).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const linhas = doAno.map((c) => {
    const venc = lerData(c.vencimento)!;
    return { c, venc, guarde: c.valor ? guardePorMes(c.valor, venc, hojeD) : 0, regra: regraDaConta(c) };
  });
  const total = linhas.reduce((s, l) => s + l.guarde, 0);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="titulo-tema text-lg font-medium text-ink">Contas do ano</h2>
        <button type="button" onClick={() => abrir({ doAno: true })} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm text-accent-strong active:scale-95">
          <Plus size={16} strokeWidth={1.8} aria-hidden /> Adicionar
        </button>
      </div>
      {linhas.length === 0 ? (
        <button type="button" onClick={() => abrir({ doAno: true })} className="rounded-3xl border border-dashed border-border-strong bg-surface px-5 py-5 text-left text-[14px] text-ink-muted">
          IPVA, seguro, matrícula: cadastre e eu digo quanto separar por mês.
        </button>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-3">
            {linhas.map(({ c, venc, guarde, regra }) =>
              aberta === c.id ? (
                <li key={c.id} className="py-2">
                  <PagueiDaConta conta={c} dados={paguei} hoje={hoje} onPago={pago} onFechar={() => setAberta(null)} />
                </li>
              ) : (
                <li key={c.id} className="flex items-center gap-2.5" data-brilho={`conta-${c.id}`}>
                  <button type="button" onClick={() => abrir({ conta: c })} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
                    <LogoDoLancamento descricao={c.nome} icon={iconeDaConta(c.nome)} cor="var(--color-ink-muted)" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="min-w-0 break-words text-[16px] leading-snug text-ink">{c.nome}</span>
                        <Selo>{regra.tipo === "a_cada" && regra.unidade === "anos" && regra.n === 1 ? "anual" : textoDaRegra(regra)}</Selo>
                      </span>
                      <span className={`block text-[13px] ${venceNesteMes(venc, hojeD) && venc.getTime() < hojeD.getTime() ? "text-danger" : "text-ink-muted"}`}>
                        {venceNesteMes(venc, hojeD)
                          ? venc.getTime() < hojeD.getTime()
                            ? `Venceu dia ${venc.getUTCDate()}`
                            : `Vence dia ${venc.getUTCDate()}`
                          : `${MES_LONGO[venc.getUTCMonth()]}${mesesAte(venc, hojeD) >= 12 ? ` de ${venc.getUTCFullYear()}` : ""}`}
                        {c.valor ? ` · ${money(c.valor, { round: true })}` : ""}
                      </span>
                    </span>
                    {guarde > 0 && <span className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{money(guarde, { round: true })}/mês</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAberta(c.id)}
                    aria-label={`Marcar ${c.nome} como paga`}
                    data-paguei={c.id}
                    className="relative flex size-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border-strong before:absolute before:-inset-1 before:content-['']"
                  />
                </li>
              ),
            )}
          </ul>
          {feito && <EntrouNosGastos feito={feito} />}
          <div className="flex items-center justify-between gap-3 rounded-3xl border border-border bg-surface px-4 py-3.5">
            <div>
              <p className="flex items-center gap-2 text-[13px] text-ink-muted">
                <span className="size-2 rounded-full bg-accent" aria-hidden /> Separar para as contas do ano
              </p>
              <p className="mt-1 text-ink">
                <span className="text-[22px] font-light tabular-nums text-accent-strong">{money(total, { round: true })}</span> <span className="text-[14px] text-ink-muted">por mês</span>
              </p>
            </div>
            <Explica>Cada conta do ano dividida pelos meses que faltam até ela vencer. Guardando isso todo mês, o dinheiro está lá no dia.</Explica>
          </div>
        </>
      )}
    </section>
  );
}
