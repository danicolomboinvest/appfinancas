"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { Field } from "@/components/ui/Field";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { useToast } from "@/components/ui/toast-context";
import { apagarContaAction, salvarContaAction } from "./actions";
import type { ContaSerial } from "./LinhaDaConta";

/** Uma opção liga/desliga com a linha inteira tocável (44px) e a explicação embaixo. */
function Opcao({ checked, onChange, titulo, hint }: { checked: boolean; onChange: (v: boolean) => void; titulo: string; hint: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-accent" />
      <span>
        <span className="block text-sm font-medium text-ink">{titulo}</span>
        <span className="block text-caption text-ink-muted">{hint}</span>
      </span>
    </label>
  );
}

/** Nova conta ou edição. `hoje` é o padrão do vencimento de uma conta nova. */
export function FormDaConta({ conta, hoje, onFeito }: { conta?: ContaSerial; hoje: string; onFeito: () => void }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const { showError } = useToast();
  const router = useRouter();
  const [salvando, startTransition] = useTransition();

  const [nome, setNome] = useState(conta?.nome ?? "");
  const [valor, setValor] = useState<number | undefined>(conta?.valor ?? undefined);
  const [valorMuda, setValorMuda] = useState(conta ? conta.valor === null : false);
  const [vencimento, setVencimento] = useState(conta?.vencimento ?? hoje);
  const [repete, setRepete] = useState(conta?.repete ?? true);
  const [lembrar, setLembrar] = useState(conta?.lembrar ?? true);
  const [erro, setErro] = useState<string | null>(null);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valorMuda && !(valor && valor > 0)) {
      setErro(`Coloque o valor ou marque "${t.contasValorMuda}".`);
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await salvarContaAction({ id: conta?.id, nome, valor: valorMuda ? null : (valor ?? null), vencimento, repete, lembrar });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
      onFeito();
    });
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <Field label={t.contasNome} value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t.contasNomeExemplo} maxLength={80} required autoFocus={!conta} />

      <div className="flex flex-col gap-1">
        {!valorMuda && <CurrencyInputControlled label={t.contasValor} value={valor} onChange={setValor} />}
        <Opcao checked={valorMuda} onChange={setValorMuda} titulo={t.contasValorMuda} hint={t.contasValorMudaHint} />
      </div>

      <Field label={t.contasVencimento} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} required />

      <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface px-4 py-2">
        <Opcao checked={repete} onChange={setRepete} titulo={t.contasRepete} hint={t.contasRepeteHint} />
        <Opcao checked={lembrar} onChange={setLembrar} titulo={t.contasLembrar} hint={t.contasLembrarHint} />
      </div>

      {erro && <p className="text-caption text-danger">{erro}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {conta ? (
          <DeleteButton
            label={t.contasApagar}
            onDelete={async () => {
              try {
                await apagarContaAction(conta.id);
                router.refresh();
                onFeito();
              } catch {
                showError("Não deu para apagar. Tente de novo.");
              }
            }}
          />
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onFeito}>
            {t.contasCancelar}
          </Button>
          <Button type="submit" disabled={salvando}>
            {t.contasSalvar}
          </Button>
        </div>
      </div>
    </form>
  );
}
