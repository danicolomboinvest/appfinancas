import Link from "next/link";
import { BookOpen, Check, Lock } from "lucide-react";
import { MARCOS, SEMANAS } from "@/lib/money-reset/missoes";
import type { StatusDoMarco } from "@/lib/money-reset/progresso";
import { IconeDoMarco } from "./IconeDoMarco";

/**
 * O mapa dos 21 marcos (proposta A+B): 3 regiões, uma por semana, com a trilha tracejada em zigue-
 * zague e um desenho por marco (sem número solto: o número vai no nome, para o leitor de tela, e no
 * cartão de agora). O feito vira um check verde, o de agora pulsa, os da frente ficam claros. As semanas que ainda não abriram ficam na névoa, com "Abre quando você chegar lá".
 *
 * Sem hooks: serve à página do mapa (servidor) e à tela "o app reage" (cliente), em tamanho mini.
 */
const YS = [28, 72, 28, 72, 28, 72, 28];
const XS = Array.from({ length: 7 }, (_, i) => ((i + 0.5) / 7) * 100);
const TRILHA = (() => {
  let d = `M${XS[0]},${YS[0]}`;
  for (let i = 1; i < 7; i++) {
    const mx = (XS[i - 1] + XS[i]) / 2;
    d += ` C${mx},${YS[i - 1]} ${mx},${YS[i]} ${XS[i]},${YS[i]}`;
  }
  return d;
})();

export function MapaDoReset({
  status,
  semana,
  titulos,
  admin = false,
  mini = false,
  historias = false,
}: {
  status: Record<number, StatusDoMarco>;
  /** A semana em que a pessoa está: as seguintes ficam na névoa. */
  semana: 1 | 2 | 3;
  /** O título de cada marco, já no tema (índice = marco - 1), para o leitor de tela. */
  titulos: string[];
  admin?: boolean;
  mini?: boolean;
  /** Mostra o atalho "História" nas semanas abertas. */
  historias?: boolean;
}) {
  const tam = mini ? 24 : 36;
  // Só a primeira semana na névoa leva o aviso (as outras ficam só embaçadas).
  const primeiraFechada = semana < 3 ? semana + 1 : null;
  return (
    <div className={`flex flex-col ${mini ? "gap-1.5" : "gap-2"}`}>
      {SEMANAS.map((s) => {
        const fechada = s.n > semana;
        const rotulo = s.n === primeiraFechada;
        return (
          <section key={s.n} className={`relative rounded-2xl bg-surface-2 ${mini ? "px-2 pb-1 pt-1.5" : "px-2.5 pb-1.5 pt-2.5"}`} aria-label={`Semana ${s.n}, ${s.nome}`}>
            <div className={fechada ? "mr-nevoa" : ""}>
              <div className="flex items-center justify-between gap-2 px-1">
                <p className={`text-[12px] font-bold uppercase tracking-[0.1em] text-ink-muted`}>
                  <b className={s.n === semana ? "text-accent-strong" : ""}>Semana {s.n}</b> · {s.nome}
                </p>
                {historias && !fechada && !mini && (
                  <Link href={`/money-reset/semana/${s.n}`} className="-my-2 inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-accent-strong" aria-label={`Ver a história da semana ${s.n}: ${s.historia}`}>
                    <BookOpen size={13} aria-hidden /> História
                  </Link>
                )}
              </div>
              <div className="relative" style={{ height: mini ? 46 : 78 }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="mr-trilha absolute inset-0 size-full overflow-visible">
                  <path d={TRILHA} />
                </svg>
                {MARCOS.filter((m) => m.semana === s.n).map((m, i) => {
                  const st = status[m.n] ?? "fechado";
                  const abre = !fechada && (st !== "fechado" || admin);
                  const estilo = { left: `${XS[i]}%`, top: `${YS[i]}%`, width: tam, height: tam, marginLeft: -tam / 2, marginTop: -tam / 2 };
                  const cor =
                    st === "feito"
                      ? "bg-success-soft text-success"
                      : st === "agora"
                        ? "bg-accent-gradient text-on-accent mr-agora"
                        : `border-[1.5px] bg-surface text-ink-muted ${m.n === 21 ? "border-dashed border-border-strong" : "border-border"}`;
                  const miolo = (
                    <>
                      {st === "feito" ? <Check size={mini ? 12 : 17} strokeWidth={3} aria-hidden /> : <IconeDoMarco icone={m.icone} size={mini ? 11 : 16} />}
                    </>
                  );
                  const nome = `Missão ${m.n}: ${titulos[m.n - 1] ?? m.t}${st === "feito" ? ", feita" : st === "agora" ? ", agora" : ""}`;
                  const classe = `absolute flex items-center justify-center rounded-full ${cor}`;
                  return abre && !mini ? (
                    <Link key={m.n} href={`/money-reset/dia/${m.n}`} className={classe} style={estilo} aria-label={nome}>
                      {miolo}
                    </Link>
                  ) : (
                    <span key={m.n} className={classe} style={estilo} aria-label={mini ? undefined : nome} role={mini ? undefined : "img"}>
                      {miolo}
                    </span>
                  );
                })}
              </div>
            </div>
            {rotulo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 font-semibold text-ink ${mini ? "text-[12px]" : "text-[13px]"}`}>
                  <Lock size={mini ? 11 : 13} aria-hidden /> Abre quando você chegar lá
                </span>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
