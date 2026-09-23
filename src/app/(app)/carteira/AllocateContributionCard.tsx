"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { PiggyBank, ArrowRight, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CurrencyField } from "@/components/ui/CurrencyField";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { allocateContributionAction } from "./contribution-actions";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type AllocatableAsset = { id: string; name: string; ticker: string | null; goalName: string | null; color: string };

/** Quantos ativos aparecem antes do "ver todos": lista de 20 campos no celular é um formulário, não uma pergunta. */
const VISIVEIS = 6;

/**
 * "Você aportou R$ X em setembro. Em quais ativos entrou?"
 *
 * É a ponte que faltava entre o Fluxo e a Carteira. A pessoa lançava o aporte no mês, vinha pra
 * carteira e não via nada mudar — parecia que o app tinha perdido o dinheiro dela. Aqui o valor
 * que ela já lançou aparece esperando destino; ao dizer em quais ativos entrou, o ativo cresce,
 * a meta ligada àquele ativo anda junto, e o mês continua com o mesmo número de sempre (o aporte
 * não é lançado de novo — este card não cria dinheiro, só diz pra onde o que existe foi).
 */
export function AllocateContributionCard({
  month,
  pending,
  assets,
  goalOfMonth,
}: {
  month: number;
  pending: number;
  assets: AllocatableAsset[];
  /** Meta que a pessoa escolheu ao lançar o aporte, se escolheu. */
  goalOfMonth: string | null;
}) {
  const { key: tema, voz } = useProfileTheme();
  const t = voz.titulos;
  const money = useMoney();
  const { showToast } = useToast();
  const [valores, setValores] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [pronto, setPronto] = useState<{ assets: number; goals: { name: string; amount: number }[] } | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  // Fechado por padrão: a carteira já é uma tela cheia, e a pergunta importante é só "você
  // aportou tanto, confere?". A lista de ativos com um campo cada só aparece pra quem toca.
  const [aberto, setAberto] = useState(false);

  const distribuido = useMemo(() => Object.values(valores).reduce((s, v) => s + (v || 0), 0), [valores]);
  // Quem já recebeu valor nunca some da lista, mesmo que estivesse escondido atrás do "ver todos".
  const visiveis = verTodos ? assets : assets.filter((a, i) => i < VISIVEIS || (valores[a.id] ?? 0) > 0);
  const falta = Math.round((pending - distribuido) * 100) / 100;

  if (pronto) {
    return (
      <Card className="flex flex-col gap-1 border-success/30 bg-success-soft/40 p-4">
        <p className="text-[15px] font-semibold text-success">{t.cartAporteProntoTitulo}</p>
        <p className="text-sm text-ink-muted">
          {t.cartAporteEntrouEm(MESES[month - 1], pronto.assets)}
          {pronto.goals.length > 0 && (
            <> {t.cartMetasAndaram(pronto.goals.map((g) => `${g.name} +${money(g.amount, { round: true })}`).join(", "))}</>
          )}
        </p>
      </Card>
    );
  }

  if (assets.length === 0) {
    return (
      <Card className="flex flex-col gap-2 border-accent/30 bg-accent-soft/30 p-4">
        <p className="text-[15px] font-semibold text-ink">{t.cartVoceAportou(money(pending, { round: true }), MESES[month - 1])}</p>
        <p className="text-sm text-ink-muted">{t.cartCadastreAtivo}</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4 border-accent/30 bg-accent-soft/30 p-4">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex items-center gap-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <PiggyBank size={18} strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">
            {t.cartVoceAportou(money(pending, { round: true }), MESES[month - 1])}
          </span>
          <span className="block text-caption text-ink-muted">{aberto ? t.cartDigaQuanto : t.cartToquePraDizer}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-ink-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {!aberto && (
        <p className="text-caption text-ink-faint">{t.cartEnquantoNaoDisser(goalOfMonth)}</p>
      )}

      {aberto && (
      <>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {visiveis.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
            <CategoryIcon icon={PiggyBank} color={a.color} size={36} emoji={emojiDaCategoria(tema, { kind: "investment" })} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{a.ticker ?? a.name}</p>
              {a.goalName && <p className="truncate text-caption text-ink-faint">{t.cartMetaDoAtivo(a.goalName)}</p>}
            </div>
            <CurrencyField
              label={t.cartQuantoEntrouEm(a.ticker ?? a.name)}
              name={`aporte_${a.id}`}
              onValueChange={(v) => setValores((prev) => ({ ...prev, [a.id]: v }))}
              className="w-32 [&_label]:sr-only"
            />
          </li>
        ))}
      </ul>

      {!verTodos && assets.length > visiveis.length && (
        <button type="button" onClick={() => setVerTodos(true)} className="w-fit text-sm font-medium text-accent-strong hover:underline">
          {t.cartVerOutros(assets.length - visiveis.length)}
        </button>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm font-semibold ${falta < -0.01 ? "text-danger" : "text-ink-muted"}`}>
          {falta > 0.01
            ? t.cartFaltaDizer(money(falta, { round: true }))
            : falta < -0.01
              ? t.cartPassouDoAporte(money(-falta, { round: true }))
              : t.cartTudoDistribuido}
        </p>
        <Button
          type="button"
          size="sm"
          disabled={isPending || distribuido <= 0 || falta < -0.01}
          onClick={() =>
            startTransition(async () => {
              const res = await allocateContributionAction(
                Object.entries(valores)
                  .filter(([, v]) => v > 0)
                  .map(([assetId, amount]) => ({ assetId, amount })),
              );
              if (!res.ok) {
                showToast(res.error);
                return;
              }
              setPronto({ assets: res.assets, goals: res.goals });
              showToast(t.cartAporteAplicado);
            })
          }
        >
          {isPending ? t.cartAplicandoAporte : t.cartAtualizarCarteira}
        </Button>
      </div>

      <Link href="/carteira#ativos" className="flex w-fit items-center gap-1 text-caption text-ink-faint hover:text-ink">
        {t.cartAtivoNaoEstaAqui} <ArrowRight size={12} />
      </Link>
      </>
      )}
    </Card>
  );
}
