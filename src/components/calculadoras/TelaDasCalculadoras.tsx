"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Car, Home, Landmark, LineChart, Scale, X, type LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast-context";
import { fileirasDoMomento, MOMENTOS, type CartaoDeCalculadora, type IdDoMomento } from "@/lib/calculadoras/momentos";
import { deleteSimulationAction } from "@/app/(app)/simuladores/actions";
import { FOTO } from "./pecas";

export type SalvaNaLista = { id: string; tipo: string; nome: string; resumo: string; data: string };

const DO_TIPO: Record<string, { href: string; nome: string; Icone: LucideIcon }> = {
  FINANCIAR_VS_ALUGAR: { href: "/simuladores/financiar-vs-alugar", nome: "Financiar ou alugar?", Icone: Home },
  AMORTIZAR_VS_INVESTIR: { href: "/simuladores/amortizar-vs-investir", nome: "Quitar a dívida ou investir?", Icone: Landmark },
  CONSORCIO_VS_FINANCIAMENTO: { href: "/simuladores/consorcio", nome: "Consórcio ou financiamento?", Icone: Scale },
  MARCACAO_MERCADO: { href: "/simuladores/marcacao-mercado", nome: "Vender a renda fixa antes?", Icone: LineChart },
  CARRO: { href: "/simuladores/carro", nome: "Assinar ou comprar o carro?", Icone: Car },
};

function CartaoComFoto({ c, largo }: { c: CartaoDeCalculadora; largo: boolean }) {
  return (
    <Link
      href={c.href}
      aria-label={c.titulo}
      className={`relative isolate flex overflow-hidden rounded-3xl bg-surface-2 transition-transform active:scale-[0.99] ${largo ? "min-h-[9.5rem] sm:min-h-[11rem]" : "min-h-[8.25rem]"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FOTO(c.foto)} alt="" loading="lazy" decoding="async" className="absolute inset-0 -z-10 size-full object-cover" />
      <span className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.62),rgba(0,0,0,0.12)_58%,transparent)]" aria-hidden />
      <span className="mt-auto flex flex-col gap-0.5 p-3.5 text-white">
        <b className="text-[17px] font-medium leading-snug">{c.titulo}</b>
        {largo && c.sub && <small className="text-sm text-white/85">{c.sub}</small>}
      </span>
    </Link>
  );
}

/**
 * A tela das calculadoras (versão nova, 11/10/2026): "Qual é o seu momento?", o filtro em pílulas
 * que deslizam (a escolhida no centro, como as abas da Visão geral), os cartões com foto e, embaixo,
 * as simulações salvas.
 */
export function TelaDasCalculadoras({ salvas }: { salvas: SalvaNaLista[] }) {
  const [momento, setMomento] = useState<IdDoMomento>("tudo");
  const [escondidas, setEscondidas] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  const trilho = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const primeira = useRef(true);

  useEffect(() => {
    const el = refs.current[momento];
    const caixa = trilho.current;
    if (!el || !caixa) return;
    caixa.scrollTo({ left: Math.max(0, el.offsetLeft + el.offsetWidth / 2 - caixa.clientWidth / 2), behavior: primeira.current ? "auto" : "smooth" });
    primeira.current = false;
  }, [momento]);

  const apagar = (s: SalvaNaLista) => {
    setEscondidas((e) => new Set(e).add(s.id));
    let desfeito = false;
    showToast(`"${s.nome}" apagada`, {
      label: "Desfazer",
      onClick: () => {
        desfeito = true;
        setEscondidas((e) => {
          const n = new Set(e);
          n.delete(s.id);
          return n;
        });
      },
    });
    // Apaga de verdade só depois do tempo do "Desfazer".
    setTimeout(() => {
      if (!desfeito) void deleteSimulationAction(s.id);
    }, 6200);
  };

  const lista = salvas.filter((s) => !escondidas.has(s.id) && DO_TIPO[s.tipo]);
  const fileiras = fileirasDoMomento(momento);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <h1 className="titulo-tema text-[2rem] font-medium leading-tight tracking-tight text-ink">Qual é o seu momento?</h1>

      <nav aria-label="Filtrar pelo momento" className="-mx-5 md:mx-0">
        <div
          ref={trilho}
          role="tablist"
          aria-label="Momento"
          className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-[calc(50%-3rem)] py-1 [mask-image:linear-gradient(90deg,transparent_0,#000_14%,#000_86%,transparent_100%)] [scrollbar-width:none]"
          onKeyDown={(e) => {
            const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const i = MOMENTOS.findIndex((m) => m.id === momento);
            const prox = MOMENTOS[Math.max(0, Math.min(MOMENTOS.length - 1, i + d))];
            setMomento(prox.id);
            refs.current[prox.id]?.focus({ preventScroll: true });
          }}
        >
          {MOMENTOS.map((m) => {
            const on = m.id === momento;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  refs.current[m.id] = el;
                }}
                type="button"
                role="tab"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setMomento(m.id)}
                className={`flex h-10 shrink-0 snap-center items-center whitespace-nowrap rounded-full px-4 text-[15px] transition-colors ${
                  on ? "bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong),0_6px_14px_-8px_rgba(0,0,0,0.18)]" : "text-ink-muted hover:text-ink"
                }`}
              >
                {m.rotulo}
              </button>
            );
          })}
        </div>
      </nav>

      <div key={momento} className="flex animate-[passo-entra_0.32s_ease-out] flex-col gap-3">
        {fileiras.map((f, i) =>
          f.largo ? (
            <CartaoComFoto key={i} c={f.cartao} largo />
          ) : (
            <div key={i} className="grid grid-cols-2 gap-3">
              <CartaoComFoto c={f.cartoes[0]} largo={false} />
              <CartaoComFoto c={f.cartoes[1]} largo={false} />
            </div>
          ),
        )}
      </div>

      {lista.length > 0 && (
        <section className="flex flex-col gap-2.5 pt-2">
          <h2 className="titulo-tema text-lg font-medium text-ink">Suas simulações salvas</h2>
          <ul className="glass flex flex-col divide-y divide-border rounded-2xl">
            {lista.map((s) => {
              const t = DO_TIPO[s.tipo];
              return (
                <li key={s.id} className="flex items-center gap-1 pr-1.5">
                  <Link href={`${t.href}?s=${s.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                      <t.Icone size={18} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-medium text-ink">{s.nome || t.nome}</b>
                      <small className="block truncate text-caption text-ink-muted">{s.resumo}</small>
                    </span>
                    <em className="shrink-0 text-caption not-italic text-ink-muted">{s.data}</em>
                  </Link>
                  <button type="button" aria-label={`Apagar ${s.nome || t.nome}`} onClick={() => apagar(s)} className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface-2 hover:text-ink">
                    <X size={16} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
