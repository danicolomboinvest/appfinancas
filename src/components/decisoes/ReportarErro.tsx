"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Copy, CreditCard, Wallet, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { pedirRegistro } from "@/components/shell/registrar-eventos";
import { reportarRespostaErradaAction } from "@/app/(app)/mensal/foco/actions";

const MOTIVOS = ["O número está errado", "Faltou algum gasto ou renda", "Não entendi a resposta", "Outra coisa"];

type Atalho = "cartao" | "renda" | "repetido";

/**
 * As três causas de quase todo "o número está errado" (07/10/2026: 22 de 23 avisos eram isso,
 * quase todos no 1º ou 2º dia de conta). Antes o botão só respondia "obrigada" e a pessoa ficava
 * sem saída. Agora cada causa tem uma linha e o caminho para resolver; o aviso continua indo
 * para a fila da Dani, com o atalho escolhido como motivo.
 */
const ATALHOS: { id: Atalho; Icone: LucideIcon; rotulo: string; resposta: string }[] = [
  { id: "cartao", Icone: CreditCard, rotulo: "Gasto do cartão", resposta: "O cartão conta no mês em que a fatura vence, que é quando o dinheiro sai." },
  { id: "renda", Icone: Wallet, rotulo: "Renda que ainda não caiu", resposta: "A conta usa só o que já entrou. Renda que vai cair, lance quando receber." },
  { id: "repetido", Icone: Copy, rotulo: "Lançamento repetido", resposta: "Apague o repetido no mês, ou desfaça a importação inteira no fim da tela." },
];

/**
 * "Isso está errado?": em toda resposta com número. Vai pra fila da Dani só a tela, o motivo e
 * a regra que rodou — nunca o extrato da pessoa.
 */
export function ReportarErro({ tela, regra }: { tela: string; regra: string }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [aberto, setAberto] = useState(false);
  const [atalho, setAtalho] = useState<Atalho | null>(null);
  const [outraCoisa, setOutraCoisa] = useState(false);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pendente, startTransition] = useTransition();
  const hoje = new Date();
  const mesHref = `/mensal/${hoje.getFullYear()}/${hoje.getMonth() + 1}`;

  function fechar() {
    setAberto(false);
    setAtalho(null);
    setOutraCoisa(false);
  }

  function escolherAtalho(a: Atalho) {
    setAtalho(a);
    // O aviso vai junto, sem pedir mais nada: é o mesmo dado que a Dani lia antes.
    reportarRespostaErradaAction({ tela, motivo: `Atalho: ${ATALHOS.find((x) => x.id === a)?.rotulo ?? a}`, regra }).catch(() => {});
  }

  if (enviado) return <p className="text-center text-caption text-ink-faint">{t.erradoObrigada}</p>;

  const escolhido = ATALHOS.find((a) => a.id === atalho);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="mx-auto block text-caption font-medium text-ink-faint underline underline-offset-4 hover:text-ink-muted">
        {t.erradoLink}
      </button>
      <Modal open={aberto} onClose={fechar} title={t.erradoLink}>
        {escolhido ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
                <escolhido.Icone size={20} strokeWidth={1.8} />
              </span>
              <p className="text-[15px] font-semibold text-ink">{escolhido.rotulo}</p>
            </div>
            <p className="text-sm text-ink-muted">{escolhido.resposta}</p>
            {escolhido.id === "renda" ? (
              <button
                type="button"
                onClick={() => {
                  fechar();
                  pedirRegistro("type");
                }}
                className="rounded-2xl bg-pill px-4 py-3 text-sm font-semibold text-on-pill"
              >
                Lançar uma renda
              </button>
            ) : (
              <Link href={escolhido.id === "cartao" ? `${mesHref}#importacoes` : mesHref} onClick={fechar} className="rounded-2xl bg-pill px-4 py-3 text-center text-sm font-semibold text-on-pill">
                {escolhido.id === "cartao" ? "Ver as faturas do mês" : "Ver os lançamentos do mês"}
              </Link>
            )}
            <button type="button" onClick={() => setAtalho(null)} className="text-sm font-medium text-ink-muted hover:text-ink">
              Não é isso
            </button>
          </div>
        ) : outraCoisa ? (
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
            <p className="text-caption text-ink-faint">Vai para revisão só qual resposta foi e qual regra rodou. Seu extrato não vai junto.</p>
            <button
              type="button"
              disabled={!motivo || pendente}
              onClick={() =>
                startTransition(async () => {
                  await reportarRespostaErradaAction({ tela, motivo: motivo ?? "", texto, regra });
                  fechar();
                  setEnviado(true);
                })
              }
              className="mt-2 rounded-2xl bg-pill px-4 py-3 text-sm font-semibold text-on-pill disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ATALHOS.map(({ id, Icone, rotulo }) => (
              <button
                key={id}
                type="button"
                onClick={() => escolherAtalho(id)}
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-border px-3 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
                  <Icone size={18} strokeWidth={1.8} />
                </span>
                <span className="flex-1 text-[15px] font-medium text-ink">{rotulo}</span>
                <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
              </button>
            ))}
            <button type="button" onClick={() => setOutraCoisa(true)} className="mt-1 rounded-2xl px-4 py-3 text-sm font-medium text-ink-muted hover:text-ink">
              Outra coisa
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
