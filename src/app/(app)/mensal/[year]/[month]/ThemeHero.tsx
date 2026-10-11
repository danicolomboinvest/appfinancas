import Link from "next/link";
import type { DadosDoTema } from "./theme-hero-data";
import type { Money } from "@/lib/profiles/voice";

/**
 * O bloco que só existe naquele tema, no alto da tela do mês.
 *
 * Desde a versão nova (11/10/2026) só o Manifestação tem bloco próprio: o mural de sonhos.
 * Padrão, Girly e Titânio falam pela cor, pela letra e pela frase.
 *
 * Tudo aqui é calculado de dado que já existe (ver theme-hero-data.ts).
 */
export function ThemeHero({ dados, money }: { dados: DadosDoTema; money: Money; mesLabel?: string }) {
  if (dados.tema === "manifestacao") return <HeroManifestacao dados={dados} money={money} />;
  return null;
}

/* ---------------------------------------------------------- Manifestação */

const GRADIENTES = [
  "linear-gradient(160deg, #cdb6e4, #8f6fb8)",
  "linear-gradient(160deg, #f0cfd8, #c78fa4)",
  "linear-gradient(160deg, #cfe0d8, #8fae9f)",
];

function HeroManifestacao({ dados, money }: { dados: DadosDoTema; money: Money }) {
  const { sonhos, metaEmAndamento, maisPerto } = dados;
  if (sonhos.length === 0) {
    return (
      <Link href="/planejamento/metas" className="block rounded-2xl border border-dashed border-border-strong px-4 py-4 text-sm text-ink-muted transition-colors hover:border-accent hover:text-ink">
        <span className="block text-caption font-semibold text-ink-faint">Sua vida dos sonhos</span>
        <span className="mt-1 block">Comece pelo primeiro sonho: uma meta com nome, valor e data. <span className="font-medium text-accent-strong">Criar →</span></span>
      </Link>
    );
  }
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <p className="text-caption font-semibold text-ink-faint">Sua vida dos sonhos</p>
        {/* Grade de três sempre: com uma meta só, o tile ocupa um terço e não vira um bloco
            roxo do tamanho da tela. Os vazios convidam a criar o próximo sonho. */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {sonhos.map((s, i) => (
            <Link
              key={s.nome}
              href="/planejamento/metas"
              className="flex min-h-24 min-w-0 flex-col justify-end rounded-xl p-2.5 text-white"
              style={{ background: GRADIENTES[i % GRADIENTES.length] }}
            >
              {/* O nome inteiro, quebrando a linha (cortava "Reserva de em..." de 320 a 430 px). */}
              <span className="break-words text-[11px] font-semibold leading-tight drop-shadow [hyphens:auto]" lang="pt-BR">{s.nome}</span>
              <span className="text-[11px] opacity-90">{s.pct}%</span>
            </Link>
          ))}
          {sonhos.length < 3 && (
            <Link
              href="/planejamento/metas"
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong text-caption text-ink-faint transition-colors hover:border-accent hover:text-ink"
            >
              <span className="text-lg leading-none">+</span>
              <span>sonho</span>
            </Link>
          )}
        </div>
        <p className="mt-2.5 text-caption text-ink-faint">Uma por meta. O mural é seu.</p>
      </section>

      {metaEmAndamento && (
        <Link href="/planejamento/metas" className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong sm:p-5">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{metaEmAndamento.nome}</span>
              <span className="block text-caption text-ink-faint">
                {metaEmAndamento.prazo ? `${metaEmAndamento.prazo}, ` : ""}{money(metaEmAndamento.alvo, { round: true })}
              </span>
            </span>
            <span className="text-base font-semibold tabular-nums text-ink">{metaEmAndamento.pct}%</span>
          </div>
          <div className="relative mt-3 h-2.5 rounded-full bg-surface-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${metaEmAndamento.pct}%` }} />
          </div>
          <p className="mt-2.5 text-sm text-ink">
            {maisPerto > 0 ? (
              <>Você ficou <b>{money(maisPerto, { round: true })} mais perto</b> de {metaEmAndamento.nome.toLowerCase()} este mês.</>
            ) : (
              <>Cada aporte ligado a esta meta aparece aqui.</>
            )}
          </p>
        </Link>
      )}
    </div>
  );
}
