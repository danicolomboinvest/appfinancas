"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import type { Devendo, Semana } from "@/lib/empresa/regras";
import { diaCurto } from "@/lib/empresa/resumo";
import { recebiAction } from "../actions";
import { Cartao, Heroi, Iniciais, LogoDaForma, Titulo, Voltar } from "../partes";

/**
 * A linha do tempo das próximas 4 semanas (o cartão cai sozinho; boleto e Pix combinado esperam o
 * "Recebi") e quem deve, com o lembrete pronto para mandar.
 */
export function Recebimentos({ nome, semanas, devendo }: { nome: string; semanas: Semana[]; devendo: Devendo[] }) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showError } = useToast();
  const [salvando, iniciar] = useTransition();
  const total = semanas.reduce((s, w) => s + w.total, 0);

  return (
    <>
      <Voltar>{nome}</Voltar>
      <Titulo>Recebimentos</Titulo>
      <Heroi rotulo="Vai entrar em 4 semanas" valor={m0(total)} ajuda="Soma as entradas em que você disse o dia em que o dinheiro cai: o cartão, os boletos e o Pix combinados." />
      {total > 0 && (
        <Cartao className="px-4 py-2">
          {semanas.map((w, i) => (
            <div key={w.inicio} className="relative flex min-h-16 items-center gap-3">
              <span className="w-14 shrink-0">
                <b className="block text-[15px] font-medium text-ink">{diaCurto(w.inicio)}</b>
                <small className="text-xs text-ink-muted">a {diaCurto(w.fim).split(" ")[0]}</small>
              </span>
              <span className="relative flex w-4 justify-center self-stretch" aria-hidden>
                {i < semanas.length - 1 && <i className="absolute bottom-0 top-1/2 w-px bg-border-strong" />}
                {i > 0 && <i className="absolute top-0 bottom-1/2 w-px bg-border-strong" />}
                <i className="relative mt-auto mb-auto size-3 rounded-full border-2 border-accent bg-surface" />
              </span>
              <span className="flex min-w-0 flex-1 -space-x-2">
                {w.quem.slice(0, 3).map((q) => (q.forma === "credito" || q.forma === "debito" ? <LogoDaForma key={q.nome} forma={q.forma} /> : <Iniciais key={q.nome} nome={q.nome} className="size-9" />))}
              </span>
              <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{w.total > 0 ? m0(w.total) : "-"}</b>
            </div>
          ))}
        </Cartao>
      )}
      {devendo.length > 0 && <h2 className="mt-2 px-1 text-lg font-medium text-ink">Quem deve</h2>}
      {devendo.map((d) => {
        const texto = `Oi, ${d.cliente.split(" ")[0]}! Tudo bem? Passando para lembrar do pagamento de ${m0(d.valor)}${d.descricao && !d.descricao.startsWith("Venda") ? ` (${d.descricao})` : ""}. Qualquer dúvida, é só me chamar.`;
        return (
          <div key={d.id} className="flex min-h-20 items-center gap-3 rounded-3xl bg-danger-soft px-4 py-3">
            <Iniciais nome={d.cliente} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-medium text-ink">{d.cliente}</b>
              <small className="text-sm text-danger">
                {m0(d.valor)}, há {d.dias} {d.dias === 1 ? "dia" : "dias"}
              </small>
            </span>
            <span className="flex shrink-0 flex-col gap-1.5">
              <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="flex min-h-10 items-center justify-center rounded-full bg-pill px-4 text-sm font-medium text-on-pill">
                Lembrar
              </a>
              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  iniciar(async () => {
                    const r = await recebiAction(d.id);
                    if (!r.ok) return showError(r.erro);
                    // Sem aviso: a cobrança sai da lista de quem falta pagar.
                    router.refresh();
                  })
                }
                className="min-h-9 rounded-full px-3 text-xs text-ink-muted"
              >
                Recebi
              </button>
            </span>
          </div>
        );
      })}
      {total === 0 && devendo.length === 0 && <Cartao className="px-5 py-6 text-center text-sm text-ink-muted">Nada a receber agora. Na entrada, diga o dia em que o dinheiro cai.</Cartao>}
    </>
  );
}
