"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { useMoney } from "@/components/money/MoneyProvider";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { PARENT_CATEGORY_ICON } from "@/lib/categories";
import { definirRegrasDasContasAction } from "@/app/(app)/divisao/casal-actions";
import { direcao, quemPagouTudo, saldoDasContas } from "@/lib/casal-login/conta-por-conta";
import type { ModoDaConta, ModoDeDivisao } from "@/lib/casal/acerto";
import { Bolinha, corDaPessoa } from "./visual";

type Letra = "A" | "B";

export type ContaNaTela = { chave: string; nome: string; parentCategory: ParentCategory | null; valor: number; pagou: { A: number; B: number }; modo: ModoDaConta | null };

const NOME_DO_JEITO: Record<ModoDaConta, string> = { renda: "Pela renda", meio: "Meio a meio", um_paga: "Fora" };

/**
 * Conta por conta (direção C da proposta aprovada, aberta pelo "Detalhar conta por conta"): o
 * acerto no alto e cada conta da casa com o próprio jeito. Trocar uma conta muda o valor na hora
 * (a mesma conta do acerto, refeita aqui), grava, e o Desfazer volta o passo anterior.
 */
export function ContaPorConta({
  contas,
  nomes,
  letraTitular,
  fracaoRenda,
  divisao,
  pctA,
  nomeDoMes,
}: {
  contas: ContaNaTela[];
  nomes: { A: string; B: string };
  letraTitular: Letra;
  fracaoRenda: number;
  divisao: ModoDeDivisao;
  pctA: number | null;
  nomeDoMes: string;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [regras, setRegras] = useState<Record<string, ModoDaConta | null>>(() => Object.fromEntries(contas.map((c) => [c.chave, c.modo])));
  const [historico, setHistorico] = useState<Record<string, ModoDaConta | null>[]>([]);
  const [aberta, setAberta] = useState<string | null>(contas.find((c) => /internet/i.test(c.nome))?.chave ?? null);
  const [, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const geral = divisao === "renda" ? fracaoRenda : divisao === "combinado" ? (pctA ?? 50) / 100 : 0.5;
  const padrao: ModoDaConta = divisao === "meio" ? "meio" : "renda";
  const conta = saldoDasContas(contas, regras, { renda: fracaoRenda, geral });
  const dir = direcao(conta.saldoA);
  const cor = (l: Letra) => (l === letraTitular ? "titular" : "par");

  function gravar(novo: Record<string, ModoDaConta | null>) {
    setHistorico((h) => [...h, regras]);
    setRegras(novo);
    setErro(null);
    start(async () => {
      const r = await definirRegrasDasContasAction(novo);
      if (!r.ok) setErro(r.mensagem);
      else router.refresh();
    });
  }

  function desfazer() {
    const anterior = historico.at(-1);
    if (!anterior) return;
    setHistorico((h) => h.slice(0, -1));
    setRegras(anterior);
    start(async () => {
      await definirRegrasDasContasAction(anterior);
      router.refresh();
    });
  }

  // Escolher o jeito que já é o geral apaga a regra (a conta volta a seguir o combinado).
  const normal = (modo: ModoDaConta): ModoDaConta | null => (divisao !== "combinado" && modo === padrao ? null : modo);
  const efetivo = (c: ContaNaTela): ModoDaConta | "geral" => regras[c.chave] ?? (divisao === "combinado" ? "geral" : padrao);

  return (
    <div className="flex flex-col gap-4 pt-1">
      <Link href="/divisao" className="-ml-1 flex min-h-11 w-fit items-center gap-1 text-[17px] text-ink-muted">
        <ChevronLeft size={20} strokeWidth={1.6} aria-hidden />
        Nós dois
      </Link>
      <section className="rounded-[22px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--color-border),0_10px_30px_-18px_rgba(0,0,0,0.18)]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Acerto de {nomeDoMes}</p>
        <div className="mt-3 flex items-center gap-2.5" aria-live="polite">
          {dir ? (
            <>
              <Bolinha nome={nomes[dir.de]} cor={cor(dir.de)} size={36} />
              <ArrowRight size={26} strokeWidth={1.4} className="text-accent-strong" aria-hidden />
              <Bolinha nome={nomes[dir.para]} cor={cor(dir.para)} size={36} />
              <ValorDestaque texto={m(dir.valor)} className="ml-1 text-[2.25rem] font-light leading-none tracking-[-0.02em] tabular-nums text-ink" />
            </>
          ) : (
            <span className="text-[17px] text-ink">Os dois estão em dia</span>
          )}
        </div>
        {dir && <p className="titulo-tema mt-2 text-[22px] font-medium text-ink">{`${nomes[dir.de]} manda pra ${nomes[dir.para]}`}</p>}
        <p className="mt-1 text-[14px] text-ink-muted">Toque numa conta para mudar o jeito.</p>
        <div className="mt-3 flex min-h-11 items-center justify-between gap-3 text-[13px] text-ink-muted">
          <span>{conta.fora === 0 ? "Todas as contas no acerto" : conta.fora === 1 ? "1 conta fora do acerto" : `${conta.fora} contas fora do acerto`}</span>
          {historico.length > 0 && (
            <button type="button" onClick={desfazer} className="min-h-11 px-1 font-semibold text-ink underline underline-offset-4">
              Desfazer
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["renda", "meio"] as const).map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => gravar(Object.fromEntries(contas.map((c) => [c.chave, normal(j)])))}
              className="min-h-10 rounded-full bg-surface-2 px-4 text-[15px] text-ink"
            >
              {j === "renda" ? "Tudo pela renda" : "Tudo meio a meio"}
            </button>
          ))}
        </div>
        {erro && <p className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-[14px] text-danger">{erro}</p>}
        {contas.length === 0 ? (
          <p className="mt-4 text-[15px] text-ink-muted">Ainda não há conta da casa paga neste mês.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {contas.map((c) => {
              const quem = quemPagouTudo(c);
              const ef = efetivo(c);
              const mudou = regras[c.chave] !== null && regras[c.chave] !== undefined;
              const pc = c.parentCategory ?? "OUTROS";
              return (
                <li key={c.chave} className="py-1">
                  <button type="button" onClick={() => setAberta((a) => (a === c.chave ? null : c.chave))} aria-expanded={aberta === c.chave} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <LogoDoLancamento descricao={c.nome} icon={PARENT_CATEGORY_ICON[pc]} size={40} />
                    <span className="min-w-0 flex-1">
                      {/* Nome numa linha (só ele pode encurtar); valor e quem pagou embaixo, sem cortar de 320 a 430 px. */}
                      <span className="block truncate text-[16px] font-semibold text-ink">{c.nome}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ink-muted">
                        <span className="font-medium tabular-nums text-ink">{m(c.valor)}</span>
                        <i className="size-2 shrink-0 rounded-full" style={{ background: quem ? corDaPessoa(cor(quem)) : "var(--color-ink-faint)" }} aria-hidden />
                        <span>{quem ? `${nomes[quem]} pagou` : "os dois pagaram"}</span>
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${mudou ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-ink-muted"}`}>
                      {ef === "geral" ? `Combinado` : ef === "um_paga" && quem ? `${nomes[quem]} paga` : NOME_DO_JEITO[ef]}
                    </span>
                  </button>
                  {aberta === c.chave && (
                    <div role="group" aria-label={`Como divide ${c.nome}`} className="mb-2 flex gap-1 rounded-full bg-surface-2 p-1">
                      {(["renda", "meio", "um_paga"] as const).map((j) => {
                        const ativo = ef === j;
                        const desligado = j === "um_paga" && !quem;
                        return (
                          <button
                            key={j}
                            type="button"
                            disabled={desligado}
                            aria-pressed={ativo}
                            onClick={() => !ativo && gravar({ ...regras, [c.chave]: normal(j) })}
                            className={`min-h-11 flex-1 rounded-full px-1.5 text-[13px] font-semibold leading-tight disabled:opacity-40 max-[359px]:text-[12px] ${ativo ? "bg-surface text-ink shadow-[inset_0_0_0_1.5px_var(--color-accent-strong)]" : "text-ink-muted"}`}
                          >
                            {j === "renda" ? "Pela renda" : j === "meio" ? "Meio a meio" : quem ? `${nomes[quem]} paga` : "Um paga"}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[13px] text-ink-muted">Quem paga tudo, a conta sai do acerto.</p>
      </section>
    </div>
  );
}
