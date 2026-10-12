"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FotoDoPerfil } from "@/app/(app)/configuracoes/_ajustes/FotoDoPerfil";
import { Briefcase, Check, ChevronLeft, ChevronRight, Heart, LogOut, User } from "lucide-react";
import { Interruptor } from "@/components/ui/Interruptor";
import { useValoresOcultos } from "@/components/money/MoneyProvider";
import { setThemeAction } from "./theme-actions";
import type { PerfilResumo } from "@/components/profiles/perfil-resumo";
import { trocarPerfilAction } from "@/app/(app)/perfis/actions";
import { useToast } from "@/components/ui/toast-context";

const TIPO: Record<string, string> = { PESSOAL: "Pessoal", CASAL: "Casal", EMPRESA: "Empresa", CASA: "Casa", PROJETO: "Projeto", OUTRO: "Outro" };
const NOME_DO_TEMA: Record<string, string> = { padrao: "Padrão", girly: "Girly", manifestacao: "Manifestação", titanio: "Titânio" };

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
 * A tela "Perfil" (protótipo aprovado, #perfil), aberta pelo avatar do topo: seta de voltar, a
 * foto com o anel do perfil, nome e e-mail; Meus perfis (um toque troca) e "Criar ou organizar
 * perfis"; Aparência Claro | Escuro; Esconder valores; Meus dados, Minha assinatura,
 * Notificações, Todas as configurações e Sair. A foto continua com "Pôr uma foto" (pedido dela).
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
  const [, iniciar] = useTransition();
  const { showError } = useToast();
  const { ocultos, alternar } = useValoresOcultos();
  const [modoEscolhido, setModoEscolhido] = useState<"light" | "dark" | null>(null);
  const modoAtual = modoEscolhido ?? modo;
  const router = useRouter();
  const ativo = perfis.find((p) => p.isDefault) ?? perfis[0];
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    fecharRef.current?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = antes;
    };
  }, [open, onClose]);

  if (!open) return null;

  function trocar(id: string) {
    if (id === ativo?.id) return;
    iniciarTroca(async () => {
      const r = await trocarPerfilAction(id);
      if (!r.ok) showError(r.error);
      else onClose();
    });
  }

  function mudarModo(m: "light" | "dark") {
    if (m === modoAtual) return;
    setModoEscolhido(m);
    document.documentElement.classList.toggle("dark", m === "dark");
    document.documentElement.classList.toggle("light", m === "light");
    try {
      localStorage.setItem("theme", m);
    } catch {
      // Modo privado: vale nesta sessão.
    }
    iniciar(async () => {
      await setThemeAction(m);
      router.refresh();
    });
  }

  const grupo = "overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]";
  const linha = "flex min-h-[52px] w-full items-center gap-3 border-t border-border px-4 py-2 text-left text-[15px] text-ink first:border-t-0 hover:bg-surface-hover";
  const seta = <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />;

  return (
    <div role="dialog" aria-modal="true" aria-label="Perfil" className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-canvas animate-fade-in" data-tela-perfil>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(0.75rem+var(--safe-top,0px))]">
        <div className="grid grid-cols-[44px_1fr_44px] items-center">
          <button ref={fecharRef} type="button" onClick={onClose} aria-label="Fechar perfil" className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-2">
            <ChevronLeft size={22} aria-hidden />
          </button>
          <b className="text-center text-[17px] font-medium text-ink">Perfil</b>
          <span />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <FotoDoPerfil nome={nome} foto={foto} comBotao anel tamanho={84} />
          <p className="titulo-tema mt-2 text-xl font-medium text-ink">{nome}</p>
          {email && <p className="max-w-full truncate text-sm text-ink-muted">{email}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <p className="px-1 text-[13px] font-medium text-ink-muted">Meus perfis</p>
          <div className={grupo}>
            {perfis.map((p) => {
              const eAtivo = p.id === ativo?.id;
              return (
                <button key={p.id} type="button" onClick={() => trocar(p.id)} disabled={trocando} aria-current={eAtivo ? "true" : undefined} className={`${linha} disabled:opacity-60`}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                    {/* Pessoa, coração e maleta (protótipo): o ícone diz o tipo do perfil. */}
                    {p.kind === "CASAL" ? <Heart size={18} strokeWidth={1.75} /> : p.kind === "EMPRESA" ? <Briefcase size={18} strokeWidth={1.75} /> : <User size={18} strokeWidth={1.75} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 break-words">
                      {p.name}
                      {eAtivo && <span className="rounded-full bg-accent-soft px-2 py-px text-xs text-accent-strong">abre ao entrar</span>}
                    </span>
                    <span className="block text-caption text-ink-muted">
                      {TIPO[p.kind ?? ""] ?? "Perfil"} · tema {NOME_DO_TEMA[p.theme] ?? "Padrão"}
                    </span>
                  </span>
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${eAtivo ? "bg-ink text-canvas" : "border border-border-strong"}`} aria-hidden>
                    {eAtivo && <Check size={14} strokeWidth={2.5} />}
                  </span>
                </button>
              );
            })}
            <Link href="/configuracoes/perfis" onClick={onClose} className={linha}>
              <span className="flex-1">Criar ou organizar perfis</span>
              {seta}
            </Link>
          </div>
        </div>

        <div className={grupo}>
          <div className={linha}>
            <span className="flex-1">Aparência</span>
            <span className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Aparência">
              {(["light", "dark"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={modoAtual === m} onClick={() => mudarModo(m)} className="min-h-9 rounded-full px-3.5 text-sm text-ink-muted aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-sm">
                  {m === "light" ? "Claro" : "Escuro"}
                </button>
              ))}
            </span>
          </div>
          <div className="border-t border-border">
            <Interruptor ligado={ocultos} aoMudar={() => alternar()} titulo="Esconder valores" />
          </div>
        </div>

        <div className={grupo}>
          <Link href="/configuracoes/perfil" onClick={onClose} className={linha}>
            <span className="flex-1">Meus dados</span>
            {seta}
          </Link>
          <Link href="/configuracoes" onClick={onClose} className={linha}>
            <span className="flex-1">Minha assinatura</span>
            <span className="text-sm text-ink-muted">Anual</span>
          </Link>
          <Link href="/configuracoes/notificacoes" onClick={onClose} className={linha}>
            <span className="flex-1">Notificações</span>
            {seta}
          </Link>
          <Link href="/configuracoes" onClick={onClose} className={linha}>
            <span className="flex-1">Todas as configurações</span>
            {seta}
          </Link>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className={`${linha} text-danger`}
          >
            <LogOut size={18} strokeWidth={1.6} aria-hidden />
            <span className="flex-1">Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
}
