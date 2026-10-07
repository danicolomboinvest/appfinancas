"use client";

import Link from "next/link";
import { CircleHelp, Lock, LogOut, Mail, Settings, Smartphone, Wallet } from "lucide-react";
import { linkDoSuporte } from "@/lib/support/whatsapp-link";
import { Modal } from "@/components/ui/Modal";
import { secoesDoMais, ADMIN_NAV_SECTION, withNavFlags, secoesVisiveis } from "./nav-sections";
import { ThemeToggle } from "./ThemeToggle";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useIsStandalone } from "@/lib/pwa/install";

/**
 * Bottom sheet com as seções que não têm tab própria na barra inferior (mobile).
 *
 * Desde 06/10/2026 em duas partes: em cima a grade "Ferramentas" (ícones grandes, como o hub
 * do Revolut e os serviços do Uber), embaixo a lista curta "Sua conta". Ajuda e Configurações
 * viram ícones no cabeçalho. Calculadoras ganharam quadrado próprio: moravam no fim do Decidir.
 */
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
  barraComCarteira = true,
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
  /** A barra de baixo está mostrando a Carteira? Tem que ser o MESMO valor que a MobileTabBar
   * usa (o isPremium dela), senão a Carteira some dos dois lugares ou aparece nos dois. Padrão
   * `true` = a barra de sempre, com a Carteira. */
  barraComCarteira?: boolean;
}) {
  const { voz, empresa, casal } = useProfileTheme();
  // Já instalado (atalho na tela de início ou app da loja): não há o que instalar.
  const instalado = useIsStandalone();
  // Sem a área paga, a Carteira sai da barra de baixo e aparece aqui (com o cadeado); a Visão
  // Geral, que tomou o lugar dela na barra, sai daqui. Mesma regra da MobileTabBar.
  const doMais = secoesDoMais(barraComCarteira);
  const sections = secoesVisiveis(withNavFlags(isAdmin ? [...doMais, ADMIN_NAV_SECTION] : doMais, { openFinance }), { empresa, casal });
  // Ajuda e Configurações moram no cabeçalho da folha, como ícones; o resto vira a grade.
  const NO_CABECALHO: Record<string, typeof CircleHelp> = { "/guia": CircleHelp, "/configuracoes": Settings };
  const cabecalho = sections.filter((s) => NO_CABECALHO[s.basePath]).map((section) => ({ section, Icone: NO_CABECALHO[section.basePath] }));
  const ferramentas = sections.filter((s) => !NO_CABECALHO[s.basePath]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={voz.titulos.navMais}
      acoes={
        <>
          {cabecalho.map(({ section, Icone }) => (
            <Link
              key={section.basePath}
              href={section.href}
              onClick={onClose}
              aria-label={voz.titulos.navSecao(section.basePath, section.label)}
              title={voz.titulos.navSecao(section.basePath, section.label)}
              className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
            >
              <Icone size={20} strokeWidth={1.8} aria-hidden />
            </Link>
          ))}
        </>
      }
    >
      <p className="px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{voz.titulos.maisFerramentas}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {ferramentas.map((section) => {
          const Icon = section.icon;
          const travada = section.premium && !isPremium;
          return (
            <Link
              key={section.basePath}
              href={section.href}
              onClick={onClose}
              className="relative flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-1.5 py-3 text-center transition-colors hover:bg-surface-hover"
            >
              <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
                <Icon size={22} strokeWidth={1.8} aria-hidden />
              </span>
              <span className="text-[13px] font-medium leading-tight text-ink">{voz.titulos.navSecao(section.basePath, section.label)}</span>
              {travada && (
                <>
                  <Lock size={12} strokeWidth={2.2} className="absolute right-2 top-2 text-ink-faint" aria-hidden />
                  <span className="sr-only">(área do curso de investimentos)</span>
                </>
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-4 px-1 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{voz.titulos.maisSuaConta}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        {/* Porta fixa pros perfis. O seletor do topo some quando só existe um perfil, e até
            aqui ele era o ÚNICO link pra /perfis no app inteiro — ou seja, quem tinha um
            perfil só não tinha como criar o segundo. Esta entrada não depende da quantidade. */}
        <Link
          href="/perfis"
          onClick={onClose}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2"
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
        {!instalado && (
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
        )}
        {/* Atendimento por e-mail (06/10/2026): no WhatsApp a Dani só pode responder em até 24h. */}
        <a
          href={linkDoSuporte("Oi! Preciso de ajuda com o SPI Finance.")}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-surface-2"
        >
          <Mail size={18} strokeWidth={1.75} className="text-ink-muted" />
          {voz.titulos.navWhatsapp}
        </a>
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
