"use client";

import type { ProfileKind } from "@prisma/client";


import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight, FileUp, Keyboard, Mic, ShoppingBag } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { EntryForm } from "@/app/(app)/mensal/[year]/[month]/EntryForm";
import { subcategoriesFor, incomeTypesFor } from "@/lib/categories";
import { getRecentSubcategoriesAction, getCustomCategoriesAction, getGoalsAction, getOtherProfilesAction } from "@/app/(app)/mensal/actions";
import { currentYearMonthFromPath } from "@/app/(app)/mensal/current-month";
import { VoiceRecorder } from "@/app/(app)/mensal/VoiceRecorder";
import { StatementImport } from "@/components/import/StatementImport";
import type { ParsedVoiceEntry } from "@/lib/entries/voice-expense-parser";
import { trackEvent } from "@/lib/usage/track-event";
import { ehEmpresa } from "@/lib/profiles/empresa";
import type { ModoDoRegistrar } from "./registrar-eventos";
import { useVoltarAoTopo } from "@/components/ui/useVoltarAoTopo";

type Mode = ModoDoRegistrar;

/**
 * Ponto de entrada ÚNICO de registro no app (item 1 da Rodada 2). Aberto só pelo "+" central da
 * tab bar (mobile) ou pelo botão "Registrar" da sidebar (desktop), nenhum botão solto nas telas.
 * O microfone vive aqui dentro: só aparece depois que a pessoa escolhe "Gravar áudio".
 */
export function RegistrarDrawer({
  open,
  onClose,
  modoInicial = "choice",
}: {
  open: boolean;
  onClose: () => void;
  /** Onde a gaveta abre. O "+" abre na escolha; "Importe seu extrato" da conta nova, na importação. */
  modoInicial?: ModoDoRegistrar;
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>(open ? modoInicial : "choice");
  const [parsed, setParsed] = useState<ParsedVoiceEntry | null>(null);
  const [recentSubcategories, setRecentSubcategories] = useState<Partial<Record<ParentCategory, string[]>>>({});
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const [goals, setGoals] = useState<{ id: string; name: string }[]>([]);
  const [otherProfiles, setOtherProfiles] = useState<{ id: string; name: string }[]>([]);
  const { year, month } = currentYearMonthFromPath(pathname);
  // Trocou de caminho (escolha → importar, áudio → formulário): a folha volta para o começo.
  const topoRef = useVoltarAoTopo(mode);

  // Ao abrir, começa no modo pedido; ao fechar, volta pro início. Feito no render (e não num
  // efeito) pra gaveta nunca aparecer um quadro na escolha antes de pular pra importação.
  const [estavaAberta, setEstavaAberta] = useState(open);
  if (open !== estavaAberta) {
    setEstavaAberta(open);
    setMode(open ? modoInicial : "choice");
    setParsed(null);
  }

  // Carrega chips de categoria uma vez ao abrir (o reset ao fechar mora no render, acima).
  useEffect(() => {
    if (!open) return;
    getRecentSubcategoriesAction().then(setRecentSubcategories);
    getCustomCategoriesAction().then(setCustomCategories);
    getGoalsAction().then(setGoals);
    getOtherProfilesAction().then(setOtherProfiles);
  }, [open]);

  // Título, cartões e "Voltar" vêm da voz do tema: é aqui que um tema pode chamar "Digitar" de
  // outro jeito sem tocar no componente.
  const { voz, kind } = useProfileTheme();
  const title =
    mode === "choice"
      ? voz.titulos.registrar
      : mode === "voice"
        ? voz.titulos.registrarFalar
        : mode === "import"
          ? voz.titulos.registrarImportar
          : voz.titulos.registrarNovo;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div ref={topoRef}>
      {mode !== "choice" && (
        <button
          type="button"
          onClick={() => {
            setMode("choice");
            setParsed(null);
          }}
          className="mb-4 -mt-1 flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={16} />
          {voz.titulos.impVoltar}
        </button>
      )}

      {mode === "choice" && (
        <div className="flex flex-col gap-4">
          {/* Três botões grandes lado a lado, sem frase de apoio (06/10/2026). Importar continua
              primeiro e com a cor do tema: é a promessa do app ("solta o extrato, o mês se monta
              sozinho") e quem só digita à mão é quem mais desiste nos 7 dias de garantia. O nome
              é o mesmo dos guias, sem a lista de formatos. */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                chave: "import" as const,
                evento: "registro_importacao",
                guia: "importar",
                Icone: FileUp,
                rotulo: voz.titulos.impImportarArquivo.replace(/\s*\([^)]*\)/, ""),
                destaque: true,
              },
              { chave: "type" as const, evento: "registro_digitado", guia: undefined, Icone: Keyboard, rotulo: voz.titulos.impDigitar, destaque: false },
              // Medido na escolha, e não no salvamento: quem tenta o áudio e desiste no meio também
              // é resposta — é justamente o sinal de que a gravação está difícil.
              { chave: "voice" as const, evento: "registro_voz", guia: "gravar-audio", Icone: Mic, rotulo: voz.titulos.impGravarAudio, destaque: false },
            ].map(({ chave, evento, guia, Icone, rotulo, destaque }) => (
              <button
                key={chave}
                type="button"
                onClick={() => {
                  trackEvent(evento, "/registrar");
                  setMode(chave);
                }}
                data-guia={guia}
                className={`flex min-h-32 flex-col items-center justify-start gap-2.5 rounded-2xl border px-2 pb-3 pt-4 text-center transition-all active:scale-95 ${
                  destaque ? "border-accent/50 bg-accent-soft/40 hover:border-accent" : "border-border bg-surface-2 hover:border-border-strong hover:bg-surface-hover"
                }`}
              >
                <span
                  className={`flex size-12 shrink-0 items-center justify-center rounded-full ${destaque ? "bg-accent-gradient text-on-accent shadow-premium-sm" : "bg-pill text-on-pill"}`}
                >
                  <Icone size={22} strokeWidth={1.75} />
                </span>
                <span className={`text-[13px] leading-tight text-ink ${destaque ? "font-semibold" : "font-medium"}`}>{rotulo}</span>
              </button>
            ))}
          </div>

          {/* Duas linhas que levam para outra tela e fecham a gaveta. "Posso comprar?" fica aqui
              porque a hora de decidir é antes de passar o cartão; a conta a pagar (05/10/2026)
              porque é a hora em que ela lembra do boleto. */}
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {!ehEmpresa(kind) && (
              <Link
                href="/decidir/comprar"
                data-guia="posso-comprar"
                onClick={() => {
                  trackEvent("posso_comprar", "/registrar");
                  onClose();
                }}
                className="flex min-h-12 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
              >
                <ShoppingBag size={18} strokeWidth={1.75} className="shrink-0 text-accent-strong" />
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{voz.titulos.compraTitulo}</span>
                <ChevronRight size={16} className="shrink-0 text-ink-faint" />
              </Link>
            )}
            <Link
              href="/orcamento/contas?nova=1"
              onClick={() => {
                trackEvent("conta_a_pagar", "/registrar");
                onClose();
              }}
              className="flex min-h-12 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <CalendarClock size={18} strokeWidth={1.75} className="shrink-0 text-accent-strong" />
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{voz.titulos.contasRegistrar}</span>
              <ChevronRight size={16} className="shrink-0 text-ink-faint" />
            </Link>
          </div>
        </div>
      )}

      {mode === "import" && <StatementImport onDone={onClose} otherProfiles={otherProfiles} />}

      {mode === "voice" && (
        <VoiceRecorder
          onParsed={(result) => {
            setParsed(result);
            setMode("type");
          }}
        />
      )}

      {mode === "type" && (
        <EntryForm
          year={year}
          month={month}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goals}
          layout="stacked"
          onSuccess={onClose}
          defaultDescription={parsed && voiceSubcategory(parsed, kind) ? undefined : parsed?.description}
          defaultSubcategory={parsed ? voiceSubcategory(parsed, kind) : undefined}
          defaultAmount={parsed?.amount ?? undefined}
          defaultCurrency={parsed?.currency ?? undefined}
          defaultCategory={parsed?.category}
          defaultParentCategory={parsed?.parentCategory ?? undefined}
        />
      )}
      </div>
    </Modal>
  );
}

/**
 * O parser de voz devolve a palavra-chave ("Farmácia", "Salário") como descrição. Quando ela
 * é um dos tipos conhecidos, vira o chip de Tipo, e a descrição fica livre pro que a pessoa
 * quiser dizer a mais.
 */
function voiceSubcategory(parsed: ParsedVoiceEntry, kind: ProfileKind): string | undefined {
  const label = parsed.description.trim();
  if (!label) return undefined;
  const pool = parsed.category === "INCOME" ? incomeTypesFor(kind) : parsed.parentCategory ? subcategoriesFor(kind, parsed.parentCategory) : [];
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return pool.find((t) => norm(t) === norm(label) || norm(t).startsWith(norm(label)));
}
