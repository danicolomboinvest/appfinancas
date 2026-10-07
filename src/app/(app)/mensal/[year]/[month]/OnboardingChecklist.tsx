"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { pedirRegistro } from "@/components/shell/registrar-eventos";
import { mostrarComece, passosDoComece, type PassoDoComece } from "@/app/(app)/mensal/foco/comece";

const DISMISS_KEY = "onboarding-dismissed";
const VIU_MES_KEY = "comece-viu-mes";
/** Avisa os outros leitores da mesma chave nesta aba (o evento "storage" só chega nas outras). */
const EVENTO_LOCAL = "spi:comece";

/** Lê uma marca "1" do aparelho. Aba anônima ou armazenamento bloqueado: conta como não marcado. */
function lerMarca(chave: string): boolean {
  try {
    return window.localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}

function gravarMarca(chave: string) {
  try {
    window.localStorage.setItem(chave, "1");
  } catch {
    // Sem armazenamento: a marca vale só até recarregar. O passo volta, mas nada quebra.
  }
  window.dispatchEvent(new Event(EVENTO_LOCAL));
}

function assinar(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_LOCAL, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_LOCAL, avisar);
  };
}

/**
 * useSyncExternalStore em vez de useState + useEffect: o setState dentro do efeito era o erro de
 * lint (set-state-in-effect), e aqui a leitura é direta. `noServidor` é o que o HTML do servidor
 * assume antes de o aparelho responder.
 */
function useMarca(chave: string, noServidor: boolean): boolean {
  return useSyncExternalStore(assinar, () => lerMarca(chave), () => noServidor);
}

/**
 * "Comece por aqui": os três primeiros passos, um por vez (ver foco/comece.ts). Só o passo da
 * vez mostra explicação e botão; os outros ficam como lista, feito ou por fazer. Assim a pessoa
 * nunca tem dois pedidos na frente ao mesmo tempo.
 *
 * Pra conta sem nenhum lançamento, este cartão É o Foco (a página esconde o resto), e por isso
 * não dá pra dispensar. Depois do primeiro lançamento o X aparece (lembrado no aparelho).
 */
export function OnboardingChecklist({
  temLancamento,
  temOrcamento,
  primeiroLancamentoEm,
  hrefMes,
}: {
  temLancamento: boolean;
  temOrcamento: boolean;
  /** ISO do primeiro lançamento do perfil (null = nenhum). */
  primeiroLancamentoEm: string | null;
  hrefMes: string;
}) {
  // O que o guia diz vem da voz do tema; o que ele checa (os passos) é igual nos sete.
  const { voz, profileId } = useProfileTheme();
  const t = voz.titulos;
  // "Já vi o mês" é de cada perfil: o mês do Casal ou da Empresa é outro mês.
  const chaveViuMes = `${VIU_MES_KEY}:${profileId ?? "perfil"}`;
  // No servidor: dispensado (evita piscar pra quem já fechou) e mês não visto.
  const dispensado = useMarca(DISMISS_KEY, true);
  const viuMes = useMarca(chaveViuMes, false);

  const p = passosDoComece({
    temLancamento,
    temOrcamento,
    viuMes,
    primeiroLancamentoEm: primeiroLancamentoEm ? new Date(primeiroLancamentoEm) : null,
  });
  if (!mostrarComece(p, dispensado)) return null;

  const titulos: Record<PassoDoComece, string> = {
    importar: t.focoComeceImportarT,
    verMes: t.focoComeceMesT,
    orcamento: t.focoComeceOrcamentoT,
  };
  const botaoPrincipal = "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm transition-opacity hover:opacity-95 sm:w-auto";
  const linkSecundario = "inline-flex min-h-11 items-center text-caption font-semibold text-accent-strong underline-offset-2 hover:underline";

  function detalheDoPasso(id: PassoDoComece) {
    if (id === "importar") {
      return (
        <>
          <p className="mt-1 text-caption text-ink-muted">{t.focoComeceImportarP}</p>
          <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <button type="button" onClick={() => pedirRegistro("import")} className={botaoPrincipal}>
              {t.focoComeceImportarBotao}
            </button>
            <button type="button" onClick={() => pedirRegistro("type")} className={`${linkSecundario} justify-center`}>
              {t.focoComeceDigitar}
            </button>
          </div>
          {/* Onde tirar o arquivo e extrato × fatura: a dúvida nº 1 de quem nunca fez isso. */}
          <Link href="/guia#extrato-ou-fatura" className="inline-flex min-h-11 items-center text-caption text-ink-muted underline underline-offset-2 hover:text-ink">
            {t.focoComeceAjuda}
          </Link>
        </>
      );
    }
    if (id === "verMes") {
      return (
        <>
          <p className="mt-1 text-caption text-ink-muted">{t.focoComeceMesP}</p>
          <Link href={hrefMes} onClick={() => gravarMarca(chaveViuMes)} className={`${botaoPrincipal} mt-3`}>
            {t.focoComeceMesBotao}
          </Link>
        </>
      );
    }
    return (
      <>
        <p className="mt-1 text-caption text-ink-muted">{t.focoComeceOrcamentoP}</p>
        <Link href="/orcamento" className={`${botaoPrincipal} mt-3`}>
          {t.focoComeceOrcamentoBotao}
        </Link>
      </>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="pt-2.5 text-caption font-semibold text-ink-muted">
          {t.focoComeceTitulo} <span className="font-normal normal-case tracking-normal text-ink-faint">{t.focoComeceContagem(p.feitos, p.passos.length)}</span>
        </p>
        {!p.contaNova && (
          // Área de toque de 44px, com o ícone do mesmo tamanho de antes.
          <button type="button" onClick={() => gravarMarca(DISMISS_KEY)} aria-label={t.focoComeceDispensar} title={t.focoComeceDispensar} className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink">
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <ol className="mt-2 flex flex-col gap-3">
        {p.passos.map((passo, i) => {
          const daVez = passo.id === p.atual;
          return (
            <li key={passo.id} className="flex gap-3" aria-current={daVez ? "step" : undefined}>
              <span
                aria-hidden
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-caption font-semibold ${
                  passo.feito ? "border-success bg-success-soft text-success" : daVez ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong text-ink-faint"
                }`}
              >
                {passo.feito ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${passo.feito ? "text-ink-faint line-through" : daVez ? "font-semibold text-ink" : "text-ink-muted"}`}>{titulos[passo.id]}</p>
                {daVez && detalheDoPasso(passo.id)}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
