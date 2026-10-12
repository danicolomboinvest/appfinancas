"use client";

import { useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { updateNotificationsAction } from "./actions";

type Prefs = { notifyBudgetAlerts: boolean; notifyLateGoals: boolean; notifyMonthlyRecap: boolean };

/** "Por e-mail e no app" (protótipo): três chaves que salvam no toque, sem botão Salvar. */
export function NotificationsForm({ defaults }: { defaults: Prefs }) {
  const [prefs, setPrefs] = useState(defaults);
  const [, iniciar] = useTransition();
  const { showError } = useToast();
  const { titulos: t } = useProfileTheme().voz;

  function trocar(chave: keyof Prefs, v: boolean) {
    const antes = prefs;
    const novo = { ...prefs, [chave]: v };
    setPrefs(novo);
    iniciar(async () => {
      const fd = new FormData();
      for (const [k, on] of Object.entries(novo)) if (on) fd.set(k, "on");
      const r = await updateNotificationsAction({}, fd).catch(() => ({ error: t.acaoFalhou }));
      if (r.error) {
        setPrefs(antes);
        showError(r.error);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)] [&>*+*]:border-t [&>*+*]:border-border">
      <Interruptor ligado={prefs.notifyMonthlyRecap} aoMudar={(v) => trocar("notifyMonthlyRecap", v)} titulo={t.cfgResumoEmail} sub={t.cfgResumoEmailDica} />
      <Interruptor ligado={prefs.notifyBudgetAlerts} aoMudar={(v) => trocar("notifyBudgetAlerts", v)} titulo={t.cfgAlertasOrcamento} sub={t.cfgAlertasOrcamentoDica} />
      <Interruptor ligado={prefs.notifyLateGoals} aoMudar={(v) => trocar("notifyLateGoals", v)} titulo={t.cfgMetasAtrasadas} sub={t.cfgMetasAtrasadasDica} />
    </div>
  );
}
