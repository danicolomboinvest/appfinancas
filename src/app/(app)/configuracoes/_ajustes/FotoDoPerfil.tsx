"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast-context";
import { AvatarDaConta } from "@/components/shell/PerfilSheet";
import { useAppNativo } from "@/components/ui/useAppNativo";
import { FOTO_SO_NO_NAVEGADOR } from "@/lib/apple/app-nativo";
import { removerFotoAction, salvarFotoAction } from "./conta-actions";

const LADO = 512;

/** Recorta o círculo visível (zoom e deslocamento em % do lado) num quadrado de 512 px, em JPEG. */
async function recortar(src: string, zoom: number, x: number, y: number): Promise<Blob> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const menor = Math.min(img.naturalWidth, img.naturalHeight);
  const lado = menor / zoom;
  const cx = img.naturalWidth / 2 - (x / 100) * menor;
  const cy = img.naturalHeight / 2 - (y / 100) * menor;
  const c = document.createElement("canvas");
  c.width = LADO;
  c.height = LADO;
  c.getContext("2d")!.drawImage(img, cx - lado / 2, cy - lado / 2, lado, lado, 0, 0, LADO, LADO);
  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("sem imagem"))), "image/jpeg", 0.86));
}

/**
 * A foto do perfil no topo de Configurações (rodada 25): tocar abre "Escolher foto", "Tirar foto"
 * (quando o aparelho tem câmera) e "Remover". Escolhida, ela centraliza arrastando e ajusta o zoom.
 * Depois de salva, vira o avatar do app todo.
 */
export function FotoDoPerfil({ nome, foto, comBotao = false, tamanho = 76 }: { nome: string; foto: string | null; comBotao?: boolean; tamanho?: number }) {
  const [aberto, setAberto] = useState(false);
  const [cortando, setCortando] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [salvando, iniciar] = useTransition();
  const router = useRouter();
  const { showToast, showError } = useToast();

  const fechar = () => {
    setAberto(false);
    if (cortando) URL.revokeObjectURL(cortando);
    setCortando(null);
  };
  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCortando(URL.createObjectURL(f));
    setZoom(1);
    setPos({ x: 0, y: 0 });
  };
  const limite = 50 * ((zoom - 1) / zoom) + 10;
  const nativo = useAppNativo();

  // No app da loja, sem as permissões de câmera e fotos, escolher imagem derruba o app (iOS):
  // só a foto e o aviso, até a versão nova do app chegar.
  if (nativo) {
    return (
      <div className="flex flex-col items-center gap-2">
        <AvatarDaConta nome={nome} foto={foto} size={tamanho} />
        {comBotao && <p className="max-w-[16rem] text-center text-[13px] text-ink-muted">{FOTO_SO_NO_NAVEGADOR}</p>}
      </div>
    );
  }

  return (
    <>
      {comBotao ? (
        // Na folha da foto e em Configurações: a foto e, logo embaixo, "Trocar foto" em evidência.
        <div className="flex flex-col items-center gap-2.5">
          <button type="button" onClick={() => setAberto(true)} aria-label="Trocar a foto do perfil" className="shrink-0 rounded-full">
            <AvatarDaConta nome={nome} foto={foto} size={tamanho} />
          </button>
          <button type="button" onClick={() => setAberto(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-sm font-medium text-ink">
            <Pencil size={14} aria-hidden /> {foto ? "Trocar foto" : "Pôr uma foto"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAberto(true)} aria-label="Trocar a foto do perfil" className="relative shrink-0 rounded-full">
          <AvatarDaConta nome={nome} foto={foto} size={tamanho} />
          <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-ink text-canvas ring-2 ring-surface" aria-hidden>
            <Pencil size={13} />
          </span>
        </button>
      )}
      <Modal open={aberto} onClose={fechar} title="Foto do perfil">
        {cortando ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative size-56 touch-none overflow-hidden rounded-full bg-surface-2"
              onPointerDown={(e) => {
                arrasto.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const a = arrasto.current;
                if (!a) return;
                const k = 100 / 224 / zoom;
                setPos({ x: Math.max(-limite, Math.min(limite, a.ox + (e.clientX - a.x) * k)), y: Math.max(-limite, Math.min(limite, a.oy + (e.clientY - a.y) * k)) });
              }}
              onPointerUp={() => (arrasto.current = null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local do arquivo escolhido */}
              <img src={cortando} alt="" draggable={false} className="absolute inset-0 size-full object-cover" style={{ transform: `scale(${zoom}) translate(${pos.x}%, ${pos.y}%)` }} />
            </div>
            <label className="flex w-full items-center gap-3 text-sm text-ink-muted">
              Zoom
              <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--color-accent)]" />
            </label>
            <p className="text-[13px] text-ink-muted">Arraste a foto para centralizar.</p>
            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  iniciar(async () => {
                    try {
                      const blob = await recortar(cortando, zoom, pos.x, pos.y);
                      const fd = new FormData();
                      fd.append("foto", new File([blob], "foto.jpg", { type: "image/jpeg" }));
                      const r = await salvarFotoAction(fd);
                      if (!r.ok) return showError(r.erro ?? "Não consegui salvar a foto.");
                      showToast("Foto do perfil trocada");
                      fechar();
                      router.refresh();
                    } catch {
                      showError("Não consegui ler essa foto. Tente outra.");
                    }
                  })
                }
                className="min-h-12 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-60"
              >
                Usar esta foto
              </button>
              <button type="button" onClick={() => setCortando(null)} className="min-h-12 rounded-full bg-surface-2 text-[15px] text-ink">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <AvatarDaConta nome={nome} foto={foto} size={112} />
            <label className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent">
              Escolher foto
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={escolher} className="sr-only" />
            </label>
            <label className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-surface-2 text-[15px] text-ink">
              Tirar foto
              <input type="file" accept="image/*" capture="user" onChange={escolher} className="sr-only" />
            </label>
            {foto && (
              <button
                type="button"
                disabled={salvando}
                onClick={() =>
                  iniciar(async () => {
                    await removerFotoAction();
                    showToast("Foto removida");
                    fechar();
                    router.refresh();
                  })
                }
                className="min-h-12 w-full rounded-full text-[15px] text-danger"
              >
                Remover
              </button>
            )}
            <p className="text-center text-[13px] text-ink-muted">A foto fica guardada na sua conta e só aparece para você.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
