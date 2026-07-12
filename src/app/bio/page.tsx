import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Bodoni_Moda } from "next/font/google";

// Tipografia padronizada com o site fatoscapital.com.br:
//  • Plus Jakarta Sans no texto/UI
//  • Bodoni Moda (itálico) no destaque serifado ("plano de verdade")
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const bodoni = Bodoni_Moda({ subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], display: "swap" });

// ─────────────────────────────────────────────────────────────────────────────
// Página "link na bio" do Instagram (@fatoscapital). Porta de entrada antes do
// site/app, no domínio de vocês — substitui o Beacons. Linguagem visual e
// tipografia espelhadas do site: navy, dourado, foto-herói do próprio site em
// degradê, e o destaque em Bodoni itálico com brilho.
//
// >>> AJUSTES RÁPIDOS AQUI <<<
//  • LINKS: troque pelas URLs reais (abrir conta na EQI, o Raio-X e o site).
//  • HERO_IMG: hoje usa a foto-herói do próprio site (hero-2560.webp). Pode
//    trocar por qualquer outra imagem do site (ex.: assets/metodo-card-2.webp).
// ─────────────────────────────────────────────────────────────────────────────
const LINKS = {
  site: "https://fatoscapital.com.br",
  abrirConta:
    "https://cadastro.eqi.com.br/?utm_campaign=20230515-CPT-AON-LFR-X&utm_source=PRC-XXX-XXX&utm_medium=XXX-CT1-XXX&utm_content=OUT-ASCG&campaignId=7014V000002J1oiQAC&assessor=6135074&manual_referral=true",
  raioX: "https://danicolombo.com.br/raio-x/",
  instagram: "https://instagram.com/fatoscapital",
};

const LOGO = "https://fatoscapital.com.br/assets/logo-transparent.png";
const HERO_IMG = "https://fatoscapital.com.br/assets/hero-2560.webp";

export const metadata: Metadata = {
  title: "Fatos Capital — Assessoria de Investimentos",
  description:
    "O seu patrimônio, com um plano de verdade. Abra sua conta, faça o Raio-X do Investidor e conheça a Fatos Capital.",
  openGraph: {
    title: "Fatos Capital — Assessoria de Investimentos",
    description: "O seu patrimônio, com um plano de verdade.",
  },
};

// Grão de filme sutil — SVG de ruído embutido como data URI (nada externo).
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

type Btn = {
  label: string;
  sublabel: string;
  href: string;
  primary?: boolean;
  icon: React.ReactNode;
};

const Sparkle = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[17px] w-[17px]">
    <path d="M12 2.5l1.7 5.6a3 3 0 001.9 1.9l5.6 1.7-5.6 1.7a3 3 0 00-1.9 1.9L12 21l-1.7-5.6a3 3 0 00-1.9-1.9L2.8 11.8l5.6-1.7a3 3 0 001.9-1.9L12 2.5z" />
  </svg>
);
const Pulse = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[17px] w-[17px]">
    <path
      d="M2 12h4l2.5-7 4.5 14 2.5-7H22"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const Globe = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[17px] w-[17px]">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const BUTTONS: Btn[] = [
  {
    label: "Abra sua conta",
    sublabel: "Comece a investir com a Fatos",
    href: LINKS.abrirConta,
    primary: true,
    icon: Sparkle,
  },
  {
    label: "Raio-X do Investidor",
    sublabel: "Descubra seu perfil em minutos",
    href: LINKS.raioX,
    icon: Pulse,
  },
  {
    label: "Site",
    sublabel: "Conheça a Fatos Capital",
    href: LINKS.site,
    icon: Globe,
  },
];

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="h-5 w-5 shrink-0 opacity-70 transition-transform duration-300 group-hover:translate-x-1 group-hover:opacity-100"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BioPage() {
  return (
    <main
      className={`${jakarta.className} bio-root relative flex min-h-dvh flex-col items-center overflow-hidden bg-[#04070d] pb-10 text-[#f4efe4]`}
    >
      {/* ── Fundo ──────────────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg,#04070d 0%,#060d18 46%,#03080f 100%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      {/* ── Herói: foto do site em degradê, com logo + título por cima ─────── */}
      <section className="relative flex w-full max-w-[26rem] flex-col">
        <div className="relative h-[50vh] max-h-[480px] min-h-[360px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMG}
            alt=""
            aria-hidden
            className="h-full w-full object-cover object-center"
          />
          {/* Degradê elegante: transparente em cima → navy embaixo, pra assentar o texto */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(4,7,13,0.55) 0%, rgba(4,7,13,0.12) 22%, rgba(4,7,13,0.2) 48%, rgba(4,7,13,0.82) 82%, #04070d 100%)",
            }}
          />
          {/* Leve wash dourado pra casar com a marca */}
          <div
            aria-hidden
            className="absolute inset-0 mix-blend-soft-light"
            style={{ background: "radial-gradient(80% 60% at 50% 30%, rgba(198,169,107,0.35), transparent 65%)" }}
          />

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO}
            alt="Fatos Capital · EQI"
            className="bio-reveal absolute left-1/2 top-8 h-9 w-auto -translate-x-1/2 opacity-95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
            style={{ animationDelay: "0.05s" }}
          />

          {/* Eyebrow + título sobre o degradê */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-2 text-center">
            <div className="bio-reveal flex items-center gap-2.5" style={{ animationDelay: "0.24s" }}>
              <span className="h-px w-6" style={{ background: "rgba(198,169,107,0.7)" }} />
              <span
                className="text-[0.625rem] font-medium uppercase tracking-[0.28em]"
                style={{ color: "#d8bd82" }}
              >
                Assessoria de Investimentos
              </span>
            </div>
            <h1
              className="bio-reveal mt-3 text-[1.75rem] font-normal leading-[1.14] tracking-tight text-[#f7f2e7]"
              style={{ animationDelay: "0.3s" }}
            >
              O seu patrimônio, com um{" "}
              <span className={`${bodoni.className} bio-shine`} style={{ fontStyle: "italic", fontWeight: 500 }}>
                plano de verdade
              </span>
              .
            </h1>
          </div>
        </div>
      </section>

      {/* ── Botões + rodapé ────────────────────────────────────────────────── */}
      <div className="relative flex w-full max-w-[24rem] flex-1 flex-col items-center px-6 pt-3">
        <nav className="flex w-full flex-col gap-3">
          {BUTTONS.map((btn, i) => (
            <a
              key={btn.label}
              href={btn.href}
              className={
                "bio-reveal group relative flex items-center gap-4 overflow-hidden rounded-2xl px-4 py-3.5 transition-all duration-300 " +
                (btn.primary
                  ? "bio-shimmer text-[#1a1305] shadow-[0_12px_34px_rgba(198,169,107,0.3)] hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(198,169,107,0.45)]"
                  : "border text-[#f4efe4] hover:-translate-y-0.5")
              }
              style={{
                animationDelay: `${0.42 + i * 0.09}s`,
                ...(btn.primary
                  ? { background: "linear-gradient(135deg,#e6d3a3 0%,#c6a96b 52%,#b0925a 100%)" }
                  : {
                      borderColor: "rgba(198,169,107,0.22)",
                      background: "linear-gradient(180deg, rgba(230,211,163,0.05), rgba(230,211,163,0.015))",
                      backdropFilter: "blur(6px)",
                    }),
              }}
            >
              <span
                className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={
                  btn.primary
                    ? { background: "rgba(26,19,5,0.16)", color: "#3a2c0d" }
                    : {
                        background: "rgba(198,169,107,0.12)",
                        color: "#e6d3a3",
                        border: "1px solid rgba(198,169,107,0.2)",
                      }
                }
              >
                {btn.icon}
              </span>
              <span className="relative z-10 flex flex-1 flex-col">
                <span
                  className={
                    "text-[0.95rem] font-semibold tracking-tight " + (btn.primary ? "" : "text-[#f7f2e7]")
                  }
                >
                  {btn.label}
                </span>
                <span
                  className="text-[0.72rem]"
                  style={{ color: btn.primary ? "rgba(26,19,5,0.6)" : "rgba(198,169,107,0.72)" }}
                >
                  {btn.sublabel}
                </span>
              </span>
              <span className="relative z-10">
                <Arrow />
              </span>
            </a>
          ))}
        </nav>

        <footer
          className="bio-reveal mt-9 flex flex-col items-center gap-3 text-center"
          style={{ animationDelay: "0.72s" }}
        >
          <a
            href={LINKS.instagram}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[0.75rem] tracking-wide"
            style={{ color: "rgba(244,239,228,0.6)", border: "1px solid rgba(244,239,228,0.08)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
              <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
            </svg>
            @fatoscapital
          </a>
          <p
            className="max-w-[20rem] text-[0.5625rem] leading-relaxed"
            style={{ color: "rgba(244,239,228,0.26)" }}
          >
            Fatos Capital Assessoria de Investimentos · Escritório credenciado EQI Investimentos
          </p>
        </footer>
      </div>
    </main>
  );
}
