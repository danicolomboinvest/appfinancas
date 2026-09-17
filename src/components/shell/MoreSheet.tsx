"use client";

import Link from "next/link";
import { Lock, LogOut, Smartphone, MessageCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MORE_NAV_SECTIONS, ADMIN_NAV_SECTION } from "./nav-sections";
import { ThemeToggle } from "./ThemeToggle";

/** Bottom sheet com as seções que não têm tab própria na barra inferior (mobile). */
export function MoreSheet({
  open,
  onClose,
  isAdmin,
  isPremium,
  userEmail,
  onLogout,
  onOpenInstall,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  /** Acesso à área de investimentos (curso) — mesmo cadeado que a sidebar mostra. */
  isPremium: boolean;
  userEmail?: string;
  onLogout: () => void;
  /** Abre o tutorial de instalar o app na tela de início. */
  onOpenInstall: () => void;
  /** Tema salvo na conta, pra chave nascer no estado certo. */
  theme: "dark" | "light";
}) {
  const sections = isAdmin ? [...MORE_NAV_SECTIONS, ADMIN_NAV_SECTION] : MORE_NAV_SECTIONS;

  return (
    <Modal open={open} onClose={onClose} title="Mais">
      <div className="flex flex-col gap-0.5">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.basePath}
              href={section.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2"
            >
              <Icon size={18} strokeWidth={1.75} className="text-ink-muted" />
              <span className="flex-1">{section.label}</span>
              {section.premium && !isPremium && <Lock size={14} strokeWidth={2} className="shrink-0 text-ink-faint" />}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {/* Tema aqui, e não só em Configurações → Preferências: no celular aquele caminho são
            três telas e um formulário com botão Salvar, pra uma preferência que a pessoa quer
            trocar na hora. */}
        <ThemeToggle initial={theme} />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {/* Fica aqui pra quem fechou o convite do topo (ou trocou de aparelho) achar depois. */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenInstall();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2"
        >
          <Smartphone size={18} strokeWidth={1.75} className="text-ink-muted" />
          Instalar na tela de início
        </button>
        {process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP && (
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent("Oi! Preciso de ajuda com o SPI Finance.")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-surface-2"
          >
            <MessageCircle size={18} strokeWidth={1.75} className="text-ink-muted" />
            Falar com a gente no WhatsApp
          </a>
        )}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {userEmail && <p className="mb-2 truncate px-3 text-xs text-ink-faint">{userEmail}</p>}
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <LogOut size={18} strokeWidth={1.75} />
          Sair
        </button>
      </div>
    </Modal>
  );
}
