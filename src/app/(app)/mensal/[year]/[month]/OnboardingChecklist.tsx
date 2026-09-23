"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

const DISMISS_KEY = "onboarding-dismissed";

type Step = { label: string; done: boolean; href: string };

/**
 * Guia dos primeiros passos: aparece pra quem ainda não completou o básico e some sozinho
 * quando os 3 passos estão feitos (ou se a pessoa dispensar, lembrado no aparelho).
 */
export function OnboardingChecklist({
  hasEntry,
  hasBudget,
  hasAsset,
}: {
  hasEntry: boolean;
  hasBudget: boolean;
  hasAsset: boolean;
}) {
  const [dismissed, setDismissed] = useState(true); // começa oculto até ler o localStorage (evita piscar)
  // O que o guia diz vem da voz do tema; o que ele checa (os três passos) é igual nos sete.
  const { voz } = useProfileTheme();

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const steps: Step[] = [
    // O formulário inline (#lancamento) não existe mais: o registro vive na gaveta do "+".
    { label: voz.titulos.uiPassoRegistrar, done: hasEntry, href: "#registrar" },
    { label: voz.titulos.uiPassoOrcamento, done: hasBudget, href: "/orcamento" },
    { label: voz.titulos.uiPassoCarteira, done: hasAsset, href: "/carteira" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (dismissed || doneCount === steps.length) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-premium-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          {voz.titulos.uiPrimeirosPassos} <span className="font-normal text-ink-faint">({doneCount}/{steps.length})</span>
        </p>
        <button type="button" onClick={dismiss} aria-label={voz.titulos.uiDispensarGuia} className="text-ink-faint hover:text-ink">
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              href={step.href}
              onClick={(e) => {
                if (step.href !== "#registrar") return;
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("spi:registrar"));
              }}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                step.done ? "text-ink-faint line-through" : "bg-surface-2 text-ink hover:bg-surface-hover"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  step.done ? "border-success bg-success-soft text-success" : "border-border-strong text-transparent"
                }`}
              >
                <Check size={12} strokeWidth={2.5} />
              </span>
              {step.label}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
