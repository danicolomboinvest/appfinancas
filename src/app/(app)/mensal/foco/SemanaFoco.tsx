import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { NumeroRolante } from "@/components/ui/NumeroRolante";
import { NUMERO_DESTAQUE, ValorDestaque } from "@/components/ui/ValorDestaque";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import type { Ritmo } from "@/lib/profiles/voice-base";
import { diaDaSemana } from "@/lib/decisoes/foco-semana";
import type { SemanaFixa } from "@/lib/decisoes/semana-fixa";

const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

/** A régua dos dias: hoje na cor do ritmo; no ritmo, a cor da marca do tema. */
const HOJE: Record<Ritmo, string> = { dentro: "bg-[var(--color-heroi-tinta)]", limite: "bg-[var(--color-heroi-destaque)]", rapido: "bg-danger" };

/**
 * O topo do Resumo: "quanto dá para gastar nesta semana" (regra A, 13/10/2026). O valor da semana
 * é fixo de segunda a domingo; o número grande é o que ainda cabe nele, e embaixo "de R$ 480 da
 * semana · já saíram R$ 130". Passou: "Passou da semana R$ 60", com a próxima semana já ajustada.
 * Nunca só R$ 0.
 *
 * Os 7 tracinhos são a semana (o de hoje aceso). Dia da semana que já é de outro mês fica apagado:
 * na quinta, dia 1, a semana deste mês tem 4 dias.
 *
 * A conta inteira abre ao tocar no cartão (ver ContaDoLivre e ComoChegamos).
 */
export function SemanaFoco({
  rotulo,
  semana,
  estimativa,
  guardar,
  fimDoMes,
  hoje,
  ritmo,
  frase,
  money,
  rotulos,
  children,
}: {
  rotulo: string;
  semana: SemanaFixa;
  /** Mês ainda sem lançamento (quem fecha por mês): o número é o do plano. */
  estimativa: boolean;
  /** O guardar do mês que já saiu da conta (só quando a renda entra na conta). */
  guardar: number | null;
  /** Como o mês fecha (previsão), para o segundo quadrinho quando não há guardar. Null: some. */
  fimDoMes: number | null;
  hoje: Date;
  ritmo: Ritmo;
  frase: string;
  money: (v: number) => string;
  /** "Por dia" e "Fim do mês", na voz do tema. */
  rotulos: { porDia: string; fimDoMes: string; comoChegamos: string };
  children?: ReactNode;
}) {
  const { indice } = diaDaSemana(hoje);
  const passou = semana.passou >= 1;
  // O mês do dia a dia já tinha acabado antes desta semana: o valor da semana é zero.
  const semValor = !passou && semana.valor < 1;
  const ate = semana.acabaNoDomingo ? "até domingo" : `até dia ${semana.fim}`;
  // Os dias da semana que caem neste mês, de segunda (0) a domingo (6).
  const primeiro = indice - (hoje.getDate() - semana.inicio);
  const ultimo = indice + (semana.fim - hoje.getDate());

  const quadro = (titulo: string, valor: string, numero = true) => (
    <div className="vidro-heroi min-w-0 rounded-2xl px-3.5 py-3">
      <p className="text-caption text-heroi-suave">{titulo}</p>
      {numero ? <ValorDestaque texto={valor} className="mt-0.5 text-[1.25rem] font-normal tabular-nums" /> : <p className="mt-0.5 text-[1.25rem] font-normal leading-none">{valor}</p>}
    </div>
  );

  return (
    <HeroiDoTema>
      <div className="flex flex-wrap items-center gap-2">
        {passou ? (
          <span className="rounded-full bg-[var(--color-atencao-fundo)] px-2.5 py-0.5 text-[13px] font-semibold text-[var(--color-atencao)]">Passou da semana</span>
        ) : (
          <p className="text-[15px] text-heroi-suave">{rotulo}</p>
        )}
        <span className="sr-only">. {frase}</span>
      </div>
      <NumeroRolante texto={money(passou ? semana.passou : Math.max(0, semana.restante))} className={NUMERO_DESTAQUE} />
      <p className="-mt-1 text-caption text-heroi-suave" data-semana-sub>
        {estimativa
          ? `${money(semana.valor)} da semana, pelo seu plano`
          : passou
            ? `saíram ${money(semana.gasto)} de ${money(semana.valor)}${guardar ? " · o guardar continua intacto" : ""}`
            : semValor
              ? semana.sobraDoMes <= -1
                ? `o dia a dia do mês passou ${money(-semana.sobraDoMes)}`
                : "o dia a dia do mês já foi todo"
              : `de ${money(semana.valor)} da semana · já saíram ${money(semana.gasto)}`}
      </p>

      <div className="flex flex-col gap-1.5" aria-label={`Hoje é o dia ${indice + 1} de 7 da semana`}>
        <div className="flex gap-1.5">
          {DIAS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i < primeiro || i > ultimo
                  ? "bg-[color-mix(in_srgb,var(--color-surface)_30%,transparent)]"
                  : i < indice
                    ? "bg-[color-mix(in_srgb,var(--color-heroi-tinta)_32%,transparent)]"
                    : i === indice
                      ? HOJE[passou ? "rapido" : ritmo]
                      : "bg-[color-mix(in_srgb,var(--color-surface)_75%,transparent)]"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-1.5 text-xs text-heroi-suave">
          {DIAS.map((l, i) => (
            <span key={i} className={`flex-1 text-center ${i === indice ? "font-semibold text-heroi-tinta" : ""} ${i < primeiro || i > ultimo ? "opacity-40" : ""}`}>
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {passou || semValor ? (
          <>
            {semana.proxima !== null ? quadro("Próxima semana", money(semana.proxima)) : quadro("Mês que vem", "Recomeça", false)}
            {quadro(semana.acabaNoDomingo ? "Até domingo" : `Até dia ${semana.fim}`, "Segurar", false)}
          </>
        ) : (
          <>
            {quadro(`${rotulos.porDia} ${ate}`, money(semana.porDia))}
            {guardar ? quadro("Guardar, já separado", money(guardar)) : fimDoMes !== null ? quadro(rotulos.fimDoMes, `${fimDoMes >= 0 ? "+" : "−"}${money(Math.abs(fimDoMes))}`) : null}
          </>
        )}
      </div>
      {children}
      <span className="flex items-center justify-between gap-3 border-t border-[color-mix(in_srgb,var(--color-heroi-tinta)_12%,transparent)] pt-3 text-[14px]">
        <span className="font-medium">{rotulos.comoChegamos}</span>
        <span className="inline-flex items-center gap-0.5 text-heroi-suave">
          Ver <ChevronRight size={15} aria-hidden />
        </span>
      </span>
    </HeroiDoTema>
  );
}
