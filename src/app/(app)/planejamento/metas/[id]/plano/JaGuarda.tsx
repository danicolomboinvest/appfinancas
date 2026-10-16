import { Lock, PiggyBank } from "lucide-react";
import type { JaGuarda } from "@/lib/planning/plano-da-meta";
import { passosDoTrazer, quandoChegaComMenos } from "@/lib/planning/plano-da-meta-regua";

/**
 * "Você já guarda" (pedido da Dani, 16/10/2026: "eu junto R$ 550 por mês, mas não sei para que meta
 * você está considerando"): para onde já vai o que ela guarda, em mini cartões com a foto de cada
 * meta, e a régua "Trazer para esta meta" em cada uma que pode ceder. A Reserva com menos de 3
 * meses fica (regra da reserva). O que sobra sem meta já entra na conta desta meta.
 */
export function JaGuardaCartao({ j, trazer, onTrazer, hoje, m }: { j: JaGuarda; trazer: Record<string, number>; onTrazer: (id: string, valor: number) => void; hoje: Date; m: (v: number) => string }) {
  if (j.fontes.length === 0 && !(j.semMeta > 0)) return null;
  const curta = j.fontes.find((f) => f.travada === "reserva_curta");
  const media = j.fontes.find((f) => f.travada === "reserva_media");
  return (
    <div className="flex flex-col gap-2.5 rounded-[24px] border border-border bg-surface p-4" data-ja-guarda>
      <b className="text-[15px] font-semibold text-ink">
        Você já guarda <span className="tabular-nums">{m(j.total)}</span> por mês
      </b>
      {j.fontes.map((f) => {
        const t = trazer[f.id] ?? 0;
        const passos = passosDoTrazer(f.podeTrazer);
        const i = Math.max(0, passos.findIndex((v) => v === t));
        const pct = passos.length > 1 ? (i / (passos.length - 1)) * 100 : 0;
        const chega = t > 0 ? quandoChegaComMenos(f, t, hoje) : null;
        const idDaRegua = `trazer-${f.id.replace(/[^a-z0-9]/gi, "-")}`;
        return (
          <div key={f.id} className="flex flex-col gap-1.5 rounded-2xl bg-surface-2 p-2.5" data-fonte={f.id}>
            <div className="flex items-center gap-2.5">
              {f.foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto da meta (banco do app ou a dela, rota autenticada)
                <img src={f.foto} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
                  <PiggyBank size={18} />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-[14.5px] font-semibold text-ink">{f.nome}</b>
                <small className="text-[13px] tabular-nums text-ink-muted">
                  {t > 0 ? (
                    <>
                      {m(f.porMes)} para <b className="font-semibold text-ink">{m(f.porMes - t)}</b> por mês
                    </>
                  ) : (
                    <>{m(f.porMes)} por mês</>
                  )}
                </small>
              </span>
              {f.travada === "reserva_curta" && <Lock size={16} className="shrink-0 text-ink-muted" aria-label="Fica na reserva" />}
            </div>
            {f.podeTrazer > 0 && (
              <div className="flex flex-col gap-0.5">
                <label htmlFor={idDaRegua} className="text-[12.5px] font-bold text-ink-muted">
                  Trazer para esta meta
                </label>
                <input
                  id={idDaRegua}
                  type="range"
                  min={0}
                  max={passos.length - 1}
                  step={1}
                  value={i}
                  aria-valuetext={t > 0 ? `${m(t)} por mês vêm da ${f.nome}` : "nada"}
                  onChange={(e) => onTrazer(f.id, passos[Number(e.target.value)] ?? 0)}
                  className="regua-do-plano"
                  style={{ ["--p" as string]: `${pct}%` }}
                />
                <span className="text-[13.5px] font-medium tabular-nums text-ink">
                  {t > 0 ? (
                    <>
                      <b className="font-semibold">+{m(t)}</b> por mês para esta meta
                      {chega === "parada" ? ` · ${f.nome} fica parada` : chega ? ` · ${f.nome} passa para ${chega.texto}` : ""}
                    </>
                  ) : (
                    "Nada desta meta"
                  )}
                </span>
              </div>
            )}
          </div>
        );
      })}
      {curta && <p className="text-[13px] font-medium text-ink-muted">A Reserva fica: ela ainda está com menos de 3 meses.</p>}
      {media && <p className="text-[13px] font-medium text-ink-muted">Da Reserva sai no máximo {m(media.podeTrazer)}: ela ainda está com menos de 6 meses.</p>}
      {j.semMeta > 0 && (
        <p className="text-[13.5px] font-medium tabular-nums text-ink">
          {m(j.semMeta)} por mês sem meta <span className="font-normal text-ink-muted">· já contam para esta meta</span>
        </p>
      )}
    </div>
  );
}
