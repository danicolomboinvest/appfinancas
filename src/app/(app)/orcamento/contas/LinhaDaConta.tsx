"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Repeat } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { diasAte, lerData, situacao, type Situacao } from "@/lib/contas/contas";
import { desfazerPagamentoAction, pagarContaAction } from "./actions";

/** A conta como chega no cliente: datas em texto ("2026-10-12"), pra atravessar a fronteira. */
export type ContaSerial = {
  id: string;
  nome: string;
  valor: number | null;
  vencimento: string;
  repete: boolean;
  lembrar: boolean;
  quitada: boolean;
  pagaEm: string | null;
};

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** A cor do quadradinho da data: atrasada pede atenção, hoje e amanhã ficam em destaque. */
const COR_DA_DATA: Record<Situacao, string> = {
  atrasada: "bg-danger-soft text-danger",
  hoje: "bg-accent-gradient text-on-accent",
  amanha: "bg-accent-soft text-accent-strong",
  semana: "bg-surface-2 text-ink",
  depois: "bg-surface-2 text-ink-muted",
};

/**
 * Uma conta: a data num quadradinho de calendário, o nome, quando vence e o "Paguei". Tocar no
 * resto da linha abre a edição (quando a tela passa `onAbrir`). Usada na tela das contas e no
 * cartão do Foco.
 */
export function LinhaDaConta({ conta, hoje, onAbrir }: { conta: ContaSerial; hoje: string; onAbrir?: () => void }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const { showToast, showError } = useToast();
  const router = useRouter();
  const [pagando, startTransition] = useTransition();

  const venc = lerData(conta.vencimento)!;
  const hojeD = lerData(hoje)!;
  const sit = situacao(venc, hojeD);
  const dias = diasAte(venc, hojeD);

  function pagar() {
    startTransition(async () => {
      const r = await pagarContaAction(conta.id);
      if (!r) {
        showError("Não deu para marcar. Atualize a tela e tente de novo.");
        return;
      }
      showToast(t.contasPagaToast(conta.nome, r.proxima ? diaMes(r.proxima) : null), {
        label: t.contasDesfazer,
        onClick: () => {
          void desfazerPagamentoAction(conta.id, r.antes).then(() => router.refresh());
        },
      });
      router.refresh();
    });
  }

  const corpo = (
    <>
      <span className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${COR_DA_DATA[sit]}`} aria-hidden>
        <span className="text-lg font-bold tabular-nums">{Number(conta.vencimento.slice(8, 10))}</span>
        <span className="mt-0.5 text-xs font-semibold uppercase">{MES_CURTO[Number(conta.vencimento.slice(5, 7)) - 1]}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{conta.nome}</span>
        <span className={`mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-caption ${sit === "atrasada" ? "font-semibold text-danger" : "text-ink-muted"}`}>
          {t.contasQuando(sit, dias, diaMes(conta.vencimento))}
          {conta.repete && <Repeat size={12} className="shrink-0 text-ink-faint" aria-label={t.contasRepeteSelo} />}
          {conta.lembrar && <Bell size={12} className="shrink-0 text-ink-faint" aria-label={t.contasLembrar} />}
        </span>
      </span>
    </>
  );

  // Em 375px não cabem nome, vencimento, valor e botão numa linha só: o valor e o "Paguei" ficam
  // empilhados à direita, e o nome e o vencimento ganham a largura que sobra.
  return (
    <li className="flex items-center gap-3 py-3">
      {onAbrir ? (
        <button type="button" onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left">
          {corpo}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{corpo}</span>
      )}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={`text-right tabular-nums ${conta.valor === null ? "text-caption text-ink-faint" : "text-sm font-semibold text-ink"}`}>
          {conta.valor === null ? t.contasValorVaria : money(conta.valor)}
        </span>
        {/* Compacto por fora (cabe embaixo do valor), 44px de toque por dentro (o ::before). */}
        <button
          type="button"
          onClick={pagar}
          disabled={pagando}
          className="relative rounded-full border border-border-strong px-3 py-1 text-caption font-semibold text-ink transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:bg-surface-hover active:scale-95 disabled:opacity-50"
        >
          {t.contasPaguei}
        </button>
      </div>
    </li>
  );
}
