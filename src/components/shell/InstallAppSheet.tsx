"use client";

import { useState } from "react";
import { Share, MoreVertical, PlusSquare, Check, Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  useCanInstallNatively,
  useInstallPlatform,
  triggerNativeInstall,
  type InstallPlatform,
} from "@/lib/pwa/install";

type Step = { icon: typeof Share; text: React.ReactNode };

/** Passo a passo por aparelho/navegador — o caminho MUDA entre Safari e Chrome no iPhone. */
function stepsFor(platform: InstallPlatform): Step[] {
  if (platform === "ios-safari") {
    return [
      {
        icon: Share,
        text: (
          <>
            Toque no botão <strong>Compartilhar</strong> — o quadradinho com uma seta para cima, na barra de baixo.
          </>
        ),
      },
      {
        icon: PlusSquare,
        text: (
          <>
            Role a lista para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
          </>
        ),
      },
      {
        icon: Check,
        text: (
          <>
            Toque em <strong>Adicionar</strong>, no canto de cima. Pronto: o ícone aparece na sua tela inicial.
          </>
        ),
      },
    ];
  }
  if (platform === "ios-outro") {
    return [
      {
        icon: MoreVertical,
        text: (
          <>
            Toque no menu do navegador (<strong>⋯</strong> ou <strong>⋮</strong>), no canto da tela.
          </>
        ),
      },
      {
        icon: Share,
        text: (
          <>
            Toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
          </>
        ),
      },
      {
        icon: Check,
        text: (
          <>
            Confirme em <strong>Adicionar</strong>. Se não encontrar essa opção, abra este site no{" "}
            <strong>Safari</strong> — por lá o caminho é mais direto.
          </>
        ),
      },
    ];
  }
  // Android (e desktop sem instalação nativa disponível).
  return [
    {
      icon: MoreVertical,
      text: (
        <>
          Toque no menu <strong>⋮</strong>, no canto superior direito do navegador.
        </>
      ),
    },
    {
      icon: PlusSquare,
      text: (
        <>
          Toque em <strong>Instalar aplicativo</strong> (em alguns aparelhos aparece como{" "}
          <strong>Adicionar à tela inicial</strong>).
        </>
      ),
    },
    {
      icon: Check,
      text: (
        <>
          Confirme em <strong>Instalar</strong>. O ícone vai para a sua tela inicial.
        </>
      ),
    },
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
  const [installing, setInstalling] = useState(false);
  const steps = stepsFor(platform);

  async function handleInstall() {
    setInstalling(true);
    const outcome = await triggerNativeInstall();
    setInstalling(false);
    if (outcome === "accepted") onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Instalar na tela de início">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-muted">
          O SPI Finance funciona como aplicativo: ícone próprio na tela inicial e tela cheia, sem a barra do navegador.
          Não ocupa espaço como um app de loja e continua se atualizando sozinho.
        </p>

        {canInstallNatively ? (
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={handleInstall} disabled={installing}>
              <Smartphone className="size-4" aria-hidden />
              {installing ? "Instalando..." : "Instalar agora"}
            </Button>
            <p className="text-xs text-ink-faint">
              Seu navegador permite instalar direto: toque no botão e confirme na janelinha que aparecer.
            </p>
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
                    <span className="text-sm leading-snug text-ink">{step.text}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {platform === "desktop" && !canInstallNatively && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
            Você está no computador. Para ter o app no celular, abra o site pelo navegador do telefone e repita esses
            passos por lá.
          </p>
        )}
      </div>
    </Modal>
  );
}
