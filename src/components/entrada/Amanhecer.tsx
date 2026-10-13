import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { cssDaEntrada } from "@/lib/profiles/themes";

/**
 * O Início e o Entrar no visual "Amanhecer" (Mockup C, aprovado pela Dani em 12/10/2026 com o
 * céu azul: estudo-apps-financas/login-bonito-proposta.html, seção #c). O logo Aurora vira
 * paisagem: o sol nasce atrás das ondas num céu suave e uma folha sobe por baixo com a frase.
 * No escuro é o céu de antes do sol, roxo e âmbar. No Entrar o céu encolhe e a folha cresce.
 *
 * Só SVG e CSS, sem imagem. A página rola inteira (a folha não é fixa), então com o teclado
 * aberto no celular o botão Entrar continua alcançável.
 *
 * As cores do protótipo viram as variáveis do tema (--color-*) dentro da tela, para o Campo e o
 * Aviso, que são das outras telas, combinarem sem mudar nada neles.
 */

const CLARO = `
  --a-bg:#F7F8FD; --a-ink:#1E140A; --a-muted:#61574B; --a-line:rgba(30,20,10,.12); --a-sec:#FFFFFF; --a-campo:#FFFFFF; --a-folha:#FDFDFF;
  --a-acc-ink:#3F4F9C; --a-pri:#1E140A; --a-on-pri:#FFF4E8;
  --a-ceu:linear-gradient(180deg,#C9DCF6 0%,#D9D6F2 38%,#F5E4EC 70%,#FFF8F3 100%); --a-ceu-ink:#1C2448; --a-nuvem:rgba(255,255,255,.75); --a-em:#4A5CB0;
  --a-arco:rgba(255,255,255,.22); --a-voltar:rgba(255,255,255,.35); --a-sombra:rgba(60,25,0,.35);`;
const ESCURO = `
  --a-bg:#120E16; --a-ink:#F6EFE6; --a-muted:#B0A79C; --a-line:rgba(246,239,230,.13); --a-sec:rgba(255,255,255,.06); --a-campo:rgba(255,255,255,.05); --a-folha:#16121A;
  --a-acc-ink:#F2C26E; --a-pri:#F6EFE6; --a-on-pri:#16121A;
  --a-ceu:linear-gradient(180deg,#151027 0%,#2E1D3E 34%,#6E3A43 66%,#D9804A 100%); --a-ceu-ink:#F6EFE6; --a-nuvem:rgba(255,220,200,.16); --a-em:#F5B867;
  --a-arco:rgba(255,255,255,.12); --a-voltar:rgba(255,255,255,.08); --a-sombra:rgba(0,0,0,.6);`;
/** O topo do céu pinta o fundo da página: a faixa do relógio no iPhone e a cor da barra seguem o céu. */
const TOPO_CLARO = "--color-canvas:#C9DCF6;";
const TOPO_ESCURO = "--color-canvas:#151027;";

const CSS = `
html:root:not(.dark) {${TOPO_CLARO}}
html:root:not(.dark) .amanhecer {${CLARO}}
@media (prefers-color-scheme: dark) {
  html:root:not(.light) {${TOPO_ESCURO}}
  html:root:not(.light) .amanhecer {${ESCURO}}
}
html.dark:root {${TOPO_ESCURO}}
html.dark:root .amanhecer {${ESCURO}}
.amanhecer {
  --color-ink: var(--a-ink); --color-ink-muted: var(--a-muted); --color-surface: var(--a-campo); --color-surface-2: var(--a-sec);
  --color-border-strong: var(--a-line); --color-accent-strong: var(--a-acc-ink);
  background: var(--a-ceu); color: var(--a-ink);
}
.am-ceu { position: relative; color: var(--a-ceu-ink); }
.am-ceu.inicio { flex: 1 1 auto; min-height: clamp(220px, 46dvh, 560px); }
.am-ceu.baixo { flex: none; height: clamp(168px, 30dvh, 260px); }
.am-marca { position: relative; z-index: 2; display: flex; align-items: center; gap: 8px; margin: 0;
  font-size: 12px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.am-sol-svg { position: absolute; left: -2%; right: -2%; top: calc(62px + var(--safe-top, 0px)); bottom: 52px; width: 104%; height: auto; overflow: visible; }
.am-ceu.inicio .am-sol-svg { height: calc(100% - 62px - var(--safe-top, 0px) - 52px); }
.am-ceu.baixo .am-sol-svg { left: auto; right: -4%; top: auto; bottom: 40px; width: min(64%, 300px); height: auto; aspect-ratio: 724 / 500; }
.am-sol { transform-box: view-box; animation: am-nasce 3.2s cubic-bezier(.2,.7,.2,1) .2s both; }
@keyframes am-nasce { from { transform: translateY(330px); } }
.am-halo { transform-box: fill-box; transform-origin: center; animation: am-respira 6s ease-in-out 3.4s infinite alternate; }
@keyframes am-respira { from { transform: scale(1); opacity: .35; } to { transform: scale(1.18); opacity: .6; } }
.am-arco-fora { fill: var(--a-arco); }
.am-nuvem { position: absolute; height: 34px; border-radius: 999px; background: var(--a-nuvem); filter: blur(6px); pointer-events: none; }
.am-nuvem.n1 { width: 140px; left: -20px; top: calc(120px + var(--safe-top, 0px)); animation: am-vento 22s ease-in-out infinite alternate; }
.am-nuvem.n2 { width: 100px; right: -10px; top: calc(200px + var(--safe-top, 0px)); animation: am-vento 18s ease-in-out infinite alternate-reverse; }
.am-ceu.baixo .am-nuvem.n2 { top: calc(110px + var(--safe-top, 0px)); }
@keyframes am-vento { to { transform: translateX(50px); } }
.am-voltar { position: relative; z-index: 4; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%;
  background: var(--a-voltar); border: 1px solid rgba(255,255,255,.4); color: var(--a-ceu-ink); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.am-folha { position: relative; z-index: 3; margin-top: -32px; display: flex; flex-direction: column; background: var(--a-folha);
  border-radius: 32px 32px 0 0; box-shadow: 0 -18px 40px -24px var(--a-sombra);
  animation: am-folha .7s cubic-bezier(.2,.8,.2,1) .1s both; }
.am-folha.alta { flex: 1 0 auto; }
@keyframes am-folha { from { transform: translateY(40px); opacity: 0; } }
.am-frase { margin: 0; font-size: clamp(26px, 8.8vw, 33px); letter-spacing: -.03em; font-weight: 600; line-height: 1.08; text-wrap: balance; }
.am-frase em { font-family: var(--font-cormorant), Georgia, serif; font-style: italic; font-weight: 600; font-size: 1.22em; letter-spacing: -.01em; color: var(--a-em); line-height: .9; }
.am-btn { display: flex; width: 100%; align-items: center; justify-content: center; height: 56px; border-radius: 999px; padding: 0 18px;
  font-size: 16.5px; font-weight: 600; white-space: nowrap; transition: transform .2s, opacity .2s; }
.am-btn:active { transform: scale(.98); }
.am-btn:disabled { cursor: not-allowed; opacity: .5; }
.am-btn:focus-visible, .am-voltar:focus-visible { outline: 2px solid var(--a-ink); outline-offset: 2px; }
.am-btn.pri { background: var(--a-pri); color: var(--a-on-pri); }
.am-btn.sec { background: var(--a-sec); color: var(--a-ink); box-shadow: inset 0 0 0 1.5px var(--a-line); }
.am-treme { animation: am-treme .55s cubic-bezier(.36,.07,.19,.97) .1s both; }
@keyframes am-treme { 0%,100% { transform: none; } 15% { transform: translateX(-9px); } 30% { transform: translateX(8px); } 45% { transform: translateX(-6px); } 60% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
@media (prefers-reduced-motion: reduce) {
  .amanhecer *, .amanhecer *::before, .amanhecer *::after { animation: none !important; transition: none !important; }
}
`;

/** A tela inteira: céu de fundo, a coluna no meio (no computador não passa de 480px). */
export function TelaAmanhecer({ children }: { children: ReactNode }) {
  return (
    <main className="amanhecer relative isolate flex min-h-dvh w-full justify-center overflow-x-clip font-sans">
      <style dangerouslySetInnerHTML={{ __html: cssDaEntrada() + CSS }} />
      <div className="flex min-h-dvh w-full max-w-[480px] flex-col">{children}</div>
    </main>
  );
}

/** O céu do Início (com a marca) ou do Entrar (`baixo`, com o voltar). */
export function Ceu({ baixo = false, voltar }: { baixo?: boolean; voltar?: { onClick: () => void } }) {
  return (
    <div
      className={`am-ceu ${baixo ? "baixo" : "inicio"} px-6 pt-[calc(20px+var(--safe-top,0px))] max-[340px]:px-5`}
    >
      <span aria-hidden className="am-nuvem n1" />
      <span aria-hidden className="am-nuvem n2" />
      {baixo ? (
        voltar && (
          <button type="button" onClick={voltar.onClick} aria-label="Voltar" className="am-voltar">
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
          </button>
        )
      ) : (
        <p className="am-marca">
          <BrandMark size={26} className="shadow-[0_2px_6px_rgba(0,0,0,0.18)]" />
          SPI Finance
        </p>
      )}
      <Sol />
    </div>
  );
}

/** O desenho do logo Aurora em paisagem: o sol (com o halo) sobe atrás das duas ondas. */
function Sol() {
  return (
    <svg className="am-sol-svg" viewBox="150 230 724 500" preserveAspectRatio="xMidYMax meet" aria-hidden focusable="false">
      <defs>
        <radialGradient id="am-sol" cx=".36" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".18" stopColor="#FFE3A3" />
          <stop offset=".75" stopColor="#F2A53A" />
          <stop offset="1" stopColor="#B4600F" />
        </radialGradient>
        <linearGradient id="am-onda" x1=".15" y1="0" x2=".85" y2="1">
          <stop offset="0" stopColor="#F7B04A" />
          <stop offset="1" stopColor="#B4600F" />
        </linearGradient>
        <linearGradient id="am-borda" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".2" />
          <stop offset="1" stopColor="#fff" stopOpacity=".6" />
        </linearGradient>
        <radialGradient id="am-halo">
          <stop offset=".45" stopColor="#FFE2B0" stopOpacity=".9" />
          <stop offset="1" stopColor="#FFE2B0" stopOpacity="0" />
        </radialGradient>
        <clipPath id="am-horizonte">
          <rect x="0" y="0" width="1024" height="690" />
        </clipPath>
      </defs>
      <g clipPath="url(#am-horizonte)">
        <g className="am-sol">
          <circle className="am-halo" cx="668" cy="400" r="240" fill="url(#am-halo)" />
          <circle cx="668" cy="400" r="124" fill="url(#am-sol)" />
        </g>
      </g>
      <path d="M183 690A329 329 0 0 1 841 690A61 61 0 0 1 719 690A207 207 0 0 0 305 690A61 61 0 0 1 183 690Z" className="am-arco-fora" />
      <path d="M183 690A329 329 0 0 1 841 690A61 61 0 0 1 719 690A207 207 0 0 0 305 690A61 61 0 0 1 183 690Z" fill="none" stroke="url(#am-borda)" strokeWidth="5" />
      <path d="M328 690A184 184 0 0 1 696 690A56 56 0 0 1 584 690A72 72 0 0 0 440 690A56 56 0 0 1 328 690Z" fill="url(#am-onda)" />
    </svg>
  );
}

/** A folha que sobe por baixo do céu. `alta` no Entrar: cresce até o fim da tela. */
export function Folha({ children, alta = false }: { children: ReactNode; alta?: boolean }) {
  return (
    <section
      className={`am-folha ${alta ? "alta gap-4 pt-[26px]" : "pt-7"} px-6 pb-[calc(22px+var(--safe-bottom,0px))] max-[340px]:px-5`}
    >
      {children}
    </section>
  );
}

/** A frase grande. A parte em itálico (Cormorant Garamond) vai num <em>. */
export function Frase({ children, como: Tag = "h1" }: { children: ReactNode; como?: "h1" | "h2" }) {
  return <Tag className="am-frase">{children}</Tag>;
}

export const AM_BOTAO = "am-btn pri";
export const AM_BOTAO_SEC = "am-btn sec";
