import type { Metadata, Viewport } from "next";
import { Archivo, Cormorant_Garamond, Figtree, Geist_Mono, Hanken_Grotesk, Urbanist } from "next/font/google";
import { BarraDoIphone } from "@/components/shell/BarraDoIphone";
import { BootSplash } from "@/components/brand/BootSplash";
import { ToqueVivo } from "@/components/shell/ToqueVivo";
import { THEME_INIT_SCRIPT } from "./theme-init-script";
import "./globals.css";

// Cada tema tem a sua letra (versão nova, 11/10/2026): Padrão em Figtree, Girly em Hanken
// Grotesk com títulos em Cormorant Garamond itálica, Manifestação em Urbanist e Titânio em
// Archivo. As quatro carregam juntas; o tema escolhe qual vale pela variável --font-tema
// (ver themes.ts). Geist Mono fica só pro font-mono.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500", "600"], style: ["italic"] });
const urbanist = Urbanist({ variable: "--font-urbanist", subsets: ["latin"], weight: ["300", "400", "500", "600"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], weight: ["300", "400", "500", "600"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={`${figtree.variable} ${hanken.variable} ${cormorant.variable} ${urbanist.variable} ${archivo.variable} ${geistMono.variable} h-full antialiased`}
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
            esta tag existe pra evitar, ao contrário. */}
        <style
          dangerouslySetInnerHTML={{
            __html: "html,body{background-color:var(--color-canvas,#0c0c0e)}html.light,html.light body{background-color:var(--color-canvas,#ffffff)}",
          }}
        />
        {/* Roda antes da hidratação pra aplicar o tema salvo sem flash. Alterna `type` entre
            server/client (em vez de um <script> comum) pra evitar o aviso do React sobre
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
        {/* O toque que responde: botão encolhe, volta com mola e o principal vibra (07/10/2026). */}
        <ToqueVivo />
        {/* Atrás do relógio e da bateria: o que rola por baixo some num vidro da cor do fundo, como
            nos apps do iPhone. Fora do app (Safari, computador) a margem é zero e isto não aparece. */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[var(--safe-top)] bg-canvas/85 backdrop-blur-md" />
        {children}
      </body>
    </html>
  );
}
