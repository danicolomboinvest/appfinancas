"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CirclePlay, Landmark, LogOut, Scale, UserMinus } from "lucide-react";
import { abrirTutorialDoCasal } from "@/components/casa/TutorialDoCasalNoApp";
import { Modal } from "@/components/ui/Modal";
import { Segmentado } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/toast-context";
import { BOTAO_ESCURO, ParDeAvatares } from "@/components/casal-login/visual";
import { removerParAction, sairDoCasalAction } from "@/app/(app)/divisao/nos-dois-actions";
import { definirDivisaoAction } from "@/app/(app)/mensal/foco/acerto/actions";
import { salvarNomesDaCasaAction } from "./actions";

const CAMPO = "min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-[16px] text-ink outline-none focus:border-ink";
const CARTAO = "flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4";

/**
 * Configurações › Casa (Casal simples): os nomes, o jeito de dividir, o que esconder e a saída.
 * A titular tira o par; o par sai. Cada um fica com o que é seu.
 */
export function ConfigDaCasa({ eu, outro, souTitular, divisao }: { eu: string; outro: string; souTitular: boolean; divisao: "renda" | "meio" | "combinado" }) {
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [pendente, startTransition] = useTransition();
  const [nomes, setNomes] = useState({ eu, outro });
  const [jeito, setJeito] = useState(divisao);
  const [confirmando, setConfirmando] = useState(false);
  const titular = souTitular ? nomes.eu : nomes.outro;
  const par = souTitular ? nomes.outro : nomes.eu;
  const mudouNome = nomes.eu !== eu || nomes.outro !== outro;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4" data-config-da-casa={souTitular ? "titular" : "par"}>
      <div className="flex flex-col items-center gap-2 pt-2">
        <ParDeAvatares titular={titular || "?"} par={par || "?"} size={64} />
        <button
          type="button"
          onClick={abrirTutorialDoCasal}
          data-como-funciona-casal
          className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
        >
          <CirclePlay size={17} strokeWidth={1.7} aria-hidden />
          Como funciona
        </button>
      </div>

      <section className={CARTAO}>
        <h2 className="text-[15px] font-medium text-ink">Nomes</h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-muted">Você</span>
          <input className={CAMPO} value={nomes.eu} maxLength={30} onChange={(e) => setNomes((n) => ({ ...n, eu: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink-muted">{souTitular ? "Seu par" : "Quem paga o Casal"}</span>
          <input className={CAMPO} value={nomes.outro} maxLength={30} onChange={(e) => setNomes((n) => ({ ...n, outro: e.target.value }))} />
        </label>
        {mudouNome && (
          <button
            type="button"
            disabled={pendente}
            className={BOTAO_ESCURO}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarNomesDaCasaAction(nomes.eu, nomes.outro).catch(() => ({ ok: false, mensagem: undefined }));
                if (r.ok) {
                  showToast("Nomes salvos");
                  router.refresh();
                } else showError(r.mensagem ?? "Não deu para salvar agora.");
              })
            }
          >
            Salvar nomes
          </button>
        )}
        <p className="text-[13px] text-ink-muted">A foto de cada um é a da conta, em Meus dados.</p>
      </section>

      <section className={CARTAO}>
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <Scale size={17} strokeWidth={1.7} aria-hidden /> Como dividir
        </h2>
        <Segmentado
          rotulo="Como dividir"
          opcoes={[
            { valor: "renda" as const, rotulo: "Pela renda" },
            { valor: "meio" as const, rotulo: "Meio a meio" },
            ...(divisao === "combinado" ? [{ valor: "combinado" as const, rotulo: "Combinado" }] : []),
          ]}
          valor={jeito}
          aoEscolher={(v) => {
            if (v === "combinado") return;
            const antes = jeito;
            setJeito(v);
            startTransition(async () => {
              const r = await definirDivisaoAction(v).catch(() => ({ ok: false }));
              if (!r.ok) {
                setJeito(antes);
                showError("Não deu para mudar agora.");
              }
            });
          }}
        />
        <p className="text-[13px] text-ink-muted">Só o que é da casa entra no acerto.</p>
      </section>

      <Link href="/configuracoes/contas-e-cartoes" className="flex min-h-14 items-center gap-3 rounded-3xl border border-border bg-surface px-4">
        <Landmark size={18} className="shrink-0 text-ink-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] text-ink">O que {nomes.outro} vê</span>
          <span className="block text-[13px] text-ink-muted">Mostrar ou esconder cada conta</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
      </Link>

      <button
        type="button"
        onClick={() => setConfirmando(true)}
        data-sair-da-casa
        className="flex min-h-14 items-center gap-3 rounded-3xl border border-border bg-surface px-4 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden>
          {souTitular ? <UserMinus size={18} /> : <LogOut size={18} />}
        </span>
        <span className="min-w-0 flex-1 text-[16px] font-medium text-danger">{souTitular ? `Tirar ${par} da casa` : "Sair da casa"}</span>
      </button>

      <Modal open={confirmando} onClose={() => setConfirmando(false)} title={souTitular ? `Tirar ${par} da casa?` : "Sair da casa?"}>
        <div className="flex flex-col gap-4" data-confirmar-saida>
          <ul className="flex flex-col gap-2 text-[15px] text-ink">
            <li>Cada um fica com os próprios lançamentos, no próprio Pessoal.</li>
            <li>{souTitular ? "O acerto e as metas a dois ficam com você." : `O acerto e as metas a dois ficam com ${titular}.`}</li>
            <li>{souTitular ? `${par} não vê mais nada seu.` : `${titular} não vê mais nada seu.`}</li>
          </ul>
          <button
            type="button"
            disabled={pendente}
            className="flex min-h-14 w-full items-center justify-center rounded-full bg-danger px-5 text-[17px] font-semibold text-canvas disabled:opacity-60"
            onClick={() =>
              startTransition(async () => {
                const r = await (souTitular ? removerParAction() : sairDoCasalAction()).catch(() => ({ ok: false as const, mensagem: "Não consegui agora." }));
                if (!r.ok) {
                  showError(r.mensagem);
                  return;
                }
                setConfirmando(false);
                router.push("/mensal/foco");
                router.refresh();
              })
            }
          >
            {souTitular ? `Tirar ${par}` : "Sair"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} className="min-h-12 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}
