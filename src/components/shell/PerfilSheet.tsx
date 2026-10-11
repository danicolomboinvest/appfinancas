"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight, LogOut, Mail, Smartphone } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ProfileIcon } from "@/components/profiles/ProfileIcon";
import type { PerfilResumo } from "@/components/profiles/perfil-resumo";
import { trocarPerfilAction } from "@/app/(app)/perfis/actions";
import { useValoresOcultos } from "@/components/money/MoneyProvider";
import { setThemeAction } from "./theme-actions";
import { aplicarModo } from "./ThemeSync";
import { linkDoSuporte } from "@/lib/support/whatsapp-link";
import { useIsStandalone } from "@/lib/pwa/install";
import { useToast } from "@/components/ui/toast-context";

const TIPO: Record<string, string> = { PESSOAL: "Pessoal", CASAL: "Casal", EMPRESA: "Empresa" };

/** A foto da conta, ou a primeira letra do nome num círculo (o avatar do app todo). */
export function AvatarDaConta({ nome, foto, size = 44 }: { nome: string; foto: string | null; size?: number }) {
  const inicial = (nome.trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto da própria conta, já otimizada no envio
        <img src={foto} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        inicial
      )}
    </span>
  );
}

/**
 * O perfil pela foto (versão nova, 11/10/2026): tocar no avatar do topo abre a conta. Troca de
 * perfil (Pessoal, Casal, Empresa), claro ou escuro, esconder valores, dados, ajuda e sair.
 * Tudo que era do "Mais" e do seletor de perfil no topo mora aqui.
 */
export function PerfilSheet({
  open,
  onClose,
  nome,
  email,
  foto,
  perfis,
  modo,
  onLogout,
  onOpenInstall,
}: {
  open: boolean;
  onClose: () => void;
  nome: string;
  email?: string;
  foto: string | null;
  perfis: PerfilResumo[];
  modo: "light" | "dark";
  onLogout: () => void;
  onOpenInstall: () => void;
}) {
  const [trocando, iniciarTroca] = useTransition();
  const [modoAtual, setModoAtual] = useState<"light" | "dark">(modo);
  const { ocultos, alternar } = useValoresOcultos();
  const instalado = useIsStandalone();
  const { showError } = useToast();
  const ativo = perfis.find((p) => p.isDefault) ?? perfis[0];

  function trocar(id: string) {
    if (id === ativo?.id) return;
    iniciarTroca(async () => {
      const r = await trocarPerfilAction(id);
      if (!r.ok) showError(r.error);
      else onClose();
    });
  }

  function escolherModo(m: "light" | "dark") {
    setModoAtual(m);
    aplicarModo(m);
    try {
      localStorage.setItem("theme", m);
    } catch {
      // Modo privado: vale para esta sessão.
    }
    void setThemeAction(m);
  }

  const linha = "flex min-h-12 w-full items-center gap-3 border-t border-border px-4 py-2 text-left text-[15px] text-ink first:border-t-0 hover:bg-surface-hover";

  return (
    <Modal open={open} onClose={onClose} title="Perfil">
      <div className="flex flex-col items-center gap-1 pb-5 pt-1 text-center">
        <AvatarDaConta nome={nome} foto={foto} size={84} />
        <p className="titulo-tema mt-3 text-xl font-medium text-ink">{nome}</p>
        {email && <p className="max-w-full truncate text-sm text-ink-muted">{email}</p>}
      </div>

      {perfis.length > 0 && (
        <>
          <p className="px-1 pb-2 text-caption font-medium text-ink-muted">Meus perfis</p>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {perfis.map((p) => {
              const eAtivo = p.id === ativo?.id;
              return (
                <button key={p.id} type="button" onClick={() => trocar(p.id)} disabled={trocando} className={`${linha} disabled:opacity-60`}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                    <ProfileIcon name={p.icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className={`block text-caption ${eAtivo ? "text-accent-strong" : "text-ink-muted"}`}>{eAtivo ? "Em uso" : (TIPO[p.kind ?? ""] ?? "Perfil")}</span>
                  </span>
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${eAtivo ? "bg-ink text-canvas" : "border border-border-strong"}`} aria-hidden>
                    {eAtivo && <Check size={14} strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
            <Link href="/perfis" onClick={onClose} className={linha}>
              <span className="flex-1">Criar ou organizar perfis</span>
              <ChevronRight size={18} className="text-ink-faint" aria-hidden />
            </Link>
          </div>
        </>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
          <span className="text-[15px] text-ink">Aparência</span>
          <div className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Aparência">
            {(["light", "dark"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modoAtual === m}
                onClick={() => modoAtual !== m && escolherModo(m)}
                className={`min-h-9 rounded-full px-3.5 text-sm transition-colors ${modoAtual === m ? "bg-ink font-medium text-canvas" : "text-ink-muted hover:text-ink"}`}
              >
                {m === "light" ? "Claro" : "Escuro"}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={alternar} aria-pressed={ocultos} className="flex min-h-12 w-full items-center justify-between gap-3 border-t border-border px-4 py-2 text-left">
          <span className="text-[15px] text-ink">Esconder valores</span>
          <span className="text-sm text-ink-muted">{ocultos ? "Ligado" : "Desligado"}</span>
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        <Link href="/configuracoes" onClick={onClose} className={linha}>
          <span className="flex-1">Meus dados e configurações</span>
          <ChevronRight size={18} className="text-ink-faint" aria-hidden />
        </Link>
        {!instalado && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenInstall();
            }}
            className={linha}
          >
            <Smartphone size={18} strokeWidth={1.6} className="text-ink-muted" aria-hidden />
            <span className="flex-1">Colocar na tela de início</span>
          </button>
        )}
        <a href={linkDoSuporte("Oi! Preciso de ajuda com o SPI Finance.")} className={linha}>
          <Mail size={18} strokeWidth={1.6} className="text-ink-muted" aria-hidden />
          <span className="flex-1">Fale com a gente</span>
        </a>
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className={`${linha} text-ink-muted hover:text-danger`}
        >
          <LogOut size={18} strokeWidth={1.6} aria-hidden />
          <span className="flex-1">Sair</span>
        </button>
      </div>
    </Modal>
  );
}
