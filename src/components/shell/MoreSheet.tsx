"use client";

import Link from "next/link";
import { Lock, LogOut, Smartphone, MessageCircle, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MORE_NAV_SECTIONS, ADMIN_NAV_SECTION, withNavFlags, secoesVisiveis } from "./nav-sections";
import { ThemeToggle } from "./ThemeToggle";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";

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
  openFinance,
  podeEscolherModo,
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
  /** Open Finance ligado no servidor; sem isso, "Conexões" some do menu. */
  openFinance: boolean;
  /** O tema do perfil deixa escolher claro/escuro? Só o Padrão deixa; nos outros a chave some. */
  podeEscolherModo: boolean;
}) {
  const { voz, empresa } = useProfileTheme();
  const sections = secoesVisiveis(withNavFlags(isAdmin ? [...MORE_NAV_SECTIONS, ADMIN_NAV_SECTION] : MORE_NAV_SECTIONS, { openFinance }), empresa);

  return (
    <Modal open={open} onClose={onClose} title={voz.titulos.navMais}>
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
              <span className="flex-1">{voz.titulos.navSecao(section.basePath, section.label)}</span>
              {section.premium && !isPremium && <Lock size={14} strokeWidth={2} className="shrink-0 text-ink-faint" />}
            </Link>
          );
        })}

        {/* Porta fixa pros perfis. O seletor do topo some quando só existe um perfil, e até
            aqui ele era o ÚNICO link pra /perfis no app inteiro — ou seja, quem tinha um
            perfil só não tinha como criar o segundo. Esta entrada não depende da quantidade. */}
        <Link
          href="/perfis"
          onClick={onClose}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2"
        >
          <Wallet size={18} strokeWidth={1.75} className="text-ink-muted" />
          <span className="flex-1">{voz.titulos.navPerfis}</span>
        </Link>
      </div>

      {podeEscolherModo && (
        <div className="mt-3 border-t border-border pt-3">
          {/* Tema aqui, e não só em Configurações → Preferências: no celular aquele caminho são
              três telas e um formulário com botão Salvar, pra uma preferência que a pessoa quer
              trocar na hora. Some quando o tema do perfil já decidiu o modo (Girly é branco,
              Disciplina é preto): uma chave que não faz nada é pior que nenhuma. */}
          <ThemeToggle initial={theme} />
        </div>
      )}

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
          {voz.titulos.navInstalar}
        </button>
        {process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP && (
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP.replace(/\D/g, "")}?text=${encodeURIComponent("Oi! Preciso de ajuda com o SPI Finance.")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-surface-2"
          >
            <MessageCircle size={18} strokeWidth={1.75} className="text-ink-muted" />
            {voz.titulos.navWhatsapp}
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
          {voz.titulos.navSair}
        </button>
      </div>
    </Modal>
  );
}
