import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BarraDoIphone } from "@/components/shell/BarraDoIphone";
import { PonteDoWidget } from "@/components/shell/PonteDoWidget";
import { BootSplash } from "@/components/brand/BootSplash";
import { ToqueVivo } from "@/components/shell/ToqueVivo";
import { SemPinca } from "@/components/shell/SemPinca";
import { THEME_INIT_SCRIPT } from "./theme-init-script";
import "./globals.css";

// Cada tema tem a sua letra (versão nova, 11/10/2026): Padrão em Figtree, Girly em Hanken
// Grotesk com títulos em Cormorant Garamond itálica, Manifestação em Urbanist e Titânio em
// Geist. As quatro carregam juntas; o tema escolhe qual vale pela variável --font-tema
// (ver themes.ts). Geist Mono fica só pro font-mono.
//
// Fontes no repositório (12/10/2026): com next/font/google o build da Vercel falhava de vez em
// quando ("Can't resolve '@vercel/turbopack-next/internal/font/google/font'") ao baixar as fontes.
// Os arquivos em ./fontes vieram do Google Fonts (subset latin, que cobre o português) e são as
// versões variáveis: um arquivo por família serve todos os pesos usados.
const figtree = localFont({ src: "./fontes/figtree.woff2", variable: "--font-figtree", weight: "300 600", display: "swap" });
const hanken = localFont({ src: "./fontes/hanken-grotesk.woff2", variable: "--font-hanken", weight: "300 600", display: "swap" });
const cormorant = localFont({ src: "./fontes/cormorant-garamond-italic.woff2", variable: "--font-cormorant", weight: "500 600", style: "italic", display: "swap" });
const urbanist = localFont({ src: "./fontes/urbanist.woff2", variable: "--font-urbanist", weight: "300 600", display: "swap" });
// Titânio: Geist desde 11/10/2026 (era Archivo), com fallback de sistema.
const geist = localFont({ src: "./fontes/geist.woff2", variable: "--font-geist", weight: "300 600", display: "swap", fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] });

const geistMono = localFont({ src: "./fontes/geist-mono.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "SPI Finance",
  description: "Organize seu patrimônio, metas e investimentos em um só lugar.",
  // Faz o app abrir em tela cheia (sem barra de URL) quando salvo na tela inicial do iOS.
  // statusBarStyle "black-translucent" (texto claro) porque o tema é preto+dourado, o
  // relógio/bateria aparecem em branco sobre o fundo escuro.
  appleWebApp: {
    capable: true,
    title: "SPI Finance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  // O Next já emite o `mobile-web-app-capable` (padrão novo), mas o iOS Safari antigo só entra
  // em modo standalone com a tag legada `apple-mobile-web-app-capable`, é ela que tira a barra
  // de URL quando o app é aberto pela tela inicial. Mantemos as duas por compatibilidade.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Estende o conteúdo até as bordas (viewport-fit=cover) para o rodapé com
// var(--safe-bottom) funcionar como app nativo. Zoom TRAVADO, como app: a revisão de
// 30/09/2026 liberou a pinça e a Dani não gostou (01/10/2026: "não gosto de dar zoom em
// aplicativo"). A legibilidade fica por conta do tamanho das letras, não da pinça.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0c0e",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${hanken.variable} ${cormorant.variable} ${urbanist.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Fundo JÁ na primeira tag <style>, sem depender do CSS externo (que é outra
            requisição de rede) — no app instalado, numa conexão mais lenta, o navegador pode
            desenhar o body ANTES do bundle de CSS chegar; sem isso, esse instante pinta branco
            (fundo padrão) em vez da cor certa, mesmo com o BootSplash certo por trás.
            As duas cores vêm juntas: quem escolheu o tema claro ganha a classe `light` no
            <html> pelo script logo abaixo, que roda antes da primeira pintura. Com só a cor
            escura aqui, essa pessoa via a tela nascer preta e clarear — o mesmo flash que
            esta tag existe para evitar, ao contrário. */}
        <style
          dangerouslySetInnerHTML={{
            __html: "html,body{background-color:var(--color-canvas,#0c0c0e)}html.light,html.light body{background-color:var(--color-canvas,#ffffff)}",
          }}
        />
        {/* Roda antes da hidratação pra aplicar o tema salvo sem flash. Alterna `type` entre
            server/client (em vez de um <script> comum) para evitar o aviso do React sobre
            tags <script> renderizadas via JSX, ver node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        <BootSplash />
        <BarraDoIphone />
        <PonteDoWidget />
        {/* O toque que responde: botão encolhe, volta com mola e o principal vibra (07/10/2026). */}
        <ToqueVivo />
        {/* O Safari do iPhone ignora o userScalable: false; isto segura a pinça (13/10/2026). */}
        <SemPinca />
        {/* Atrás do relógio e da bateria: o que rola por baixo some num vidro da cor do fundo, como
            nos apps do iPhone. Fora do app (Safari, computador) a margem é zero e isto não aparece. */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[var(--safe-top)] bg-canvas/85 backdrop-blur-md" />
        {children}
      </body>
    </html>
  );
}
