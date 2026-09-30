/**
 * Gera o manual em PDF (public/manual-spi-finance.pdf) a partir de src/lib/manual/conteudo.ts,
 * o mesmo texto da página /guia. Mudou uma regra? Muda o conteúdo e roda de novo:
 *
 *   npx tsx scripts/gerar-manual-pdf.tsx
 *
 * Monta um HTML (A4, capa escura, páginas claras na paleta do app) e imprime com o Chrome
 * sem janela. Os ícones são os mesmos do app (lucide), desenhados como SVG.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AlertTriangle, Check, Copy, CreditCard, FileText, Landmark, Layers, ListChecks, PiggyBank, Plus, Rocket, ShoppingBag, Target, Undo2, Users, Wallet, type LucideIcon } from "lucide-react";
import { SECOES_DO_MANUAL, NOMES_PADRAO, comNomes, type BlocoDoManual, type IconeDoManual } from "../src/lib/manual/conteudo";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RAIZ = path.resolve(__dirname, "..");
const SAIDA = path.join(RAIZ, "public", "manual-spi-finance.pdf");
const ICONE_APP = `data:image/png;base64,${fs.readFileSync(path.join(RAIZ, "public/icons/icon-512.png")).toString("base64")}`;

const ICONES: Record<IconeDoManual, LucideIcon> = {
  rocket: Rocket, file: FileText, cards: Layers, copy: Copy, check: ListChecks, undo: Undo2, plus: Plus,
  wallet: Wallet, target: Target, piggy: PiggyBank, bag: ShoppingBag, users: Users, alert: AlertTriangle,
};
const svg = (Icone: LucideIcon, tamanho = 18, cor = "currentColor") => renderToStaticMarkup(createElement(Icone, { size: tamanho, color: cor, strokeWidth: 1.9 }));
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (t: string) => esc(comNomes(t, NOMES_PADRAO));

const ICONE_OK = svg(Check, 15, "#B8630F");
const ICONE_ALERTA = svg(AlertTriangle, 15, "#D9502F");

function bloco(b: BlocoDoManual): string {
  if (b.tipo === "passos") {
    return `<ol class="passos">${b.itens
      .map((p, i) => `<li><span class="num">${i + 1}</span><div><b>${n(p.titulo)}</b><p>${n(p.texto)}</p></div></li>`)
      .join("")}</ol>`;
  }
  if (b.tipo === "comparacao") {
    const icones = [svg(Landmark, 26, "#B8630F"), svg(CreditCard, 26, "#B8630F")];
    return `<div class="comparacao">${b.colunas
      .map(
        (c, i) => `<div class="coluna"><div class="coluna-topo">${icones[i] ?? ""}<div><b>${esc(c.titulo)}</b><span>${esc(c.subtitulo)}</span></div></div>
        <ul>${c.itens.map((t) => `<li>${ICONE_OK}<span>${n(t)}</span></li>`).join("")}</ul></div>`,
      )
      .join('<div class="versus">×</div>')}</div>`;
  }
  if (b.tipo === "regras") {
    return `<ul class="regras">${b.itens.map((r) => `<li class="${r.atencao ? "atencao" : ""}">${r.atencao ? ICONE_ALERTA : ICONE_OK}<span>${n(r.texto)}</span></li>`).join("")}</ul>`;
  }
  return `<p class="dica ${b.alerta ? "alerta" : ""}">${b.alerta ? ICONE_ALERTA : ICONE_OK}<span>${n(b.texto)}</span></p>`;
}

const secoes = SECOES_DO_MANUAL.map(
  (s, i) => `<section class="secao">
    <div class="secao-topo">
      <span class="badge">${svg(ICONES[s.icone], 22, "#B8630F")}</span>
      <div><span class="parte">Parte ${i + 1}</span><h2>${n(s.titulo)}</h2><p class="resumo">${n(s.resumo)}</p></div>
    </div>
    ${s.blocos.map(bloco).join("")}
  </section>`,
).join("");

const indice = SECOES_DO_MANUAL.map((s, i) => `<li><span>${i + 1}</span>${n(s.titulo)}</li>`).join("");

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 16mm 15mm 16mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; margin: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Albert Sans', sans-serif; color: #1C1712; background: #FFFFFF; font-size: 10.5pt; line-height: 1.45; }
b { font-weight: 700; }

.capa { height: 297mm; width: 210mm; background: #141210; color: #F4EFE7; position: relative; overflow: hidden; padding: 30mm 22mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.capa::before { content: ""; position: absolute; inset: 0; background: radial-gradient(60% 45% at 95% 0%, rgba(242,160,61,.45), transparent 70%), radial-gradient(55% 40% at 0% 100%, rgba(247,188,110,.22), transparent 70%); }
.capa > * { position: relative; }
.capa img { width: 34mm; height: 34mm; border-radius: 8mm; box-shadow: 0 6mm 16mm rgba(0,0,0,.5); }
.capa .kicker { font-size: 12pt; color: #F7BC6E; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.capa h1 { font-size: 40pt; line-height: 1.02; letter-spacing: -.035em; font-weight: 800; margin-top: 5mm; }
.capa .sub { font-size: 14pt; color: #CFC3B2; margin-top: 6mm; max-width: 140mm; }
.capa .indice { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2.2mm 8mm; font-size: 10pt; color: #D9CDBB; }
.capa .indice li { display: flex; gap: 2mm; }
.capa .indice span { flex: 0 0 6mm; color: #F2A03D; font-weight: 800; }
.capa .rodape { font-size: 9pt; color: #9A8E7E; }

.aviso-temas { background: #FFF8EE; border: 1px solid #F4D9B5; border-radius: 4mm; padding: 3.5mm 4.5mm; font-size: 9.5pt; color: #6B5A45; margin-bottom: 5mm; }

.secao { background: #FCF8F2; border: 1px solid #EDE3D5; border-radius: 5mm; padding: 6mm 6.5mm; margin-bottom: 5mm; break-inside: avoid; }
.secao > * + * { margin-top: 4mm; }
.secao-topo { display: flex; gap: 4mm; align-items: flex-start; margin-bottom: 4mm; }
.badge { width: 12mm; height: 12mm; border-radius: 3.5mm; background: #FBE7CC; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.parte { font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #A89A87; }
h2 { font-size: 16pt; letter-spacing: -.02em; line-height: 1.15; }
.resumo { color: #6E6355; margin-top: 1mm; }

.passos { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 3mm; margin-top: 1mm; }
.passos li { display: flex; gap: 3.5mm; align-items: flex-start; }
.passos .num { width: 8mm; height: 8mm; border-radius: 50%; background: #1C1712; color: #F7BC6E; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11pt; }
.passos p { color: #6E6355; }

.comparacao { display: flex; gap: 3mm; align-items: stretch; }
.coluna { flex: 1; background: #F7F1E7; border-radius: 4mm; padding: 4mm; }
.coluna-topo { display: flex; gap: 3mm; align-items: center; margin-bottom: 3mm; }
.coluna-topo b { display: block; font-size: 14pt; }
.coluna-topo span { font-size: 9pt; color: #857A6C; }
.versus { align-self: center; font-size: 16pt; font-weight: 800; color: #E0821B; }

ul.regras, .coluna ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 2mm; }
ul.regras li, .coluna li { display: flex; gap: 2.5mm; align-items: flex-start; }
ul.regras svg, .coluna svg, .dica svg { flex-shrink: 0; margin-top: .6mm; }
ul.regras li.atencao span { color: #3A2A20; }

.dica { display: flex; gap: 2.5mm; background: #FBE7CC; border-radius: 3.5mm; padding: 3mm 4mm; }
.dica.alerta { background: #FBE1D9; }

.fim { background: #141210; color: #F4EFE7; border-radius: 5mm; padding: 7mm; display: flex; gap: 5mm; align-items: center; break-inside: avoid; }
.fim img { width: 16mm; height: 16mm; border-radius: 4mm; }
.fim b { font-size: 13pt; }
.fim p { color: #CFC3B2; margin-top: 1mm; }
.fim .link { color: #F7BC6E; font-weight: 700; }
</style></head><body>
<div class="capa">
  <div>
    <img src="${ICONE_APP}">
    <p class="kicker" style="margin-top:14mm">Manual do app</p>
    <h1>Como usar o<br>SPI Finance</h1>
    <p class="sub">As regras que fazem os seus números baterem: extrato e fatura, o que não duplica, o que só vale depois do Salvar.</p>
  </div>
  <div>
    <ol class="indice">${indice}</ol>
    <p class="rodape" style="margin-top:12mm">Abra o app em financas.danicolombo.com.br · Este manual também está no app, em Mais › Como usar o app.</p>
  </div>
</div>

<p class="aviso-temas"><b>Os nomes podem mudar com o tema que você escolheu.</b> Orçamento pode aparecer como Combinado, Limites ou Plano; Foco como Objetivo, Intenção ou Na real; Metas como Sonhos ou Missões; Aporte como Guardou. As regras são as mesmas.</p>
${secoes}
<div class="fim">
  <img src="${ICONE_APP}">
  <div><b>Ficou alguma dúvida?</b><p>Fale com a gente pelo suporte do app ou em <span class="link">app@danicolombo.com.br</span>. E guarde este PDF pra consultar quando for subir um arquivo novo.</p></div>
</div>
</body></html>`;

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "manual-"));
const arquivoHtml = path.join(pasta, "manual.html");
fs.writeFileSync(arquivoHtml, html);
execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=6000", `--print-to-pdf=${SAIDA}`, `file://${arquivoHtml}`], { stdio: "ignore" });
fs.rmSync(pasta, { recursive: true, force: true });
console.log(`PDF gerado: ${SAIDA} (${Math.round(fs.statSync(SAIDA).size / 1024)} KB)`);
