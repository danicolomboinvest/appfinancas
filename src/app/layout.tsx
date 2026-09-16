import type { Metadata, Viewport } from "next";
import { Albert_Sans, Geist_Mono } from "next/font/google";
import { BootSplash } from "@/components/brand/BootSplash";
import "./globals.css";

// Identidade First Light: Albert Sans (variável) é a única família de texto, títulos em
// bold tracking-tight, números tabulares como herói. Geist Mono fica só pro font-mono.
const albertSans = Albert_Sans({
  variable: "--font-albert-sans",
  subsets: ["latin"],
});

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

// Trava o zoom por pinça e o gesto de duplo-toque, e estende o conteúdo até as bordas
// (viewport-fit=cover) para o rodapé com env(safe-area-inset-bottom) funcionar como app nativo.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0c0e",
};

/**
 * Roda antes da primeira pintura pra evitar o flash de tema errado. Agora precisa tratar o
 * CLARO explicitamente: o padrão do CSS (`:root`) é escuro, então quem escolheu claro veria a
 * tela nascer preta e clarear depois — que é exatamente o flash que este script existe pra
 * evitar, só que ao contrário.
 */
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem("theme");
  if (t === "dark") document.documentElement.classList.add("dark");
  if (t === "light") document.documentElement.classList.add("light");
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${albertSans.variable} ${geistMono.variable} h-full antialiased`}
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
            __html: "html,body{background:#0c0c0e}html.light,html.light body{background:#ffffff}",
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
        {children}
      </body>
    </html>
  );
}
