"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, ChevronDown } from "lucide-react";

const VISTO = "manual-importacao-visto";

/**
 * "Extrato ou fatura?" na hora de subir o arquivo. Na primeira vez abre sozinho: é quando a
 * pessoa ainda não sabe que a fatura cai no mês escolhido, que o pagamento da fatura sai do
 * extrato, que subir de novo não duplica. Depois fica recolhido, a um toque. O resto está no
 * manual (/guia), com o mesmo texto.
 */
export function ComoImportar() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(VISTO)) {
        // Primeira importação neste aparelho: mostra aberto uma vez e marca como visto.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAberto(true);
        localStorage.setItem(VISTO, "1");
      }
    } catch {
      // Sem localStorage (aba anônima): fica recolhido, a um toque.
    }
  }, []);

  const item = (texto: string) => (
    <li className="flex gap-2">
      <Check size={14} className="mt-0.5 shrink-0 text-accent-strong" aria-hidden />
      <span>{texto}</span>
    </li>
  );

  return (
    <div className="rounded-2xl border border-border bg-surface-2">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <BookOpen size={16} className="shrink-0 text-accent-strong" aria-hidden />
        <span className="flex-1 text-sm font-semibold text-ink">Extrato ou fatura? Entenda antes de subir</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-faint transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aberto && (
        <div className="flex flex-col gap-3 border-t border-border px-4 pb-4 pt-3 text-caption text-ink-muted">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-ink">Extrato · a conta do banco</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {item("Entrada vira renda, saída vira gasto")}
                {item("Cada lançamento cai no mês da própria data")}
                {item("Aplicação e caixinha viram dinheiro guardado")}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Fatura · o cartão de crédito</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {item("Toda compra vira gasto")}
                {item("Tudo cai no mês que você escolher")}
                {item("Parcela \"3 de 10\" já cria as próximas")}
              </ul>
            </div>
          </div>
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-ink">
            <b>Pode subir os dois do mesmo mês.</b> O &quot;Pagamento da fatura&quot; do extrato sai da conta pra não contar duas vezes, e subir o mesmo período de novo não duplica nada.
          </p>
          <Link href="/guia#extrato-ou-fatura" className="font-semibold text-accent-strong">
            Ler o manual completo →
          </Link>
        </div>
      )}
    </div>
  );
}
