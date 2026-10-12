"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, Briefcase, Clock3, X } from "lucide-react";
import { EQI_ABRIR_CONTA_URL } from "@/lib/eqi";
import { TEXTOS_DA_ASSESSORIA, type EstadoDaAssessoria } from "@/lib/assessoria/estado";
import { assessoriaAction, ocultarConviteDaAssessoriaAction } from "./carteira-nova-actions";

/**
 * O fim da Carteira (rodadas 59, 61 e 76): UM cartão pequeno, em estilo de lista agrupada, só com
 * a assessoria ("Trazer de outros bancos" saiu na rodada 61).
 *
 * - "Abrir minha conta" abre o cadastro da EQI pela Fatos Capital numa aba nova e NÃO muda nada
 *   no app (tocar não quer dizer que ela terminou).
 * - Ao lado, "Já abri minha conta" leva a "Estamos conferindo sua conta"; ali, "Ainda não abri"
 *   desfaz.
 * - Sem remuneração, sem custo, sem prazo e sem conversa com assessor para quem está abaixo da
 *   faixa: só abrir a conta. O x esconde o convite só para ela (`podeOcultar`).
 */
export function ConviteDaAssessoria({ estado: inicial, podeOcultar = true, destaque = false }: { estado: EstadoDaAssessoria; podeOcultar?: boolean; /** Oportunidades (protótipo): o cartão grande com os logos e o botão preto. */ destaque?: boolean }) {
  const [estado, setEstado] = useState(inicial);
  const [oculto, setOculto] = useState(false);
  const [pendente, startTransition] = useTransition();
  if (oculto || estado === "cliente") return null;
  const t = TEXTOS_DA_ASSESSORIA[estado];
  const conferindo = estado === "confirmando";

  const mudar = (acao: "ja_abri" | "ainda_nao") =>
    startTransition(async () => {
      const r = await assessoriaAction(acao);
      setEstado(r.estado === "confirmando" ? "confirmando" : "nao_cliente");
    });

  if (destaque)
    return (
      <section aria-label="Conta na Fatos Capital" className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-5 py-6 text-center" aria-busy={pendente} data-convite-destaque>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo da parceria */}
        <img src="/logos/fatos-eqi.png" alt="Fatos Capital | EQI" className="h-8 w-auto [.dark_&]:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element -- logo da parceria (escuro) */}
        <img src="/logos/fatos-eqi-branco.png" alt="Fatos Capital | EQI" className="hidden h-8 w-auto [.dark_&]:block" />
        <b className="text-[17px] font-medium text-ink">{conferindo ? t.titulo : "Feito para quem investe comigo"}</b>
        {conferindo && <p className="text-[14px] text-ink-muted">{t.apoio}</p>}
        {t.botao && !conferindo && (
          <a href={EQI_ABRIR_CONTA_URL} target="_blank" rel="noopener" className="flex min-h-12 w-full items-center justify-center rounded-full bg-ink text-[15px] font-medium text-canvas">
            Abrir minha conta
          </a>
        )}
        {t.secundario && (
          <button type="button" disabled={pendente} onClick={() => mudar(conferindo ? "ainda_nao" : "ja_abri")} className="min-h-11 text-[14px] text-ink-muted underline underline-offset-4 disabled:opacity-50">
            {t.secundario}
          </button>
        )}
        <p className="text-xs text-ink-faint">Fatos Capital, AI contratado EQI. A Dani é sócia.</p>
      </section>
    );

  return (
    <section aria-label="Conta na Fatos Capital" className="glass rounded-2xl px-4 py-3.5" aria-busy={pendente}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-muted" aria-hidden>
          {conferindo ? <Clock3 size={18} strokeWidth={1.7} /> : <Briefcase size={18} strokeWidth={1.7} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug text-ink">{t.titulo}</span>
          <span className="mt-0.5 block text-[13px] text-ink-muted">{t.apoio}</span>
        </span>
        {podeOcultar && !conferindo && (
          <button
            type="button"
            onClick={() => {
              setOculto(true);
              void ocultarConviteDaAssessoriaAction();
            }}
            aria-label="Ocultar o convite da Fatos Capital"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2.5 pl-12">
        {t.botao && (
          <a
            href={EQI_ABRIR_CONTA_URL}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center gap-1 text-[14px] font-medium text-accent-strong underline-offset-2 hover:underline"
          >
            {t.botao}
            <ArrowUpRight size={15} aria-hidden />
          </a>
        )}
        {t.secundario && (
          <button
            type="button"
            disabled={pendente}
            onClick={() => mudar(conferindo ? "ainda_nao" : "ja_abri")}
            className="inline-flex min-h-11 items-center text-[14px] text-ink-muted underline decoration-[color-mix(in_srgb,currentColor_40%,transparent)] underline-offset-[3px] transition-colors hover:text-ink disabled:opacity-50"
          >
            {t.secundario}
          </button>
        )}
      </div>
    </section>
  );
}
