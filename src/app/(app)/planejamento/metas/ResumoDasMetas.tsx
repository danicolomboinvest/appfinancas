import { ChevronRight } from "lucide-react";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { Explica } from "@/components/ui/Explica";
import { Anel } from "./Anel";
import { IrParaAMeta } from "./FileiraDeFotos";
import type { JeitoDasMetas } from "./visual";

/**
 * O topo de Metas (protótipo #metas, adendo da rodada 12): o anel de todas juntas, o guardado,
 * de quanto, quanto vai por mês, e a "Próxima a chegar" com a foto (tocar leva ao cartão).
 */
export function ResumoDasMetas({
  guardado,
  alvo,
  porMes,
  proxima,
  jeito,
  money,
}: {
  guardado: number;
  alvo: number;
  porMes: number;
  proxima: { id: string; nome: string; foto: string; quando: string } | null;
  jeito: JeitoDasMetas;
  money: (v: number) => string;
}) {
  const pct = alvo > 0 ? Math.round((guardado / alvo) * 100) : 0;
  const rotulo = <span className="text-[14px] text-heroi-suave">Guardado nas metas</span>;
  return (
    <HeroiDoTema className="relative !rounded-[28px] !p-4 !pb-3.5">
      <span className="absolute right-3.5 top-3.5">
        <Explica noHeroi>
          Somo o que já está guardado em todas as metas e o quanto vai por mês para elas. O anel é o caminho de todas juntas. A próxima a chegar é a que, no ritmo de hoje, termina primeiro. Toque numa foto para ir direto à meta.
        </Explica>
      </span>
      {jeito.rotuloNoTopo && <div className="-mb-1 pr-8">{rotulo}</div>}
      <div className="flex items-center gap-4 pr-7">
        <Anel pct={pct} tamanho={76} espessura={8} textoClasse="text-[17px] font-semibold text-heroi-tinta" rotulo={`${pct}% de todas as metas`} trilho="color-mix(in srgb, var(--color-heroi-tinta) 13%, transparent)" />
        <div className="flex min-w-0 flex-col gap-0.5">
          {!jeito.rotuloNoTopo && rotulo}
          <ValorDestaque texto={money(guardado)} className="text-[30px] font-light leading-[1.05] tracking-[-0.03em] tabular-nums max-[359px]:text-[26px]" />
          {jeito.resumoNumaLinha ? (
            <span className="text-[13px] font-medium text-heroi-suave">
              de {money(alvo)} · <b className="font-semibold text-heroi-tinta">{money(porMes)}</b> por mês
            </span>
          ) : (
            <>
              <span className="text-[13px] font-medium text-heroi-suave">de {money(alvo)}</span>
              <span className="mt-1 text-[12.5px] font-medium text-heroi-suave">{money(porMes)} por mês</span>
            </>
          )}
        </div>
      </div>
      {proxima && (
        <IrParaAMeta id={proxima.id} className="vidro-heroi flex w-full items-center gap-2.5 rounded-2xl py-2 pl-2 pr-3 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto da meta */}
          <img src={proxima.foto} alt="" decoding="async" className="size-10 shrink-0 rounded-xl object-cover" />
          <span className="flex min-w-0 flex-1 flex-col">
            <small className="text-xs font-medium text-heroi-suave">Próxima a chegar</small>
            <b className="truncate text-[15px] font-semibold">
              {proxima.nome} · {proxima.quando}
            </b>
          </span>
          <ChevronRight size={16} className="shrink-0" aria-hidden />
        </IrParaAMeta>
      )}
    </HeroiDoTema>
  );
}
