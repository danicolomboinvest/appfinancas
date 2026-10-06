"use client";

import { useState, useTransition } from "react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { useToast } from "@/components/ui/toast-context";
import { salvarLimiteDoCartaoAction } from "./actions";

/** Definir, mudar ou tirar o limite do cartão. */
export function FormDoLimite({ limite }: { limite: number | null }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const { showToast, showError } = useToast();
  const [valor, setValor] = useState<number | undefined>(limite ?? undefined);
  const [salvando, startTransition] = useTransition();

  const salvar = (novo: number | null) =>
    startTransition(async () => {
      if (novo !== null && !(novo > 0)) {
        showError(t.limInvalido);
        return;
      }
      const r = await salvarLimiteDoCartaoAction(novo);
      if (!r.ok) showError(t.limInvalido);
      else {
        showToast(novo === null ? t.limRemovido : t.limSalvo);
        if (novo === null) setValor(undefined);
      }
    });

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-body font-semibold text-ink">{limite === null ? t.limPergunta : t.limMudar}</h2>
      <CurrencyInputControlled label={t.limCampo} value={valor} onChange={setValor} />
      <p className="text-caption text-ink-muted">{t.limCampoHint}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" disabled={salvando} className="w-full sm:w-fit" onClick={() => salvar(valor ?? 0)}>
          {t.limSalvar}
        </Button>
        {limite !== null && (
          <Button type="button" variant="secondary" disabled={salvando} className="w-full sm:w-fit" onClick={() => salvar(null)}>
            {t.limRemover}
          </Button>
        )}
      </div>
    </Card>
  );
}
