import type { Metadata, Viewport } from "next";
import { Albert_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

// Identidade First Light: Albert Sans (variável) é a única família de texto — títulos em
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
  // statusBarStyle "black-translucent" (texto claro) porque o tema é preto+dourado — o
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
  // em modo standalone com a tag legada `apple-mobile-web-app-capable` — é ela que tira a barra
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

const THEME_INIT_SCRIPT = `
try {
  if (localStorage.getItem("theme") === "dark") {
    document.documentElement.classList.add("dark");
  }
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
        {/* Roda antes da hidratação pra aplicar o tema salvo sem flash. Alterna `type` entre
            server/client (em vez de um <script> comum) pra evitar o aviso do React sobre
            tags <script> renderizadas via JSX — ver node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}
