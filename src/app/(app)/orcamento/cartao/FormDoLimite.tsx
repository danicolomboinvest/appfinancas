"use client";

import { Explica } from "@/components/ui/Explica";

import { useEffect, useState, useTransition } from "react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CurrencyInputControlled } from "@/components/ui/CurrencyInputControlled";
import { ErroNoBotao, useErroNoBotao } from "@/components/ui/ErroNoBotao";
import { salvarLimiteDoCartaoAction } from "./actions";

/** Definir, mudar ou tirar o limite do cartão. */
export function FormDoLimite({ limite }: { limite: number | null }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [valor, setValor] = useState<number | undefined>(limite ?? undefined);
  const [salvando, startTransition] = useTransition();
  // Sem aviso (14/10/2026): o cartão fica na tela, então o próprio botão diz "Salvo" por 2 s.
  // Erro embaixo dos botões, até a próxima tentativa.
  const erro = useErroNoBotao();
  const [salvou, setSalvou] = useState(false);
  useEffect(() => {
    if (!salvou) return;
    const id = window.setTimeout(() => setSalvou(false), 2000);
    return () => window.clearTimeout(id);
  }, [salvou]);

  const salvar = (novo: number | null) => {
    erro.limpar();
    startTransition(async () => {
      if (novo !== null && !(novo > 0)) {
        erro.falhou(t.limInvalido);
        return;
      }
      const r = await salvarLimiteDoCartaoAction(novo);
      if (!r.ok) erro.falhou(t.limInvalido);
      else if (novo === null) setValor(undefined);
      else setSalvou(true);
    });
  };

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="flex items-center gap-1.5 text-body font-semibold text-ink">
        {limite === null ? t.limPergunta : t.limMudar}
        <Explica>{t.limCampoHint}</Explica>
      </h2>
      <CurrencyInputControlled label={t.limCampo} value={valor} onChange={setValor} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" disabled={salvando} className="w-full sm:w-fit" onClick={() => salvar(valor ?? 0)}>
          {salvou ? "Salvo" : t.limSalvar}
        </Button>
        {limite !== null && (
          <Button type="button" variant="secondary" disabled={salvando} className="w-full sm:w-fit" onClick={() => salvar(null)}>
            {t.limRemover}
          </Button>
        )}
      </div>
      <ErroNoBotao erro={erro.erro} lado="esquerda" />
    </Card>
  );
}
