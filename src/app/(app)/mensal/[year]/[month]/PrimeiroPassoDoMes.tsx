"use client";

import { FileUp, Pencil } from "lucide-react";
import { pedirRegistro } from "@/components/shell/registrar-eventos";
import { trackEvent } from "@/lib/usage/track-event";

/**
 * Transações de quem ainda não tem nenhum lançamento (estilo novo, 12/10/2026): o desenho do
 * recibo, uma frase curta e os mesmos dois botões da folha Registrar, "Importar extrato" em
 * destaque e "Digitar". Importar continua o primeiro: quem só digita é quem mais desiste.
 * Os textos chegam prontos na voz do tema.
 */
export function PrimeiroPassoDoMes({ titulo, texto, importar }: { titulo: string; texto: string; /** O rótulo do Registrar no tema ("Extrato" no Girly). */ importar: string }) {
  const botoes = [
    { chave: "import" as const, evento: "registro_importacao", Icone: FileUp, rotulo: importar, destaque: true },
    { chave: "type" as const, evento: "registro_digitado", Icone: Pencil, rotulo: "Digitar", destaque: false },
  ];
  return (
    <section className="flex flex-col items-center gap-2 px-1 pb-4 pt-8 text-center" data-mes-vazio>
      <svg viewBox="0 0 64 72" className="mb-1 h-16 w-14 text-ink-faint" aria-hidden>
        <path d="M10 4h44v62l-7-5-7 5-8-5-8 5-7-5-7 5z" fill="var(--color-surface)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 20h24M20 30h24M20 40h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h2 className="text-[20px] font-semibold leading-tight text-ink">{titulo}</h2>
      <p className="max-w-xs text-[15px] text-ink-muted">{texto}</p>
      <div className="mt-4 grid w-full max-w-xs grid-cols-2 gap-2.5">
        {botoes.map(({ chave, evento, Icone, rotulo, destaque }) => (
          <button
            key={chave}
            type="button"
            onClick={() => {
              // Mesmos nomes da escolha no "+"; o caminho separa quem veio por aqui.
              trackEvent(evento, "/mensal/conta-nova");
              pedirRegistro(chave);
            }}
            className={`flex min-h-32 flex-col items-center justify-start gap-2.5 rounded-2xl border px-2 pb-3 pt-4 text-center transition-all active:scale-95 ${
              destaque ? "border-accent/50 bg-accent-soft/40 hover:border-accent" : "border-border bg-surface-2 hover:border-border-strong hover:bg-surface-hover"
            }`}
          >
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${destaque ? "bg-accent-gradient text-on-accent shadow-premium-sm" : "bg-pill text-on-pill"}`}>
              <Icone size={22} strokeWidth={1.75} />
            </span>
            <span className={`text-[13px] leading-tight text-ink ${destaque ? "font-semibold" : "font-medium"}`}>{rotulo}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
