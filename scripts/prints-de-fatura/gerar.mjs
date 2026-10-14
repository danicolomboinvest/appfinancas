/**
 * Prints de TESTE da fatura aberta, para o leitor de prints (src/lib/import/print-fatura.ts).
 *
 * Desenha, com HTML e Playwright, a lista de compras da fatura aberta no jeito de nove layouts de
 * banco (Nubank, Itaú, Inter, C6, BTG, Santander, Bradesco, XP e o cartão do app BTG/EQI) e tira 3 prints rolando a mesma
 * lista, com sobreposição, como a pessoa faria no celular. Os layouts são aproximações (cores,
 * cabeçalho de data, onde fica o valor e a parcela), não cópias das telas. Nenhum dado é de
 * alguém: lojas genéricas e valores inventados.
 *
 * Uso: node scripts/prints-de-fatura/gerar.mjs <pasta-de-saída>
 * (precisa do playwright instalado em algum node_modules; PLAYWRIGHT=/caminho/do/pacote)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT ?? "playwright");

const saida = process.argv[2];
if (!saida) throw new Error("uso: gerar.mjs <pasta-de-saída>");
fs.mkdirSync(saida, { recursive: true });

/** Dia em que os prints são "enviados": terça, 13/10/2026. */
const ENVIO = "2026-10-13";

/** A mesma fatura para todos os bancos, com variação por banco no nome das lojas. */
const BASE = [
  { d: "2026-10-13", nome: "Padaria Pão Dourado", valor: 23.5 },
  { d: "2026-10-13", nome: "Uber Trip", valor: 18.92 },
  { d: "2026-10-12", nome: "Supermercado Bom Preço", valor: 287.43 },
  { d: "2026-10-12", nome: "Café Grão Fino", valor: 8.5 },
  { d: "2026-10-12", nome: "Café Grão Fino", valor: 8.5 },
  { d: "2026-10-11", nome: "Farmácia Vida Leve", valor: 64.9 },
  { d: "2026-10-11", nome: "Loja Casa Nova", valor: 150.0, parcela: [2, 3] },
  { d: "2026-10-10", nome: "Netflix.com", valor: 44.9 },
  { d: "2026-10-10", nome: "Estorno Loja Esporte Max", valor: -89.9, credito: true },
  { d: "2026-10-09", nome: "Posto Estrada Real", valor: 210.0 },
  { d: "2026-10-09", nome: "iFood Restaurante Sabor", valor: 56.8 },
  { d: "2026-10-08", nome: "Pagamento recebido", valor: -1200.0, pagamento: true },
  { d: "2026-10-08", nome: "Livraria Página Um", valor: 79.9 },
  { d: "2026-10-07", nome: "Academia Corpo Ativo", valor: 119.9 },
  { d: "2026-10-06", nome: "Pet Shop Amigo Fiel", valor: 132.4 },
  { d: "2026-10-05", nome: "Eletro Ponto Com", valor: 1249.0, parcela: [1, 10] },
  { d: "2026-10-04", nome: "Hortifruti Verde Vale", valor: 47.35 },
  { d: "2026-10-03", nome: "Cinema Estrela", valor: 62.0 },
  { d: "2026-10-02", nome: "Spotify", valor: 21.9 },
  { d: "2026-10-01", nome: "Restaurante Bom Garfo", valor: 98.6 },
];

/**
 * O cartão do app BTG/EQI (14/10/2026): cada compra num cartão de 4 linhas (tipo, nome, ramo do
 * banco e o valor embaixo à direita), cabeçalho "Hoje 13/Out" / "14/Set", e a parcela no
 * cabeçalho da compra ORIGINAL (por isso a lista própria, com datas de setembro e agosto).
 */
const BTG_CARTAO = [
  { d: "2026-10-13", nome: "Papelaria Ponto Azul", valor: 1874.3, ramo: "Outra Categoria" },
  { d: "2026-10-13", nome: "Mercado Bairro Feliz", valor: 312.47, ramo: "Supermercados" },
  { d: "2026-10-12", nome: "Posto Via Norte", valor: 189.0, ramo: "Veículos" },
  { d: "2026-10-12", nome: "Restaurante Sabor Caseiro", valor: 74.9, ramo: "Restaurantes" },
  { d: "2026-10-10", nome: "Loja Esporte Max", valor: -89.9, credito: true, tipo: "Estorno de compra", ramo: "Outra Categoria" },
  { d: "2026-10-09", nome: "Farmácia Bem Estar", valor: 58.35, ramo: "Saúde" },
  { d: "2026-10-07", nome: "Shop.com* Casa Util", valor: 39.9, ramo: "Outra Categoria" },
  { d: "2026-10-05", nome: "Cursos Saber Mais", valor: 2450.0, ramo: "Educação" },
  { d: "2026-10-02", nome: "Pet Amigo Fiel", valor: 132.4, ramo: "Outra Categoria" },
  { d: "2026-09-21", nome: "Eletro Ponto Com", valor: 1249.0, parcela: [2, 10], ramo: "Eletrônicos" },
  { d: "2026-09-14", nome: "Clinica Sorriso Bom", valor: 845.6, parcela: [2, 8], ramo: "Saúde" },
  { d: "2026-08-05", nome: "Móveis Casa Nova", valor: 1320.75, parcela: [3, 6], ramo: "Casa e decoração" },
];

const MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const mesLongo = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const SEM3 = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const dt = (iso) => new Date(`${iso}T12:00:00Z`);
const dd = (iso) => iso.slice(8, 10);
const mm = (iso) => iso.slice(5, 7);
const diasAtras = (iso) => Math.round((dt(ENVIO) - dt(iso)) / 86400000);
const brl = (v) => Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Cabeçalho de data de cada banco. */
const cabecalho = {
  itau: (iso) => (diasAtras(iso) === 0 ? "hoje" : diasAtras(iso) === 1 ? "ontem" : `${SEMANA[dt(iso).getUTCDay()]}, ${dd(iso)} ${MES[Number(mm(iso)) - 1].toLowerCase()}`),
  inter: (iso) => (diasAtras(iso) === 0 ? "Hoje" : diasAtras(iso) === 1 ? "Ontem" : diasAtras(iso) < 6 ? SEMANA[dt(iso).getUTCDay()].replace(/^./, (c) => c.toUpperCase()) : `${dd(iso)} de ${mesLongo[Number(mm(iso)) - 1]}`),
  c6: (iso) => `${SEM3[dt(iso).getUTCDay()]}, ${dd(iso)} ${MES[Number(mm(iso)) - 1]}`,
  santander: (iso) => `${dd(iso)}/${mm(iso)}/${iso.slice(0, 4)}`,
  btgCartao: (iso) => {
    const m = MES[Number(mm(iso)) - 1];
    const dm = `${dd(iso)}/${m[0]}${m.slice(1).toLowerCase()}`;
    return diasAtras(iso) === 0 ? `Hoje ${dm}` : diasAtras(iso) === 1 ? `Ontem ${dm}` : dm;
  },
  xp: (iso) => (diasAtras(iso) === 0 ? "Hoje" : diasAtras(iso) === 1 ? "Ontem" : `${Number(dd(iso))} de ${mesLongo[Number(mm(iso)) - 1]}`),
};

const BANCOS = {
  nubank: {
    fundo: "#ffffff", tinta: "#111", suave: "#6b6b6b", destaque: "#820ad1",
    topo: `<div style="background:#820ad1;color:#fff;padding:18px 20px 22px"><div style="font-size:15px;opacity:.85">Fatura atual</div><div style="font-size:30px;font-weight:600;margin-top:4px">R$ 4.338,49</div><div style="font-size:14px;margin-top:6px;opacity:.85">Limite disponível R$ 3.661,51</div><div style="display:flex;gap:10px;margin-top:14px"><span style="background:#fff;color:#820ad1;border-radius:20px;padding:8px 16px;font-size:14px;font-weight:600">Pagar fatura</span><span style="border:1px solid #fff;border-radius:20px;padding:8px 16px;font-size:14px">Parcelar</span></div></div>`,
    linha: (c) => `<div class="l"><div style="width:52px;font-size:13px;color:#6b6b6b;font-weight:600">${dd(c.d)} ${MES[Number(mm(c.d)) - 1]}</div><div style="flex:1"><div class="n">${c.nome}</div>${c.parcela ? `<div class="s">Parcela ${c.parcela[0]}/${c.parcela[1]}</div>` : `<div class="s">${c.credito ? "Estorno" : "Compra"}</div>`}</div><div class="v" style="color:${c.valor < 0 ? "#0a8a3a" : "#111"}">${c.valor < 0 ? "- " : ""}R$ ${brl(c.valor)}</div></div>`,
  },
  itau: {
    fundo: "#f4f4f4", tinta: "#222", suave: "#6e6e6e", destaque: "#ec7000", cab: cabecalho.itau,
    topo: `<div style="background:#ec7000;color:#fff;padding:18px 20px"><div style="font-size:15px">fatura aberta</div><div style="font-size:28px;font-weight:700;margin-top:4px">R$ 4.338,49</div><div style="font-size:13px;margin-top:4px">vence em 20/11 · fecha em 13/11</div></div><div style="padding:12px 20px;font-size:14px;color:#6e6e6e">total até agora R$ 4.338,49</div>`,
    linha: (c) => `<div class="l" style="background:#fff;margin:0 12px 1px;border-radius:6px"><div style="flex:1"><div class="n" style="text-transform:uppercase">${c.nome}</div>${c.parcela ? `<div class="s">${c.parcela[0]}/${c.parcela[1]}</div>` : ""}</div><div class="v" style="color:${c.valor < 0 ? "#1a7f37" : "#222"}">${c.valor < 0 ? "-R$ " : "R$ "}${brl(c.valor)}</div></div>`,
  },
  inter: {
    fundo: "#ffffff", tinta: "#161616", suave: "#6a6a6a", destaque: "#ff7a00", cab: cabecalho.inter,
    topo: `<div style="padding:18px 20px;border-bottom:1px solid #eee"><div style="font-size:14px;color:#6a6a6a">Fatura aberta</div><div style="font-size:28px;font-weight:700;color:#ff7a00">R$ 4.338,49</div><div style="font-size:13px;color:#6a6a6a">Limite disponível: R$ 5.661,51</div><div style="margin-top:12px;background:#ff7a00;color:#fff;border-radius:8px;padding:10px;text-align:center;font-weight:600">Pagar fatura</div></div>`,
    linha: (c) => `<div class="l"><div style="width:36px;height:36px;border-radius:18px;background:#fff1e6;margin-right:12px"></div><div style="flex:1"><div class="n">${c.nome}</div><div class="s">${c.parcela ? `Parcela ${c.parcela[0]} de ${c.parcela[1]}` : "Crédito"}</div></div><div class="v" style="color:${c.valor < 0 ? "#0b8f4d" : "#161616"}">${c.valor < 0 ? "+ " : ""}R$ ${brl(c.valor)}</div></div>`,
  },
  c6: {
    fundo: "#0d0d0d", tinta: "#f2f2f2", suave: "#9a9a9a", destaque: "#f2f2f2", cab: cabecalho.c6,
    topo: `<div style="padding:18px 20px"><div style="font-size:14px;color:#9a9a9a">Fatura atual</div><div style="font-size:30px;font-weight:600">R$ 4.338,49</div><div style="font-size:13px;color:#9a9a9a;margin-top:4px">Fecha em 13 NOV · Vence em 20 NOV</div><div style="display:flex;gap:10px;margin-top:14px"><span style="background:#f2f2f2;color:#0d0d0d;border-radius:20px;padding:8px 16px;font-size:14px;font-weight:600">Pagar fatura</span></div></div>`,
    linha: (c) => `<div class="l" style="border-bottom:1px solid #222"><div style="flex:1"><div class="n">${c.nome}</div>${c.parcela ? `<div class="s">Parcela ${c.parcela[0]} de ${c.parcela[1]}</div>` : ""}</div><div class="v">${c.valor < 0 ? "-R$ " : "R$ "}${brl(c.valor)}</div></div>`,
  },
  btg: {
    fundo: "#0b1c3a", tinta: "#ffffff", suave: "#a9b6cf", destaque: "#ffffff",
    topo: `<div style="padding:18px 20px"><div style="font-size:14px;color:#a9b6cf">Fatura em aberto</div><div style="font-size:28px;font-weight:600">R$ 4.338,49</div><div style="font-size:13px;color:#a9b6cf">Limite total R$ 10.000,00</div></div><div style="padding:6px 20px;font-size:13px;color:#a9b6cf;display:flex;justify-content:space-between"><span>Data</span><span>Descrição</span><span>Valor</span></div>`,
    linha: (c) => `<div class="l" style="border-bottom:1px solid #1d3360"><div style="width:56px;font-size:15px;color:#a9b6cf">${dd(c.d)}/${mm(c.d)}</div><div style="flex:1"><div class="n">${c.nome}${c.parcela ? ` ${String(c.parcela[0]).padStart(2, "0")}/${String(c.parcela[1]).padStart(2, "0")}` : ""}</div></div><div class="v">${c.valor < 0 ? "-R$ " : "R$ "}${brl(c.valor)}</div></div>`,
  },
  santander: {
    fundo: "#ffffff", tinta: "#222", suave: "#767676", destaque: "#ec0000", cab: cabecalho.santander,
    topo: `<div style="background:#ec0000;color:#fff;padding:18px 20px"><div style="font-size:15px">Fatura atual (aberta)</div><div style="font-size:28px;font-weight:700">R$ 4.338,49</div><div style="font-size:13px">Melhor dia de compra: 14</div></div>`,
    linha: (c) => `<div class="l" style="border-bottom:1px solid #eee"><div style="flex:1"><div class="n" style="text-transform:uppercase">${c.nome}${c.parcela ? ` PARC ${String(c.parcela[0]).padStart(2, "0")}/${String(c.parcela[1]).padStart(2, "0")}` : ""}</div></div><div class="v">${c.valor < 0 ? "-" : ""}${brl(c.valor)}</div></div>`,
  },
  bradesco: {
    fundo: "#ffffff", tinta: "#222", suave: "#707070", destaque: "#cc092f",
    topo: `<div style="background:#cc092f;color:#fff;padding:18px 20px"><div style="font-size:15px">Cartão final 1234</div><div style="font-size:14px;margin-top:8px">Fatura aberta</div><div style="font-size:28px;font-weight:700">R$ 4.338,49</div><div style="font-size:13px">Disponível R$ 2.661,51</div></div><div style="padding:10px 20px;font-size:14px;color:#707070">Lançamentos</div>`,
    linha: (c) => `<div class="l" style="border-bottom:1px solid #eee"><div style="width:52px;font-size:14px;color:#707070">${dd(c.d)}/${mm(c.d)}</div><div style="flex:1"><div class="n">${c.nome}</div>${c.parcela ? `<div class="s">${String(c.parcela[0]).padStart(2, "0")}/${String(c.parcela[1]).padStart(2, "0")}</div>` : ""}</div><div class="v" style="color:${c.valor < 0 ? "#1a7f37" : "#222"}">R$ ${c.valor < 0 ? "-" : ""}${brl(c.valor)}</div></div>`,
  },
  "btg-cartao": {
    lista: BTG_CARTAO,
    fundo: "#ffffff", tinta: "#1d1d1d", suave: "#7a7a7a", destaque: "#0b3b2e",
    cab: cabecalho.btgCartao,
    estiloCab: "padding:40px 24px 10px;font-size:19px;font-weight:400;color:#0b3b2e",
    topo: `<div style="background:#022a1f;color:#fff;margin-top:-44px;padding:44px 24px 40px"><div style="height:60px"></div><div style="font-size:26px">Fatura</div></div><div style="background:#dcdee0;padding:22px 24px;color:#1d1d1d"><div style="font-size:16px">Resumo da Fatura</div><div style="margin-top:22px;font-size:15px">Compras e despesas</div><div style="font-size:14px;color:#555">Total R$ 4.338,49</div><div style="border-top:1px solid #b8bbbe;margin:18px 0"></div><div style="font-size:15px">Fatura anterior e pagamentos</div><div style="font-size:14px;color:#555">Total R$ 5.120,00</div></div><div style="display:flex;justify-content:space-between;padding:30px 24px 0;color:#0b3b2e"><span style="font-size:17px">Atividades</span><span style="font-size:15px;text-decoration:underline">Filtrar</span></div>`,
    linha: (c) => `<div style="display:flex;align-items:flex-start;padding:24px 24px 6px"><div style="width:40px;height:40px;border-radius:20px;background:#2f6f8f;margin-right:16px;flex:none"></div><div style="flex:1;min-width:0"><div style="font-size:12px;color:#3a3a3a">${c.tipo ?? (c.parcela ? "Compra no crédito parcelada" : "Compra no crédito")}</div><div style="font-size:15px;margin-top:9px">${c.nome}${c.parcela ? ` (${c.parcela[0]}/${c.parcela[1]})` : ""}</div><div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:9px"><span style="font-size:12px;color:#7a7a7a">${c.ramo}</span><span style="font-size:15px;white-space:nowrap">${c.valor < 0 ? "+ " : "- "}R$ ${brl(c.valor)}</span></div></div></div>`,
  },
  xp: {
    fundo: "#000000", tinta: "#ffffff", suave: "#9b9b9b", destaque: "#fbc105", cab: cabecalho.xp,
    topo: `<div style="padding:18px 20px"><div style="font-size:14px;color:#9b9b9b">Fatura aberta</div><div style="font-size:28px;font-weight:700;color:#fbc105">R$ 4.338,49</div><div style="font-size:13px;color:#9b9b9b">Vencimento 20/11</div><div style="margin-top:12px;border:1px solid #fbc105;color:#fbc105;border-radius:8px;padding:10px;text-align:center;font-weight:600">Pagar fatura</div></div>`,
    linha: (c) => `<div class="l"><div style="flex:1"><div class="n">${c.nome}</div><div class="s">${c.parcela ? `${c.parcela[0]}/${c.parcela[1]}` : "Cartão final 4321"}</div></div><div class="v">${c.valor < 0 ? "-R$ " : "R$ "}${brl(c.valor)}</div></div>`,
  },
};

function pagina(banco) {
  const b = BANCOS[banco];
  let corpo = "";
  let ultimo = null;
  for (const c of b.lista ?? BASE) {
    if (b.cab && c.d !== ultimo) {
      corpo += `<div class="h"${b.estiloCab ? ` style="${b.estiloCab}"` : ""}>${b.cab(c.d)}</div>`;
      ultimo = c.d;
    }
    corpo += b.linha(c);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<style>
  body{margin:0;background:${b.fundo};color:${b.tinta};font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
  .status{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 24px;font-weight:600;font-size:15px}
  .h{padding:16px 20px 6px;font-size:14px;font-weight:600;color:${b.suave}}
  .l{display:flex;align-items:center;padding:14px 20px;min-height:40px}
  .n{font-size:16px;font-weight:500}
  .s{font-size:13px;color:${b.suave};margin-top:3px}
  .v{font-size:16px;font-weight:500;white-space:nowrap;margin-left:12px}
</style></head><body><div class="status"><span>9:41</span><span>100%</span></div>${b.topo}${corpo}<div style="height:40px"></div></body></html>`;
}

const navegador = await chromium.launch();
// `bancos`: o layout com lista própria (o cartão do BTG/EQI); os outros usam `compras`.
const gabarito = { envio: ENVIO, compras: BASE, bancos: { "btg-cartao": BTG_CARTAO } };
for (const banco of Object.keys(BANCOS)) {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.ESCALA ?? 3) });
  const p = await ctx.newPage();
  await p.setContent(pagina(banco));
  // 3 prints rolando a lista, cada um com um pedaço do anterior (como quem rola no celular).
  const alto = await p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (const [i, y] of [0, Math.round(alto / 2), alto].entries()) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y);
    await p.screenshot({ path: path.join(saida, `${banco}-${i + 1}.png`) });
  }
  await ctx.close();
}
await navegador.close();
fs.writeFileSync(path.join(saida, "gabarito.json"), JSON.stringify(gabarito, null, 2));
console.log("ok", saida);
