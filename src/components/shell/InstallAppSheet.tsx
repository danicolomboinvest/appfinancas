"use client";

import { useState } from "react";
import { Share, MoreVertical, PlusSquare, Check, Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import type { Voz } from "@/lib/profiles/voice";
import { partesDoTexto } from "@/lib/profiles/textos/shell";
import {
  useCanInstallNatively,
  useInstallPlatform,
  triggerNativeInstall,
  type InstallPlatform,
} from "@/lib/pwa/install";

type Step = { icon: typeof Share; text: string };

/**
 * Passo a passo por aparelho/navegador — o caminho MUDA entre Safari e Chrome no iPhone. Os
 * ícones são daqui; as frases vêm da voz do tema, com o nome do botão marcado em `**` pra
 * virar negrito na tela.
 */
function stepsFor(platform: InstallPlatform, voz: Voz): Step[] {
  if (platform === "ios-safari") {
    const [um, dois, tres] = voz.titulos.uiInstalarPassosSafari;
    return [
      { icon: Share, text: um },
      { icon: PlusSquare, text: dois },
      { icon: Check, text: tres },
    ];
  }
  if (platform === "ios-outro") {
    const [um, dois, tres] = voz.titulos.uiInstalarPassosIosOutro;
    return [
      { icon: MoreVertical, text: um },
      { icon: Share, text: dois },
      { icon: Check, text: tres },
    ];
  }
  // Android (e desktop sem instalação nativa disponível).
  const [um, dois, tres] = voz.titulos.uiInstalarPassosAndroid;
  return [
    { icon: MoreVertical, text: um },
    { icon: PlusSquare, text: dois },
    { icon: Check, text: tres },
  ];
}

/**
 * Tutorial de "instalar na tela de início". No Android o navegador permite instalação nativa:
 * mostramos um botão que instala de verdade, num toque. No iPhone a Apple não expõe API pra
 * isso, então é o passo a passo — e ele é diferente no Safari e no Chrome, por isso a detecção.
 */
export function InstallAppSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const platform = useInstallPlatform();
  const canInstallNatively = useCanInstallNatively();
  const { voz } = useProfileTheme();
  const t = voz.titulos;
  const [installing, setInstalling] = useState(false);
  const steps = stepsFor(platform, voz);

  async function handleInstall() {
    setInstalling(true);
    const outcome = await triggerNativeInstall();
    setInstalling(false);
    if (outcome === "accepted") onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={t.uiInstalarTitulo}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">{t.uiInstalarIntro}</p>

        {canInstallNatively ? (
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={handleInstall} disabled={installing}>
              <Smartphone className="size-4" aria-hidden />
              {installing ? t.uiInstalando : t.uiInstalarAgora}
            </Button>
            <p className="text-xs text-ink-faint">{t.uiInstalarNativoDica}</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-ink-muted">
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 items-start gap-2 pt-0.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
                    <span className="text-sm leading-snug text-ink">
                      {partesDoTexto(step.text).map((p, i) => (p.negrito ? <strong key={i}>{p.texto}</strong> : p.texto))}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {platform === "desktop" && !canInstallNatively && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">{t.uiInstalarNoComputador}</p>
        )}
      </div>
    </Modal>
  );
}
