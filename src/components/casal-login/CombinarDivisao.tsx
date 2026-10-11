"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ListChecks, Lock, Minus, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { salvarConfigCasalAction } from "@/app/(app)/divisao/casal-actions";
import { mostrarRendaAction } from "@/app/(app)/divisao/nos-dois-actions";
import type { ModoDeDivisao } from "@/lib/casal/acerto";
import { BOTAO_ESCURO, Bolinha, COR_DO_PAR } from "./visual";

type Letra = "A" | "B";

export type DadosDaDivisao = {
  nomes: { A: string; B: string };
  letraTitular: Letra;
  souPar: boolean;
  /** As rendas do mês; nulo quando quem olha é o par e a titular não mostrou (só a proporção). */
  rendas: { A: number; B: number } | null;
  fracaoRenda: number;
  /** O plano da casa do mês, ou, sem plano, o que a casa gastou até agora. */
  base: { valor: number; rotulo: string };
  divisao: ModoDeDivisao;
  pctA: number | null;
  mostrarRenda: boolean;
  contasComJeitoProprio: number;
  nomeDoMes: string;
};

/**
 * Combinar a divisão em passo a passo (direção B da proposta aprovada): uma pergunta por vez.
 * 1. Quanto entra para cada um (bolhas do tamanho da renda; o par vê só a proporção).
 * 2. Como vocês dividem a casa (pela renda, meio a meio ou combinado).
 * 3. Fica assim: o anel com as duas partes, quanto cada um põe, e o "Detalhar conta por conta".
 * Quem grava é a titular; o par percorre os passos e vê como está combinado.
 */
export function CombinarDivisao({ d }: { d: DadosDaDivisao }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [rendas, setRendas] = useState(d.rendas ?? { A: 0, B: 0 });
  const [nomes, setNomes] = useState(d.nomes);
  const [jeito, setJeito] = useState<ModoDeDivisao>(d.divisao);
  const [pc, setPc] = useState(d.pctA ?? 60);
  const [mostra, setMostra] = useState(d.mostrarRenda);
  const [ocupado, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const outra: Letra = d.letraTitular === "A" ? "B" : "A";
  const ordem: Letra[] = ["A", "B"];
  const cor = (l: Letra) => (l === d.letraTitular ? "var(--color-accent-strong)" : COR_DO_PAR);
  const comValores = d.rendas !== null;
  const total = rendas.A + rendas.B;
  const fRenda = comValores ? (total > 0 ? rendas.A / total : 0.5) : d.fracaoRenda;
  const pctDe = (j: ModoDeDivisao) => Math.round((j === "renda" ? fRenda : j === "meio" ? 0.5 : pc / 100) * 100);
  const pA = pctDe(jeito);
  const semRenda = comValores && (rendas.A === 0 || rendas.B === 0);

  function salvar() {
    setAviso(null);
    start(async () => {
      const r = await salvarConfigCasalAction({ nomeA: nomes.A, nomeB: nomes.B, divisao: jeito, pctA: pc });
      if (!r.ok) return setAviso(r.mensagem);
      setAviso("Combinado. O acerto já usa este jeito.");
      router.refresh();
    });
  }

  function trocarMostra() {
    const novo = !mostra;
    setMostra(novo);
    start(async () => {
      const r = await mostrarRendaAction(novo);
      if (!r.ok) {
        setMostra(!novo);
        setAviso(r.mensagem);
      } else router.refresh();
    });
  }

  const maior = Math.max(rendas.A, rendas.B, 1);
  const bolha = (l: Letra) => {
    const proporcao = comValores ? (total > 0 ? rendas[l] / maior : 1) : (l === "A" ? fRenda : 1 - fRenda) / Math.max(fRenda, 1 - fRenda);
    return 44 + 76 * Math.sqrt(Math.max(0.05, proporcao));
  };

  return (
    <section aria-label="Como vocês dividem a casa" className="rounded-[22px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border),0_10px_30px_-18px_rgba(0,0,0,0.18)]">
      <div className="flex justify-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <i key={i} className={`h-1.5 rounded-full transition-all ${i === passo ? "w-5 bg-accent-strong" : "w-1.5 bg-border-strong"}`} />
        ))}
      </div>

      {passo === 0 && (
        <div className="mt-4 flex flex-col items-center">
          <h2 className="titulo-tema text-balance text-center text-[30px] font-medium leading-tight text-ink">Quanto entra pra cada um?</h2>
          <div className="my-5 flex h-[124px] items-center justify-center" aria-hidden>
            {ordem.map((l, i) => (
              <span key={l} className="rounded-full" style={{ width: bolha(l), height: bolha(l), background: cor(l), marginLeft: i ? -bolha(l) * 0.32 : 0, opacity: i ? 0.82 : 0.92 }} />
            ))}
          </div>
          <div className="flex w-full flex-col gap-2.5">
            {ordem.map((l) => (
              <div key={l} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
                <Bolinha nome={nomes[l]} cor={l === d.letraTitular ? "titular" : "par"} size={34} />
                <div className="min-w-0 flex-1">
                  {d.souPar ? (
                    <span className="block truncate text-[15px] font-medium text-ink">{nomes[l]}</span>
                  ) : (
                    <input
                      value={nomes[l]}
                      onChange={(e) => setNomes((n) => ({ ...n, [l]: e.target.value.slice(0, 14) }))}
                      aria-label={`Nome de ${nomes[l]}`}
                      className="w-full bg-transparent text-[15px] font-medium text-ink outline-none"
                    />
                  )}
                  <span className="block text-ink">
                    {comValores ? (
                      <ValorDestaque texto={m(rendas[l])} className="text-[24px] font-light leading-tight tabular-nums" />
                    ) : (
                      <span className="text-[24px] font-light leading-tight tabular-nums">{Math.round((l === "A" ? fRenda : 1 - fRenda) * 100)}%</span>
                    )}
                  </span>
                </div>
                {comValores && !d.souPar && (
                  <div className="flex gap-1.5">
                    <button type="button" aria-label={`Menos 100 para ${nomes[l]}`} onClick={() => setRendas((r) => ({ ...r, [l]: Math.max(0, r[l] - 100) }))} className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border)]">
                      <Minus size={16} strokeWidth={1.8} />
                    </button>
                    <button type="button" aria-label={`Mais 100 para ${nomes[l]}`} onClick={() => setRendas((r) => ({ ...r, [l]: r[l] + 100 }))} className="flex size-10 items-center justify-center rounded-full bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-border)]">
                      <Plus size={16} strokeWidth={1.8} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[13px] text-ink-muted">
            {!comValores
              ? `As rendas ficam com ${d.nomes[d.letraTitular]}. Aqui, só a proporção.`
              : semRenda
                ? `Lance a renda de cada um em ${d.nomeDoMes} para dividir pela renda.`
                : d.souPar
                  ? `Veio das entradas de ${d.nomeDoMes}.`
                  : `Veio das entradas de ${d.nomeDoMes}. Toque no nome para trocar.`}
          </p>
        </div>
      )}

      {passo === 1 && (
        <div className="mt-4 flex flex-col">
          <h2 className="titulo-tema text-balance text-center text-[30px] font-medium leading-tight text-ink">Como vocês dividem a casa?</h2>
          <div className="mt-5 flex flex-col gap-2.5" role="radiogroup" aria-label="Jeito de dividir">
            {(["renda", "meio", "combinado"] as const).map((j) => {
              const p = pctDe(j);
              const ativo = jeito === j;
              return (
                <div
                  key={j}
                  role="radio"
                  aria-checked={ativo}
                  tabIndex={0}
                  onClick={() => setJeito(j)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setJeito(j)}
                  className={`cursor-pointer rounded-2xl px-4 py-3.5 text-left transition-shadow ${ativo ? "bg-surface shadow-[inset_0_0_0_1.5px_var(--color-ink)]" : "bg-surface-2"}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex items-center" aria-hidden>
                      <i className="rounded-full" style={{ width: 8 + p * 0.28, height: 8 + p * 0.28, background: cor("A") }} />
                      <i className="-ml-1 rounded-full" style={{ width: 8 + (100 - p) * 0.28, height: 8 + (100 - p) * 0.28, background: cor("B") }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16px] font-semibold text-ink">{j === "renda" ? "Pela renda" : j === "meio" ? "Meio a meio" : "Combinado"}</span>
                      <span className="block text-[13px] text-ink-muted">
                        {nomes.A} {m((d.base.valor * p) / 100)} · {nomes.B} {m((d.base.valor * (100 - p)) / 100)}
                      </span>
                    </span>
                  </span>
                  {j === "combinado" && ativo && (
                    <input
                      type="range"
                      min={20}
                      max={80}
                      step={5}
                      value={pc}
                      onChange={(e) => setPc(Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Parte de ${nomes.A} na casa, em por cento`}
                      className="mt-3 w-full accent-[var(--color-accent-strong)]"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="mt-4 flex flex-col items-center">
          <h2 className="titulo-tema text-center text-[30px] font-medium leading-tight text-ink">Fica assim</h2>
          <Anel pctA={pA} corA={cor("A")} corB={cor("B")} rotulo={d.base.rotulo} valor={m(d.base.valor)} />
          <div className="mt-2 grid w-full grid-cols-2 gap-3">
            {ordem.map((l) => {
              const p = l === "A" ? pA : 100 - pA;
              return (
                <div key={l} className={`flex flex-col ${l === "B" ? "items-end text-right" : ""}`}>
                  <span className={`flex items-center gap-1.5 text-[14px] text-ink-muted ${l === "B" ? "flex-row-reverse" : ""}`}>
                    <Bolinha nome={nomes[l]} cor={l === d.letraTitular ? "titular" : "par"} size={20} />
                    {nomes[l]}
                  </span>
                  <span className="text-[30px] font-light leading-tight tabular-nums text-ink">
                    {p}
                    <small className="text-[14px]">%</small>
                  </span>
                  <span className="text-[13px] text-ink-muted">
                    põe <b className="font-semibold text-ink">{m((d.base.valor * p) / 100)}</b>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex w-full items-center gap-2.5 rounded-2xl bg-surface-2 px-3.5 py-3 text-[13px] text-ink-muted">
            <Lock size={15} strokeWidth={1.7} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              {d.souPar
                ? d.mostrarRenda
                  ? `${d.nomes[d.letraTitular]} deixou ver as rendas.`
                  : `As rendas ficam com ${d.nomes[d.letraTitular]}. Aqui, só a proporção.`
                : mostra
                  ? `${nomes[outra]} vê as rendas`
                  : `${nomes[outra]} vê só ${pA}% e ${100 - pA}%`}
            </span>
            {!d.souPar && (
              <button
                type="button"
                role="switch"
                aria-checked={mostra}
                aria-label="Mostrar as rendas"
                onClick={trocarMostra}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${mostra ? "bg-ink" : "bg-surface shadow-[inset_0_0_0_1px_var(--color-border-strong)]"}`}
              >
                <span className={`absolute top-1 size-5 rounded-full shadow transition-all ${mostra ? "left-6 bg-canvas" : "left-1 bg-ink-faint"}`} />
              </button>
            )}
          </div>
          <Link href="/divisao/contas" className="mt-3 flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left shadow-[inset_0_0_0_1px_var(--color-border)]">
            <ListChecks size={20} strokeWidth={1.6} className="shrink-0 text-ink" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">Detalhar conta por conta</span>
              <span className="block text-[13px] text-ink-muted">
                {d.contasComJeitoProprio === 0 ? "Ex.: internet meio a meio, o resto pela renda" : d.contasComJeitoProprio === 1 ? "1 conta com jeito próprio" : `${d.contasComJeitoProprio} contas com jeito próprio`}
              </span>
            </span>
            <ChevronRight size={18} strokeWidth={1.6} className="shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </div>
      )}

      {aviso && <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-center text-[14px] text-ink">{aviso}</p>}
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => setPasso((p) => Math.max(0, p - 1))}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-full bg-surface-2 px-4 text-[16px] font-semibold text-ink ${passo === 0 ? "invisible" : ""}`}
        >
          Voltar
        </button>
        {passo < 2 ? (
          <button type="button" onClick={() => setPasso((p) => p + 1)} className={`${BOTAO_ESCURO} min-h-12 flex-1 text-[16px]`}>
            Continuar
          </button>
        ) : d.souPar ? (
          <span className="flex min-h-12 flex-1 items-center justify-center text-center text-[13px] text-ink-muted">Quem muda é {d.nomes[d.letraTitular]}</span>
        ) : (
          <button type="button" onClick={salvar} disabled={ocupado} className={`${BOTAO_ESCURO} min-h-12 flex-1 text-[16px]`}>
            {ocupado ? "Salvando..." : "Combinado"}
          </button>
        )}
      </div>
    </section>
  );
}

/** O anel das duas partes, com o plano da casa no meio (o arco da pessoa A sai do topo). */
function Anel({ pctA, corA, corB, rotulo, valor }: { pctA: number; corA: string; corB: string; rotulo: string; valor: string }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 200 200" className="my-3 w-[min(210px,70vw)]" role="img" aria-label={`${pctA}% e ${100 - pctA}% de ${valor}`}>
      <circle cx="100" cy="100" r={r} fill="none" stroke={corB} strokeWidth="18" />
      <circle cx="100" cy="100" r={r} fill="none" stroke={corA} strokeWidth="18" strokeDasharray={`${(c * pctA) / 100} ${c}`} transform="rotate(-90 100 100)" />
      <text x="100" y="92" textAnchor="middle" fontSize="12" fill="var(--color-ink-muted)">
        {rotulo}
      </text>
      <text x="100" y="122" textAnchor="middle" fontSize="26" fontWeight="300" fill="var(--color-ink)">
        {valor}
      </text>
    </svg>
  );
}
