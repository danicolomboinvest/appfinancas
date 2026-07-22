"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Briefcase, Plus, Sparkles, Target, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SEEN_KEY = "welcome-tour-seen";

type TourStep = {
  icon: LucideIcon;
  /** Cor do círculo do ícone — mesma linguagem do CategoryIcon (fundo translúcido + cor cheia). */
  color: string;
  title: string;
  text: string;
};

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    color: "var(--color-accent)",
    title: "Boas-vindas ao SPI Finance",
    text: "Seu dinheiro, suas metas e seus investimentos em um só lugar. Um tour rapidinho de 30 segundos e você já sai usando.",
  },
  {
    icon: Plus,
    color: "var(--color-accent)",
    title: "Registre tudo pelo botão +",
    text: "O botão dourado no centro da barra é o coração do app: digite um gasto, fale por áudio ou importe o extrato do banco — sem planilha.",
  },
  {
    icon: ArrowLeftRight,
    color: "var(--color-success)",
    title: "Fluxo Financeiro",
    text: "Renda, gastos e aportes do mês, com orçamento por categoria e um alerta quando você está gastando rápido demais.",
  },
  {
    icon: Target,
    color: "var(--color-cat-saude)",
    title: "Metas e Reserva",
    text: "Crie metas (viagem, casa, reserva de emergência) e veja quanto aportar por mês pra chegar lá — o app acompanha o ritmo sozinho.",
  },
  {
    icon: Briefcase,
    color: "var(--color-info)",
    title: "Carteira de Investimentos",
    text: "Cadastre ou importe seus ativos da corretora, acompanhe o lucro e compare com a sua estratégia ideal. Dica: dá pra puxar o preço médio direto da sua declaração de IR.",
  },
];

/**
 * Tour de boas-vindas na primeira entrada (uma vez por aparelho, mesma mecânica do
 * OnboardingChecklist): 5 passos curtos apresentando as áreas do app. Complementa o checklist
 * de primeiros passos — o tour explica O QUE cada área é; o checklist guia O QUE FAZER primeiro.
 */
export function WelcomeTour() {
  const [open, setOpen] = useState(false); // começa fechado até ler o localStorage (evita piscar)
  const [step, setStep] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage, API externa ao React
    if (window.localStorage.getItem(SEEN_KEY) !== "1") setOpen(true);
  }, []);

  if (!open) return null;

  function finish() {
    window.localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/70" aria-hidden />
      <div className="glass relative z-10 w-full max-w-md rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-6">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${current.color} 18%, transparent)`, color: current.color }}
        >
          <Icon size={30} strokeWidth={1.9} />
        </div>

        <h2 className="mt-4 text-center text-xl font-semibold tracking-tight text-ink">{current.title}</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-ink-muted">{current.text}</p>

        {/* Pontos de progresso */}
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Passo ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-5 bg-accent" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" onClick={() => (isLast ? finish() : setStep(step + 1))} className="w-full">
            {isLast ? "Começar a usar" : "Avançar"}
          </Button>
          {!isLast && (
            <Button type="button" variant="ghost" size="sm" onClick={finish} className="w-full">
              Pular tour
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
