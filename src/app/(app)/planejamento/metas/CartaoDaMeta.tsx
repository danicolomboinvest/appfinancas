import Link from "next/link";
import type { MetaDaTela } from "@/lib/repositories/metas.repo";
import { mesDaqui } from "@/lib/metas/projecao";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Anel } from "./Anel";
import type { JeitoDasMetas, SeloDaMeta } from "./visual";

/**
 * O cartão de uma meta na lista (protótipo #metas): a foto com o nome e o selo, e embaixo quanto
 * já tem, de quanto, e quanto vai por mês. Atrasada fala o que precisa ("precisa R$ 1.340 por
 * mês"); as outras, o combinado. Tocar abre o detalhe.
 */
export function CartaoDaMeta({ meta, jeito, hoje, money, selo: oSelo }: { meta: MetaDaTela; jeito: JeitoDasMetas; hoje: Date; money: (v: number) => string; selo: SeloDaMeta }) {
  const { plano } = meta;
  const atras = plano.status === "BEHIND";
  // Um selo só (visual.ts, seloDaMeta). O "Prazo apertado" é um botão por cima da foto (abre o
  // prazo que cabe), então aqui não sai mais nada.
  const selo = oSelo.tipo === "prazo-apertado" ? null : oSelo.texto;
  const porMes = atras ? (
    <>
      precisa <span className="whitespace-nowrap">{money(plano.porMesNecessario)}</span> por mês
    </>
  ) : (
    <>
      <span className="whitespace-nowrap">{money(meta.combinado)}</span> por mês
    </>
  );
  const chegada = plano.status === "ACHIEVED" ? "chegou" : plano.chega !== null ? `${atras ? "prevista " : ""}${mesDaqui(hoje, plano.chega).texto}` : null;

  return (
    <Link id={`meta-${meta.id}`} href={`/planejamento/metas/${meta.id}`} className="block scroll-mt-4 overflow-hidden rounded-[28px] border border-border bg-surface shadow-premium-sm">
      <div className={`mt-cena ${jeito.anelNaFoto ? "flex-col !items-stretch !justify-between" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- foto do banco do app ou a da pessoa (rota autenticada) */}
        <img src={meta.foto} alt="" loading="lazy" decoding="async" />
        {jeito.anelNaFoto ? (
          <>
            {/* À direita fica o "…" do cartão (MenuDaMeta): o selo vem logo antes dele. */}
            <span className="flex justify-end pr-12">
              {selo && <span className={`mt-selo ${atras ? "atras" : ""}`}>{selo}</span>}
            </span>
            <span className="flex items-end justify-between gap-3">
              <b className="mt-cena-nome">{meta.nome}</b>
              <Anel pct={plano.pct} tamanho={46} espessura={4} naFoto textoClasse="text-xs font-semibold" />
            </span>
          </>
        ) : (
          <>
            <b className="mt-cena-nome">{meta.nome}</b>
            {selo && <span className={`mt-selo ${atras ? "atras" : ""}`}>{selo}</span>}
          </>
        )}
      </div>

      {jeito.anelNaFoto ? (
        <div className="flex flex-col gap-2.5 px-5 pb-[18px] pt-4">
          <div className="flex items-baseline justify-between gap-3">
            <ValorDestaque texto={money(meta.guardado)} className="text-[28px] font-normal leading-none tracking-[-0.025em] tabular-nums text-ink" />
            <span className="text-[13px] font-medium text-ink-muted">de {money(meta.alvo)}</span>
          </div>
          {jeito.barraEChegada && (
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className={`h-full rounded-full ${atras ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.min(100, Math.max(plano.pct, 2))}%` }} />
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 text-[13px] font-medium text-ink-muted">
            <span>{porMes}</span>
            {jeito.barraEChegada && chegada && (
              <span className="text-right">
                {chegada} · {plano.pct}%
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3.5 px-[18px] pb-[18px] pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <ValorDestaque texto={money(meta.guardado)} className="text-[28px] font-medium leading-none tracking-[-0.025em] tabular-nums text-ink" />
              <span className="text-[13px] font-medium text-ink-muted">de {money(meta.alvo)}</span>
            </div>
            <span className="text-[13px] font-medium text-ink-muted">{porMes}</span>
          </div>
          <Anel pct={plano.pct} tamanho={58} espessura={6} atras={atras} />
        </div>
      )}
    </Link>
  );
}
