"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { reportarRespostaErradaAction } from "@/app/(app)/mensal/foco/actions";

const MOTIVOS = ["O número está errado", "Faltou algum gasto ou renda", "Não entendi a resposta", "Outra coisa"];

/**
 * "Isso está errado?": em toda resposta com número. Vai pra fila da Dani só a tela, o motivo e
 * a regra que rodou — nunca o extrato da pessoa.
 */
export function ReportarErro({ tela, regra }: { tela: string; regra: string }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pendente, startTransition] = useTransition();

  if (enviado) return <p className="text-center text-caption text-ink-faint">{t.erradoObrigada}</p>;

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="mx-auto block text-caption font-medium text-ink-faint underline underline-offset-4 hover:text-ink-muted">
        {t.erradoLink}
      </button>
      <Modal open={aberto} onClose={() => setAberto(false)} title={t.erradoLink}>
        <div className="flex flex-col gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={motivo === m}
              onClick={() => setMotivo(m)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${motivo === m ? "border-transparent bg-accent-soft text-accent-strong" : "border-border text-ink"}`}
            >
              {m}
            </button>
          ))}
          <label className="mt-2 flex flex-col gap-1.5 text-label font-medium text-ink-muted">
            Quer contar mais? (opcional)
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={3} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink" />
          </label>
          <p className="text-caption text-ink-faint">Vai pra revisão só qual resposta foi e qual regra rodou. Seu extrato não vai junto.</p>
          <button
            type="button"
            disabled={!motivo || pendente}
            onClick={() =>
              startTransition(async () => {
                await reportarRespostaErradaAction({ tela, motivo: motivo ?? "", texto, regra });
                setAberto(false);
                setEnviado(true);
              })
            }
            className="mt-2 rounded-2xl bg-pill px-4 py-3 text-sm font-semibold text-on-pill disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </Modal>
    </>
  );
}
