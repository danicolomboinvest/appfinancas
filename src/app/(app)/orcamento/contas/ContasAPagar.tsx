"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { Modal } from "@/components/ui/Modal";
import { lerData, situacao } from "@/lib/contas/contas";
import { desfazerPagamentoAction } from "./actions";
import { FormDaConta } from "./FormDaConta";
import { diaMes, LinhaDaConta, type ContaSerial } from "./LinhaDaConta";

type Editando = { conta?: ContaSerial } | null;

/** A tela das contas a pagar: atrasadas, próximos 7 dias, mais adiante e as pagas há pouco. */
export function ContasAPagar({ contas, pagas, hoje, abrirNova }: { contas: ContaSerial[]; pagas: ContaSerial[]; hoje: string; abrirNova: boolean }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const router = useRouter();
  const [editando, setEditando] = useState<Editando>(abrirNova ? {} : null);
  const [, startTransition] = useTransition();

  const hojeD = lerData(hoje)!;
  const grupos = { atrasadas: [] as ContaSerial[], semana: [] as ContaSerial[], depois: [] as ContaSerial[] };
  for (const c of contas) {
    const s = situacao(lerData(c.vencimento)!, hojeD);
    (s === "atrasada" ? grupos.atrasadas : s === "depois" ? grupos.depois : grupos.semana).push(c);
  }
  const totalSemana = grupos.semana.reduce((s, c) => s + (c.valor ?? 0), 0) + grupos.atrasadas.reduce((s, c) => s + (c.valor ?? 0), 0);

  const fechar = () => {
    setEditando(null);
    // Quem chegou pelo "+" com ?nova=1 não pode ver o formulário de novo ao atualizar a tela.
    if (abrirNova) router.replace("/orcamento/contas");
  };

  const grupo = (titulo: string, lista: ContaSerial[], destaque?: boolean) =>
    lista.length > 0 && (
      <section className="flex flex-col">
        <h2 className={`px-1 text-caption font-semibold uppercase tracking-[0.11em] ${destaque ? "text-danger" : "text-ink-muted"}`}>{titulo}</h2>
        <ul className="mt-1 divide-y divide-border rounded-2xl border border-border bg-surface px-3">
          {lista.map((c) => (
            <LinhaDaConta key={c.id} conta={c} hoje={hoje} onAbrir={() => setEditando({ conta: c })} />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 font-bold tracking-tight text-ink">{t.contasTitulo}</h1>
          <p className="mt-1.5 text-body text-ink-muted">{t.contasSub}</p>
        </div>
        {contas.length > 0 && (
          <button
            type="button"
            onClick={() => setEditando({})}
            aria-label={t.contasNova}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-gradient text-on-accent shadow-premium-sm active:scale-95"
          >
            <Plus size={20} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {contas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <CalendarClock size={26} strokeWidth={1.75} />
          </span>
          <p className="text-body font-semibold text-ink">{t.contasVazio}</p>
          <p className="max-w-xs text-caption text-ink-muted">{t.contasVazioSub}</p>
          <button
            type="button"
            onClick={() => setEditando({})}
            className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-gradient px-5 text-sm font-semibold text-on-accent shadow-premium-sm"
          >
            <Plus size={16} aria-hidden /> {t.contasNova}
          </button>
        </div>
      ) : (
        <>
          {totalSemana > 0 && (
            <p className="-mt-2 px-1 text-caption text-ink-muted">{t.contasTotalSemana(money(totalSemana))}</p>
          )}
          {grupo(t.contasGrupoAtrasadas, grupos.atrasadas, true)}
          {grupo(t.contasGrupoSemana, grupos.semana)}
          {grupo(t.contasGrupoDepois, grupos.depois)}
        </>
      )}

      {pagas.length > 0 && (
        <details className="rounded-2xl border border-border bg-surface px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-ink-muted">{t.contasGrupoPagas}</summary>
          <ul className="divide-y divide-border pb-1">
            {pagas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{c.nome}</span>
                  <span className="block text-caption text-ink-faint">{t.contasPagaEm(c.pagaEm ? diaMes(c.pagaEm) : diaMes(c.vencimento))}</span>
                </span>
                {c.valor !== null && <span className="text-sm tabular-nums text-ink-muted">{money(c.valor)}</span>}
                <button
                  type="button"
                  onClick={() => startTransition(async () => {
                    await desfazerPagamentoAction(c.id, c.vencimento);
                    router.refresh();
                  })}
                  className="min-h-11 shrink-0 px-2 text-caption font-semibold text-accent-strong"
                >
                  {t.contasDesfazer}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Modal open={editando !== null} onClose={fechar} title={editando?.conta ? t.contasEditarTitulo : t.contasNova}>
        {editando !== null && <FormDaConta key={editando.conta?.id ?? "nova"} conta={editando.conta} hoje={hoje} onFeito={fechar} />}
      </Modal>
    </div>
  );
}
