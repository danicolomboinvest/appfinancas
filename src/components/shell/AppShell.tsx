"use client";

import type { ProfileKind } from "@prisma/client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { NavProgressProvider } from "./nav-progress";
import { ehVisaoGeral } from "./flow-tabs";
import { useTopoAoTrocarDeTela } from "@/components/ui/useVoltarAoTopo";
import { RegistrarDrawer } from "./RegistrarDrawer";
import { modoPedidoNoEvento, EVENTO_IMPORTAR, EVENTO_REGISTRAR, type ModoDoRegistrar } from "./registrar-eventos";
import type { PerfilResumo } from "@/components/profiles/perfil-resumo";
import { TopBar } from "./TopBar";
import { AbasDaVisaoGeral, DeslizarEntreAbas } from "./AbasDaVisaoGeral";
import { OuvinteDeErros } from "./OuvinteDeErros";
import { BotaoRegistrar } from "./BotaoRegistrar";
import { ComoFuncionaSheet } from "./ComoFuncionaSheet";
import { PerfilSheet } from "./PerfilSheet";
import { TourDasNovidades } from "./TourDasNovidades";
import type { EstadoDasNovidades } from "@/lib/novidades/passos";
import { GuiaDoReset } from "@/components/money-reset/GuiaDoReset";
import { InstallAppBanner } from "./InstallAppBanner";
import { ConviteTesteAndroid } from "./ConviteTesteAndroid";
import { InstallAppSheet } from "./InstallAppSheet";
import { UsageTracker } from "./UsageTracker";
import { ADMIN_NAV_SECTION, NAV_SECTIONS, rotuloDoMenu, secoesVisiveis, tituloDaEmpresa, tituloDaTela } from "./nav-sections";
import { logoutAction } from "@/lib/auth/actions";
import { desinscreverAvisosDesteAparelho } from "@/lib/push/aparelho";
import { ToastProvider } from "@/components/ui/toast-context";
import { ProfileThemeProvider } from "@/components/profiles/ProfileThemeProvider";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { ehCasal } from "@/lib/profiles/casal";
import { SECOES_DO_PAR } from "@/lib/casal-login/menu-do-par";
import type { PreferenciasDeCategoria } from "@/lib/categories";

export function AppShell({
  children,
  isAdmin,
  isPremium,
  comMoneyReset = false,
  userEmail,
  greeting,
  dateLabel,
  theme,
  openFinance,
  perfis = [],
  profileTheme,
  profileKind = "PESSOAL",
  prefsDeCategoria = {},
  nomesDoCasal = null,
  cartaoComLimite = false,
  nomeDaConta = null,
  fotoDaConta = null,
  modoPar = null,
  novidades = "novo",
}: {
  /** Login do par: quem está logado é o par, no Nós dois da titular. O menu mostra só o dele. */
  modoPar?: { nomeTitular: string } | null;
  /** "Tivemos uma mudança": "mostrar" (já usava e não viu), "visto" ou "novo" (nunca vê). */
  novidades?: EstadoDasNovidades;
  /** Nome da conta (o avatar do topo mostra a inicial quando não há foto). */
  nomeDaConta?: string | null;
  /** Foto da conta (User.avatarUrl): vira o avatar do app todo. */
  fotoDaConta?: string | null;
  /** Nome, ícone e categorias escondidas do perfil ativo (ver lib/categories.ts). */
  prefsDeCategoria?: PreferenciasDeCategoria;
  nomesDoCasal?: { A: string; B: string; comPar?: boolean } | null;
  /** O perfil montou um limite do cartão: o + mostra o "No cartão de crédito". */
  cartaoComLimite?: boolean;
  children: React.ReactNode;
  isAdmin: boolean;
  isPremium: boolean;
  /** Comprou o Money Reset (ou é admin): o item aparece no menu ☰. */
  comMoneyReset?: boolean;
  userEmail?: string;
  /** Já na voz do tema. `null` quando o tema não cumprimenta (Game). */
  greeting: string | null;
  /** A linha abaixo da saudação: a data, ou o que o tema quiser dizer no lugar dela. */
  dateLabel: string | null;
  /** Chave do tema do perfil ativo — a voz das abas e da barra de baixo sai dele. */
  profileTheme: string;
  /** Tipo do perfil ativo. Empresa troca o vocabulário e esconde o que é de pessoa física. */
  profileKind?: ProfileKind;
  /** O tema deixa a pessoa escolher claro/escuro? Desde a versão nova, todos deixam. */
  podeEscolherModo?: boolean;
  /** Tema salvo na conta — a chave clara/escura do menu "Mais" nasce com ele. */
  theme: "dark" | "light";
  /** Open Finance ligado no servidor (chaves da Pluggy na Vercel). Desligado, as entradas
   * "Conexões" não aparece — o código vai junto no deploy, mas fica
   * invisível até a Dani decidir ligar. */
  openFinance: boolean;
  perfis?: PerfilResumo[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [registrarOpen, setRegistrarOpen] = useState(false);
  // Em que tela a gaveta abre: o "+" abre na escolha; um botão "Importar extrato" de dentro de
  // uma tela abre direto na importação, sem fazer a pessoa escolher de novo o que já tocou.
  const [modoDoRegistrar, setModoDoRegistrar] = useState<ModoDoRegistrar>("choice");
  const abrirRegistrar = useCallback((modo: ModoDoRegistrar = "choice") => {
    setModoDoRegistrar(modo);
    setRegistrarOpen(true);
  }, []);
  const [, startTransition] = useTransition();
  const pathname = usePathname();
  // Trocou de tela: a nova começa do topo (o voltar do navegador continua voltando ao lugar).
  useTopoAoTrocarDeTela();
  const router = useRouter();
  // Um link de dentro da gaveta do Registrar (o "Ler o manual" da importação) muda de tela:
  // a gaveta fecha junto, senão a página nova abria escondida atrás dela.
  const [pathDaGaveta, setPathDaGaveta] = useState(pathname);
  if (pathname !== pathDaGaveta) {
    setPathDaGaveta(pathname);
    setRegistrarOpen(false);
    // Trocou de tela pelo menu ou pelo perfil: os dois fecham junto.
    setMenuOpen(false);
    setPerfilOpen(false);
  }

  // O perfil ativo é da CONTA, não da aba: trocar pra Empresa no computador vale também no
  // celular. Uma tela que ficou aberta no Pessoal continuava mostrando o Pessoal e gravava na
  // Empresa. Ao voltar pra aba (ou pro app) depois de um tempo fora, a tela é recarregada do
  // servidor — se o perfil mudou, ela remonta no perfil certo antes de ela lançar algo.
  useEffect(() => {
    let escondidaDesde = 0;
    function aoMudarVisibilidade() {
      if (document.visibilityState === "hidden") {
        escondidaDesde = Date.now();
        return;
      }
      if (escondidaDesde && Date.now() - escondidaDesde > 30_000) router.refresh();
      escondidaDesde = 0;
    }
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  }, [router]);

  useEffect(() => {
    // Lido só depois de montar (não na inicialização do estado) para o HTML do
    // primeiro render no cliente bater com o do servidor e evitar erro de hidratação.
    const stored = window.localStorage.getItem("sidebar-collapsed");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com localStorage, uma API externa ao React
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }

  function handleLogout() {
    startTransition(async () => {
      // Desliga os avisos deste aparelho antes de sair: quem entrar depois aqui não pode receber
      // os avisos (com valores) da conta que saiu. Pra voltar a receber, é ligar de novo.
      await logoutAction(await desinscreverAvisosDesteAparelho());
    });
  }

  // A Visão geral (Resumo, Orçamento, Transações, Recorrentes) tem as abas e o + (versão nova).
  const visaoGeral = ehVisaoGeral(pathname);
  // "Posso comprar?" com o topo do app (protótipo, #comprar): menu, Decidir, lua e o avatar. A
  // tela cheia de 05/10/2026 saiu; o nome fica para as telas que um dia precisarem dela.
  const focado = false;
  const empresa = ehEmpresa(profileKind);
  const casal = ehCasal(profileKind);
  const secoes = modoPar ? SECOES_DO_PAR : secoesVisiveis(isAdmin ? [...NAV_SECTIONS, ADMIN_NAV_SECTION] : NAV_SECTIONS, { empresa, casal, moneyReset: comMoneyReset });
  const perfilAtivo = perfis.find((p) => p.isDefault);
  // Na Empresa, o topo diz o nome do negócio na Visão geral e o nome da ferramenta nas outras telas.
  const titulo = (empresa && !modoPar && tituloDaEmpresa(pathname, perfilAtivo?.name ?? "Empresa")) || tituloDaTela(pathname, secoes, (s) => rotuloDoMenu(s, empresa));
  const nome = nomeDaConta || userEmail?.split("@")[0] || "Você";
  void greeting;
  void dateLabel;

  return (
    <ToastProvider>
      <ProfileThemeProvider theme={profileTheme} kind={profileKind} prefsDeCategoria={prefsDeCategoria} nomesDoCasal={nomesDoCasal} cartaoComLimite={cartaoComLimite} profileId={perfis.find((p) => p.isDefault)?.id ?? null}>
      <NavProgressProvider>
      <div className="flex min-h-dvh">
        {/* Sidebar: navegação primária no desktop; no mobile fica sempre fora da tela
            (a gaveta hambúrguer foi substituída pela tab bar + MoreSheet abaixo). */}
        <RegistrarOpener onOpen={abrirRegistrar} />
        {/* Fundo escuro atrás da gaveta do menu (só no celular). */}
        {menuOpen && <button type="button" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[65] bg-black/30 md:hidden" />}
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={menuOpen}
          onCloseMobile={() => setMenuOpen(false)}
          isAdmin={isAdmin}
          isPremium={isPremium}
          comMoneyReset={comMoneyReset}
          userEmail={userEmail}
          onLogout={handleLogout}
          // Na Empresa, o Registrar do computador abre o + dela (Vendi, Paguei, Recebi).
          onOpenRegistrar={() => (empresa ? router.push("/empresa?registrar=1") : abrirRegistrar())}
          openFinance={openFinance}
          secoesFixas={modoPar ? SECOES_DO_PAR : undefined}
          perfis={perfis}
          nomeDaConta={nomeDaConta}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Margens de segurança do iPhone (o app é viewport-fit=cover, vai até as bordas):
              - pt: sem var(--safe-top) o conteúdo (ex.: "Bom dia") fica embaixo do
                relógio/câmera no modo standalone. Com o inset, começa abaixo da status bar.
              - pb: limpa a tab bar flutuante (home indicator) + o botão "+" elevado. */}
          <main className={`flex-1 px-5 ${focado ? "pb-[calc(1rem_+_var(--safe-bottom))] pt-[calc(0.75rem_+_var(--safe-top))]" : "pb-[calc(6rem_+_var(--safe-bottom))]"} md:px-10 md:pb-8 md:pt-8`}>
            <div className="mx-auto w-full max-w-6xl">
              {!focado && (
                <TopBar
                  titulo={titulo}
                  menuAberto={menuOpen}
                  onAbrirMenu={() => setMenuOpen(true)}
                  onAbrirPerfil={() => setPerfilOpen(true)}
                  nome={nome}
                  foto={fotoDaConta}
                  modo={theme}
                />
              )}
              <ConviteTesteAndroid userEmail={userEmail} />
              <InstallAppBanner onOpenTutorial={() => setInstallOpen(true)} />
              {visaoGeral && !focado && <AbasDaVisaoGeral />}
              {visaoGeral && !focado ? <DeslizarEntreAbas>{children}</DeslizarEntreAbas> : children}
            </div>
          </main>
        </div>

        {/* O + só na Visão geral (no computador o Registrar mora na barra lateral). */}
        {visaoGeral && !focado && !menuOpen && <BotaoRegistrar onClick={() => abrirRegistrar()} />}

        <PerfilSheet
          open={perfilOpen}
          onClose={() => setPerfilOpen(false)}
          nome={nome}
          email={userEmail}
          foto={fotoDaConta}
          perfis={perfis}
          modo={theme}
          onLogout={handleLogout}
          onOpenInstall={() => setInstallOpen(true)}
        />

        <OuvinteDeErros />
        <ComoFuncionaSheet />

        {/* Tutorial de "instalar na tela de início" (convite do topo ou menu "Mais"). */}
        <InstallAppSheet open={installOpen} onClose={() => setInstallOpen(false)} />

        {/* Ponto de entrada ÚNICO de registro, aberto pelo "+" central da tab bar (mobile) ou
            pelo botão "Registrar" da sidebar (desktop). O microfone vive dentro dele. */}
        <RegistrarDrawer open={registrarOpen} modoInicial={modoDoRegistrar} onClose={() => setRegistrarOpen(false)} />

        {/* Quem já usava o app: o "Tivemos uma mudança" (uma vez por conta, e pela Ajuda). Quem é
            novo: o tour de boas-vindas, só na primeira entrada (lembrado no aparelho). O par, no
            Nós dois da titular, não vê nenhum dos dois. */}
        {!modoPar && novidades !== "novo" && <TourDasNovidades estado={novidades} onMenu={setMenuOpen} />}
        {/* O guia do Money Reset: só aparece quando uma missão liga (sessionStorage). */}
        <GuiaDoReset />

        {/* Rastreio de uso primeiro (pageviews → /admin/relatorio). Não renderiza nada. */}
        <UsageTracker />
      </div>
    </NavProgressProvider>
      </ProfileThemeProvider>
    </ToastProvider>
  );
}

/**
 * Qualquer tela pode pedir a gaveta de registro (ex.: o guia "Primeiros passos") sem prop
 * drilling. `spi:registrar` abre na escolha (ou no modo pedido em `detail.modo`); `spi:importar`
 * abre direto na importação — é o atalho dos botões "Importe seu extrato" de conta nova.
 */
function RegistrarOpener({ onOpen }: { onOpen: (modo?: ModoDoRegistrar) => void }) {
  useEffect(() => {
    const registrar = (event: Event) => onOpen(modoPedidoNoEvento(event));
    const importar = () => onOpen("import");
    window.addEventListener(EVENTO_REGISTRAR, registrar);
    window.addEventListener(EVENTO_IMPORTAR, importar);
    return () => {
      window.removeEventListener(EVENTO_REGISTRAR, registrar);
      window.removeEventListener(EVENTO_IMPORTAR, importar);
    };
  }, [onOpen]);
  return null;
}
