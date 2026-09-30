"use client";

import { AlertTriangle, Check, Copy, Download, FileText, Layers, ListChecks, PiggyBank, Plus, Rocket, ShoppingBag, Target, Undo2, Users, Wallet, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { SECOES_DO_MANUAL, comNomes, type BlocoDoManual, type IconeDoManual, type NomesDoTema } from "@/lib/manual/conteudo";

const ICONES: Record<IconeDoManual, LucideIcon> = {
  rocket: Rocket,
  file: FileText,
  cards: Layers,
  copy: Copy,
  check: ListChecks,
  undo: Undo2,
  plus: Plus,
  wallet: Wallet,
  target: Target,
  piggy: PiggyBank,
  bag: ShoppingBag,
  users: Users,
  alert: AlertTriangle,
};

/** O arquivo em public/: gerado por scripts/gerar-manual-pdf.tsx a partir do mesmo conteúdo. */
export const PDF_DO_MANUAL = "/manual-spi-finance.pdf";

/**
 * O manual, com os nomes que ESTE tema usa: quem está no Girly lê "Combinado", e não
 * "Orçamento", porque é isso que a aba dela diz.
 */
export function ManualDoApp() {
  const { voz, empresa } = useProfileTheme();
  const nomes: NomesDoTema = {
    foco: voz.nav.foco ?? "Foco",
    mensal: voz.nav.flowTabs[0],
    orcamento: voz.nav.flowTabs[2],
    metas: voz.nav.metas,
    carteira: voz.nav.carteira ?? "Carteira",
    guardar: voz.titulos.uiTipoAporte,
  };
  const n = (t: string) => comNomes(t, nomes);
  const secoes = SECOES_DO_MANUAL.filter((s) => !(empresa && s.soPessoa));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Como usar o SPI Finance" subtitle="As regras que fazem os seus números baterem. Leitura de 5 minutos." />

      <a
        href={PDF_DO_MANUAL}
        download
        className="inline-flex items-center justify-center gap-2 self-start rounded-full bg-pill px-4 py-2.5 text-sm font-semibold text-on-pill"
      >
        <Download size={16} aria-hidden />
        Baixar o manual em PDF
      </a>

      {/* Índice: no celular rola de lado; cada item pula pra seção. */}
      <nav aria-label="Seções do manual" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ol className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {secoes.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1.5 text-caption font-medium text-ink-muted hover:text-ink">
                <span className="tabular-nums text-accent-strong">{i + 1}</span>
                {n(s.titulo)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {secoes.map((s, i) => {
        const Icone = ICONES[s.icone];
        return (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                  <Icone size={22} strokeWidth={1.8} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-faint">Parte {i + 1}</p>
                  <h2 className="text-lg font-semibold leading-snug text-ink">{n(s.titulo)}</h2>
                  <p className="mt-0.5 text-sm text-ink-muted">{n(s.resumo)}</p>
                </div>
              </div>
              {s.blocos.map((b, j) => (
                <Bloco key={j} bloco={b} n={n} />
              ))}
            </Card>
          </section>
        );
      })}

      <Card className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm font-semibold text-ink">Ficou alguma dúvida?</p>
        <p className="text-sm text-ink-muted">Guarde o PDF pra consultar quando for subir um arquivo novo.</p>
        <a href={PDF_DO_MANUAL} download className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink">
          <Download size={16} aria-hidden />
          Baixar em PDF
        </a>
      </Card>
    </div>
  );
}

function Bloco({ bloco, n }: { bloco: BlocoDoManual; n: (t: string) => string }) {
  if (bloco.tipo === "passos") {
    return (
      <ol className="flex flex-col gap-3">
        {bloco.itens.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pill text-sm font-bold tabular-nums text-on-pill">{i + 1}</span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm font-semibold text-ink">{n(p.titulo)}</span>
              <span className="block text-sm text-ink-muted">{n(p.texto)}</span>
            </span>
          </li>
        ))}
      </ol>
    );
  }
  if (bloco.tipo === "comparacao") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bloco.colunas.map((c) => (
          <div key={c.titulo} className="rounded-2xl border border-border bg-surface-2 p-4">
            <p className="text-base font-bold text-ink">{c.titulo}</p>
            <p className="text-caption text-ink-muted">{c.subtitulo}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {c.itens.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm text-ink">
                  <Check size={16} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
                  <span>{n(t)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (bloco.tipo === "regras") {
    return (
      <ul className="flex flex-col gap-2.5">
        {bloco.itens.map((r, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-ink">
            {r.atencao ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden /> : <Check size={16} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />}
            <span>{n(r.texto)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className={`flex gap-2.5 rounded-2xl px-4 py-3 text-sm ${bloco.alerta ? "bg-danger-soft text-ink" : "bg-accent-soft text-ink"}`}>
      {bloco.alerta ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden /> : <Check size={16} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />}
      <span>{n(bloco.texto)}</span>
    </p>
  );
}
