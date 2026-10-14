"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import { Explica } from "@/components/ui/Explica";
import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { quantoCobrar } from "@/lib/empresa/regras";
import { BOTAO_PRINCIPAL, Cartao, Chip, Voltar } from "../partes";

const MARGENS = [10, 15, 20, 30];

function Campo({ rotulo, valor, onMudar }: { rotulo: string; valor: number | null; onMudar: (v: number | null) => void }) {
  const simbolo = currencySymbol(useCurrency());
  return (
    <label className="flex min-h-16 items-center justify-between gap-3 border-b border-border last:border-b-0">
      <b className="text-[15px] font-medium text-ink">{rotulo}</b>
      <span className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2">
        <span className="text-sm text-ink-muted">{simbolo}</span>
        <CampoDeDinheiro valor={valor} onValor={onMudar} max={9_999_999} placeholder="0,00" aria-label={`${rotulo}, em reais`} className="w-24 bg-transparent text-right text-[17px] font-medium tabular-nums text-ink outline-none" />
      </span>
    </label>
  );
}

// "1234.56" (teclado em inglês) virava 123456: agora o campo é o CampoDeDinheiro, com centavos.
const lerReais = (v: number | null) => v ?? 0;

/**
 * O "Quanto cobrar" do protótipo: o que vai no produto, quanto tempo leva e a etiqueta com o preço
 * mínimo (materiais, o tempo dela, as contas, a taxa da maquininha e o lucro). A taxa é a que ELA
 * digitou em Configurações da empresa; sem ela, a conta sai sem taxa e avisa.
 */
export function QuantoCobrar(p: { nome: string; produto: string; materiais: string; foto: string | null; salario: number; horasPorMes: number; contasDoMes: number; vendasDoMes: number; taxaCredito: number | null; ehMei: boolean; pe: number | null }) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const [passo, setPasso] = useState(1);
  const [mat, setMat] = useState<number | null>(null);
  const [emb, setEmb] = useState<number | null>(null);
  const [horas, setHoras] = useState(1);
  const [margem, setMargem] = useState(15);
  const contasPorUnidade = p.vendasDoMes > 0 ? p.contasDoMes / p.vendasDoMes : 0;
  const taxa = p.taxaCredito ?? 0;
  const q = quantoCobrar({ materiais: lerReais(mat), embalagem: lerReais(emb), horas, salario: p.salario, horasPorMes: p.horasPorMes, contasPorUnidade, taxaPct: taxa, margemPct: margem });

  const passos = (
    <div className="flex gap-1.5 px-1" aria-label={`Passo ${passo} de 3`}>
      {[1, 2, 3].map((k) => (
        <i key={k} className={`h-1 flex-1 rounded-full ${k <= passo ? "bg-accent" : "bg-border-strong"}`} />
      ))}
    </div>
  );
  const itens = q
    ? [
        [p.materiais, lerReais(mat), "var(--color-accent)"],
        ["Seu tempo", q.tempo, "var(--color-info)"],
        ["Embalagem", lerReais(emb), "var(--color-success)"],
        ["Contas", q.contas, "var(--color-ink-muted)"],
        [taxa > 0 ? "Taxa e lucro" : "Lucro", q.taxaELucro, "var(--color-border-strong)"],
      ].filter(([, v]) => (v as number) > 0) as [string, number, string][]
    : [];

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-4">
      {passo === 1 ? <Voltar>{p.nome}</Voltar> : (
        <button type="button" onClick={() => setPasso(passo - 1)} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm text-ink-muted">
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden /> Quanto cobrar
        </button>
      )}
      {passos}

      {passo === 1 && (
        <>
          <h1 className="titulo-tema px-1 text-[1.75rem] font-medium leading-tight text-ink">O que vai <em className="not-italic text-accent-strong">no produto?</em></h1>
          <p className="-mt-2 px-1 text-sm text-ink-muted">{p.produto}</p>
          <Cartao className="px-4">
            <Campo rotulo={p.materiais} valor={mat} onMudar={setMat} />
            <Campo rotulo="Embalagem" valor={emb} onMudar={setEmb} />
          </Cartao>
          <div className="mt-auto">
            <button type="button" className={BOTAO_PRINCIPAL} disabled={lerReais(mat) + lerReais(emb) <= 0} onClick={() => setPasso(2)}>
              Próximo
            </button>
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <h1 className="titulo-tema px-1 text-[1.75rem] font-medium leading-tight text-ink">Quanto tempo <em className="not-italic text-accent-strong">leva?</em></h1>
          <div className="relative h-56 overflow-hidden rounded-3xl bg-surface-2">
            {p.foto && (
              // eslint-disable-next-line @next/next/no-img-element -- foto pequena do próprio app, em public/
              <img src={p.foto} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
            )}
            <span className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs text-white">{p.produto}</span>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-12 text-white">
              <button type="button" aria-label="Menos meia hora" onClick={() => setHoras((h) => Math.max(0.5, h - 0.5))} className="flex size-11 items-center justify-center rounded-full bg-white/90 text-black">
                <Minus size={20} aria-hidden />
              </button>
              <span className="text-center">
                <b className="block text-4xl font-light tabular-nums">{String(horas).replace(".", ",")} h</b>
                <small className="text-xs">do seu trabalho</small>
              </span>
              <button type="button" aria-label="Mais meia hora" onClick={() => setHoras((h) => Math.min(80, h + 0.5))} className="flex size-11 items-center justify-center rounded-full bg-white/90 text-black">
                <Plus size={20} aria-hidden />
              </button>
            </div>
          </div>
          <Cartao className="flex min-h-14 items-center justify-between gap-3 px-4">
            <span className="flex items-center gap-1 text-[15px] text-ink">
              Sua hora vale
              <Explica>{`O seu salário (${m0(p.salario)}) dividido por ${p.horasPorMes} horas de trabalho no mês. As horas mudam em Configurações da empresa.`}</Explica>
            </span>
            <b className="text-[17px] font-medium tabular-nums text-ink">{money(p.salario / p.horasPorMes)}</b>
          </Cartao>
          <div className="mt-auto">
            <button type="button" className={BOTAO_PRINCIPAL} onClick={() => setPasso(3)}>
              Próximo
            </button>
          </div>
        </>
      )}

      {passo === 3 && q && (
        <>
          <div className="flex justify-center py-4">
            <div className="relative -rotate-6 rounded-[18px_28px_28px_18px] bg-accent px-7 py-5 text-on-accent shadow-[0_18px_30px_-16px_rgba(0,0,0,0.35)]">
              <i className="absolute left-3 top-1/2 size-3 -translate-y-1/2 rounded-full bg-canvas" aria-hidden />
              <div className="pl-4">
                <small className="block text-xs font-semibold uppercase tracking-wider opacity-80">{p.produto}</small>
                <ValorDestaque texto={m0(q.preco)} />
                <span className="block text-sm opacity-80">preço mínimo</span>
              </div>
            </div>
          </div>
          <Cartao className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-3 flex-1 gap-0.5 overflow-hidden rounded-full">
                {itens.map(([t, v, c]) => (
                  <i key={t} style={{ flexGrow: v, background: c }} />
                ))}
              </div>
              <Explica>{`${taxa > 0 ? `Taxa do crédito ${taxa.toLocaleString("pt-BR")}% e lucro ${margem}%.` : `Lucro ${margem}%. Sem a taxa da maquininha: digite a sua em Configurações da empresa.`}${p.ehMei ? " Para o MEI, o imposto já está na guia fixa." : ""}`}</Explica>
            </div>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 min-[360px]:grid-cols-2">
              {itens.map(([t, v, c]) => (
                <span key={t} className="flex items-center gap-2 text-sm text-ink">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: c }} />
                  <span className="truncate">{t}</span>
                  <b className="ml-auto font-medium tabular-nums">{m0(v)}</b>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <small className="text-xs text-ink-muted">Lucro</small>
              {MARGENS.map((k) => (
                <Chip key={k} on={margem === k} onClick={() => setMargem(k)}>
                  {k}%
                </Chip>
              ))}
            </div>
          </Cartao>
          {p.pe !== null && q.preco > 0 && (
            <Cartao className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <small className="block text-xs text-ink-muted">Para pagar o mês</small>
                <b className="text-[15px] font-medium text-ink">vender {m0(p.pe)}</b>
              </span>
              <b className="text-lg font-medium tabular-nums text-ink">
                {Math.ceil(p.pe / q.preco)} {Math.ceil(p.pe / q.preco) === 1 ? "unidade" : "unidades"}
              </b>
            </Cartao>
          )}
          {p.taxaCredito === null && (
            <Link href="/empresa/configuracoes" className="text-center text-sm text-accent-strong">
              Digitar a taxa da maquininha
            </Link>
          )}
          <div className="mt-auto flex justify-center">
            <button type="button" onClick={() => { setPasso(1); setMat(null); setEmb(null); setHoras(1); }} className="min-h-11 px-3 text-sm text-ink-muted underline underline-offset-4">
              Calcular de novo
            </button>
          </div>
        </>
      )}
      {passo === 3 && !q && <Cartao className="px-5 py-6 text-sm text-ink-muted">Taxa e lucro somados passam de 100%. Diminua o lucro.</Cartao>}
    </div>
  );
}
