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
export function ConviteDaAssessoria({ estado: inicial, podeOcultar = true }: { estado: EstadoDaAssessoria; podeOcultar?: boolean }) {
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
