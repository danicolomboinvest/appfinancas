import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Planejamento Financeiro",
  description: "Organize seu patrimônio, metas e investimentos em um só lugar.",
  // Faz o app abrir em tela cheia (sem barra de URL) quando salvo na tela inicial do iOS.
  // statusBarStyle "default" (texto escuro) porque o tema padrão é claro — "black-translucent"
  // deixaria o relógio/bateria brancos e invisíveis sobre o off-white.
  appleWebApp: {
    capable: true,
    title: "Finanças",
    statusBarStyle: "default",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
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
