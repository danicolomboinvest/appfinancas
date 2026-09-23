"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { ProfileKind } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";
import { PROFILE_KIND_LABEL, PROFILE_KINDS_ESCOLHIVEIS } from "@/lib/repositories/profile.repo";
import { comecarAction } from "./actions";

/**
 * A primeira tela de quem acabou de criar a conta: de quem é esse dinheiro, e como o app deve
 * falar com você. É a mesma escolha da tela de perfis, só que oferecida antes de qualquer
 * outra coisa — a Dani não queria que todo mundo caísse no Padrão sem saber que existe
 * opção. Dá pra mudar depois em Perfis financeiros.
 */
export function EscolhaInicial({ nome }: { nome: string | undefined }) {
  const [tipo, setTipo] = useState<ProfileKind>("PESSOAL");
  const [tema, setTema] = useState("padrao");
  const [pendente, comecar] = useTransition();
  const primeiroNome = nome?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold text-ink">De quem é esse dinheiro?</h2>
        <div className="flex flex-wrap gap-2">
          {PROFILE_KINDS_ESCOLHIVEIS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTipo(k)}
              aria-pressed={tipo === k}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${tipo === k ? "border-accent bg-accent-soft text-ink" : "border-border text-ink-muted hover:text-ink"}`}
            >
              {PROFILE_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="text-caption text-ink-faint">
          {tipo === "EMPRESA" ? "Empresa fala de faturamento, custos, DRE e caixa. " : tipo === "CASAL" ? "Casal é o dinheiro dos dois num lugar só. " : ""}
          Dá pra criar outros perfis depois, cada um com o próprio dinheiro.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold text-ink">Como você quer que o app fale com você?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROFILE_THEMES.map((opcao) => {
            const escolhido = tema === opcao.key;
            const voz = vozDoTema(opcao.key, tipo);
            return (
              <button
                key={opcao.key}
                type="button"
                onClick={() => setTema(opcao.key)}
                aria-pressed={escolhido}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${escolhido ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"}`}
              >
                {/* A mesma prévia da tela de perfis: fundo, tinta, destaque e a primeira frase. */}
                <span className="flex w-24 shrink-0 flex-col gap-1 overflow-hidden rounded-lg border p-2" style={{ backgroundColor: opcao.paleta.canvas, borderColor: opcao.paleta.borderStrong }}>
                  <span className="truncate text-[10px] font-semibold leading-tight" style={{ color: opcao.paleta.ink }}>
                    {voz.saudacao("manha", primeiroNome) ?? "Platina II · 940 pts"}
                  </span>
                  <span className="h-1.5 w-3/5 rounded-full" style={{ backgroundColor: opcao.paleta.accent }} />
                  <span className="truncate text-[9px] leading-tight" style={{ color: opcao.paleta.inkMuted }}>{voz.rotuloResultado}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{opcao.label}</span>
                  <span className="block text-caption text-ink-muted">{opcao.descricao}</span>
                </span>
                {escolhido && <Check size={16} className="shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      </section>

      <Button type="button" disabled={pendente} onClick={() => comecar(() => comecarAction({ kind: tipo, theme: tema }))} className="w-full sm:w-fit">
        {pendente ? "Preparando…" : "Começar"}
      </Button>
    </div>
  );
}
