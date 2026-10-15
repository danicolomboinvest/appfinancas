import type { Page, APIRequestContext } from "@playwright/test";
import { reais, todosOsReais } from "./dinheiro";
import { problemasDeLayout, problemasNoTexto, textoVisivel } from "./texto";
import type { Caderno } from "./achados";
import { pularTutoriais } from "./acoes";

/**
 * O retrato de cada tela: os números e avisos que ela mostra, lidos do jeito que a cliente vê.
 * Cada leitura também confere texto quebrado e layout a 375 px e anota no caderno.
 */

export type Mes = { ano: number; mes: number };
export const NOMES_DOS_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

async function esperarTela(p: Page) {
  await p.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  // A folha de novidades e o tutorial do casal não fazem parte da conferência.
}

/** Abre a rota e confere texto e layout. */
export async function abrir(p: Page, rota: string, caderno: Caderno, nomeDaTela: string) {
  await p.goto(rota);
  await esperarTela(p);
  await pularTutoriais(p);
  await conferirTextoELayout(p, caderno, nomeDaTela);
}

const jaVistos = new Set<string>();
export async function conferirTextoELayout(p: Page, caderno: Caderno, nomeDaTela: string) {
  const texto = await textoVisivel(p);
  for (const pr of problemasNoTexto(texto)) {
    const chave = `${caderno.perfil}|texto|${nomeDaTela}|${pr.motivo}|${pr.trecho}`;
    if (jaVistos.has(chave)) continue;
    jaVistos.add(chave);
    await caderno.anotar(p, { tipo: "texto", telaDeOrigem: nomeDaTela, telaErrada: nomeDaTela, esperado: `sem ${pr.motivo}`, visto: pr.trecho, chave });
  }
  for (const pr of await problemasDeLayout(p)) {
    const chave = `${caderno.perfil}|tela|${nomeDaTela}|${pr.motivo.replace(/\d+px/g, "")}|${pr.onde}`;
    if (jaVistos.has(chave)) continue;
    jaVistos.add(chave);
    await caderno.anotar(p, { tipo: "tela", telaDeOrigem: nomeDaTela, telaErrada: nomeDaTela, esperado: "nada cortado nem rolagem lateral a 375 px", visto: `${pr.motivo}: ${pr.onde}`, chave });
  }
  return texto;
}

const linhas = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

// ------------------------------------------------------------------ Orçamento
export type RetratoDoOrcamento = {
  plano: number | null;
  livres: number | null;
  acimaDoPlano: number | null;
  gastou: number | null;
  aVencer: number | null;
  categorias: Record<string, { gasto: number; plano: number; texto: string }>;
  alerta: string | null;
};

export async function lerOrcamento(p: Page, caderno: Caderno, m: Mes, atual = true): Promise<RetratoDoOrcamento> {
  await abrir(p, atual ? `/orcamento/${m.ano}` : `/orcamento/${m.ano}?mes=${m.ano}-${String(m.mes).padStart(2, "0")}`, caderno, `Orçamento ${m.mes}/${m.ano}`);
  const t = await textoVisivel(p);
  const ls = linhas(t);
  const r: RetratoDoOrcamento = { plano: null, livres: null, acimaDoPlano: null, gastou: null, aVencer: null, categorias: {}, alerta: null };
  const iPlano = ls.findIndex((l) => /^Plano de /.test(l));
  if (iPlano >= 0) r.plano = reais(ls.slice(iPlano, iPlano + 2).join(" "));
  const heroi = ls.slice(iPlano, iPlano + 12).join(" ");
  const livre = heroi.match(/R\$\s*([\d.,]+)\s*livres/);
  if (livre) r.livres = reais(`R$ ${livre[1]}`);
  const acima = heroi.match(/R\$\s*([\d.,]+)\s*acima do plano/);
  if (acima) r.acimaDoPlano = reais(`R$ ${acima[1]}`);
  const gastou = heroi.match(/Gastou (R\$\s*[\d.,]+)/);
  if (gastou) r.gastou = reais(gastou[1]);
  const aVencer = heroi.match(/(R\$\s*[\d.,]+) a vencer/);
  if (aVencer) r.aVencer = reais(aVencer[1]);
  const alerta = p.locator("[data-alerta-orcamento]");
  r.alerta = (await alerta.count()) ? (await alerta.first().innerText()).split("\n")[0].trim() : null;
  for (const el of await p.locator('[data-brilho^="cat-"]').all()) {
    const chave = ((await el.getAttribute("data-brilho")) ?? "").slice(4);
    const tx = (await el.innerText()).replace(/\n/g, " | ");
    const m2 = tx.match(/(R\$\s*[\d.,]+) de (R\$\s*[\d.,]+)/);
    if (m2) r.categorias[chave] = { gasto: reais(m2[1]) ?? 0, plano: reais(m2[2]) ?? 0, texto: tx };
    else {
      const v = todosOsReais(tx);
      r.categorias[chave] = { gasto: v[0] ?? 0, plano: 0, texto: tx };
    }
  }
  return r;
}

// ------------------------------------------------------------------ Transações
export type RetratoDasTransacoes = {
  contagem: number | null;
  linhas: { descricao: string; categoria: string; valor: number }[];
};

export async function lerTransacoes(p: Page, caderno: Caderno, m: Mes): Promise<RetratoDasTransacoes> {
  await abrir(p, `/mensal/${m.ano}/${m.mes}`, caderno, `Transações ${m.mes}/${m.ano}`);
  const t = await textoVisivel(p);
  const c = t.match(/(\d+)\s+lan[çc]amentos?/);
  const r: RetratoDasTransacoes = { contagem: c ? Number(c[1]) : null, linhas: [] };
  for (const el of await p.locator("[data-linha-transacao]").all()) {
    // No casal a linha começa com a bolinha de quem lançou ("B", "C"): não é a descrição.
    const ls = linhas(await el.innerText()).filter((l, i) => !(i === 0 && l.length <= 2));
    const valorTxt = ls.find((l) => /R\$/.test(l)) ?? "";
    const v = reais(valorTxt) ?? 0;
    r.linhas.push({ descricao: ls[0] ?? "", categoria: (ls[1] ?? "").replace(/ · .*$/, ""), valor: /^\+/.test(valorTxt) ? Math.abs(v) : v });
  }
  return r;
}

// ------------------------------------------------------------------ Gastos por categoria
export async function lerGastos(p: Page, caderno: Caderno, m: Mes): Promise<{ total: number | null; categorias: Record<string, number> }> {
  await abrir(p, `/mensal/gastos?view=mes&year=${m.ano}&month=${m.mes}`, caderno, `Gastos ${m.mes}/${m.ano}`);
  const ls = linhas(await textoVisivel(p));
  const iG = ls.findIndex((l) => l === "Gastou");
  const total = iG >= 0 ? reais(ls.slice(iG, iG + 4).find((l) => /R\$/.test(l))) : null;
  const categorias: Record<string, number> = {};
  for (let i = iG + 1; i < ls.length - 1; i++) {
    if (/^[A-ZÁÉÍÓÚ][\p{L} ]+$/u.test(ls[i]) && !/Tivemos|Ver o que|Pular/.test(ls[i])) {
      // Nome, depois (opcional) "↓ R$ X", depois "R$ Y", depois "%".
      const prox = ls.slice(i + 1, i + 4);
      const valor = prox.find((l) => /^R\$/.test(l));
      if (valor) categorias[ls[i]] = reais(valor) ?? 0;
    }
  }
  return { total, categorias };
}

// ------------------------------------------------------------------ Resumo
export type RetratoDoResumo = {
  caso: string | null;
  heroi: string;
  gastoNoHeroi: number | null;
  categorias: Record<string, { valor: number; texto: string }>;
  sugestao: { tipo: string; texto: string } | null;
  semana: string | null;
  maisNoDecidir: number | null;
};

export async function lerResumo(p: Page, caderno: Caderno, m?: Mes): Promise<RetratoDoResumo> {
  const rota = m ? `/mensal/foco?mes=${m.ano}-${String(m.mes).padStart(2, "0")}` : "/mensal/foco";
  await abrir(p, rota, caderno, m ? `Resumo ${m.mes}/${m.ano}` : "Resumo");
  const caso = await p.locator("[data-resumo-novo], [data-mes-passado]").first().getAttribute("data-resumo-novo").catch(() => null);
  const heroiEl = p.locator("[data-abrir-detalhe], [data-mes-passado]").first();
  const heroi = (await heroiEl.count()) ? (await heroiEl.innerText()).replace(/\n+/g, " ") : "";
  const sug = p.locator("[data-sugestao]");
  const sugestao = (await sug.count()) ? { tipo: (await sug.first().getAttribute("data-sugestao")) ?? "", texto: linhas(await sug.first().innerText())[0] ?? "" } : null;
  const semanaEl = p.locator("[data-linha-semana]");
  const semana = (await semanaEl.count()) ? (await semanaEl.first().innerText()).replace(/\n+/g, " ") : null;
  const categorias: Record<string, { valor: number; texto: string }> = {};
  const bloco = p.locator("[data-bloco-categorias], [data-para-onde-foi]");
  if (await bloco.count()) {
    const ls = linhas(await bloco.first().innerText());
    for (let i = 0; i < ls.length; i++) {
      if (/^[A-ZÁÉÍÓÚ][\p{L} ]+$/u.test(ls[i]) && !/^(Contra|Ver todas|Para onde)/.test(ls[i])) {
        const valor = ls.slice(i + 1, i + 3).find((l) => /^R\$/.test(l));
        if (valor) categorias[ls[i]] = { valor: reais(valor) ?? 0, texto: ls.slice(i, i + 4).join(" | ") };
      }
    }
  }
  // "Mais 2 no Decidir" (com a sugestão) ou "1 decisão no Decidir" / "2 decisões no Decidir" (sem).
  const texto = await textoVisivel(p);
  const mais = texto.match(/Mais (\d+) no Decidir/) ?? texto.match(/(\d+) decis(?:ão|ões) no Decidir/);
  const n = heroi.match(/R\$\s*([\d.]+(?:,\d+)?)/);
  return { caso, heroi, gastoNoHeroi: n ? reais(`R$ ${n[1]}`) : null, categorias, sugestao, semana, maisNoDecidir: mais ? Number(mais[1]) : null };
}

// ------------------------------------------------------------------ Decidir
export type RetratoDoDecidir = {
  cartoes: { id: string; texto: string }[];
  /** Quantos cartões a pilha tem ("1 de 3" conta estes), e quantos "podem esperar". */
  naPilha: number;
  esperam: number;
  /** O que a tela diz quando a pilha está vazia ("Tudo resolvido por hoje", "Nada urgente por hoje"). */
  zero: string | null;
  livres: number | null;
  porDia: number | null;
  acima: string | null;
};

export async function lerDecidir(p: Page, caderno: Caderno): Promise<RetratoDoDecidir> {
  await abrir(p, "/decidir", caderno, "Decidir");
  const cartoes: { id: string; texto: string }[] = [];
  for (const el of await p.locator("[data-cartao]").all()) cartoes.push({ id: (await el.getAttribute("data-cartao")) ?? "", texto: linhas(await el.innerText()).slice(0, 3).join(" | ") });
  const naPilha = Number((await p.locator("[data-na-pilha]").first().getAttribute("data-na-pilha").catch(() => "0")) ?? 0);
  const espera = p.locator("[data-esperam]");
  const esperam = (await espera.count()) ? Number(await espera.first().getAttribute("data-esperam")) : 0;
  const zeroEl = p.locator(".dc-zero b");
  const zero = (await zeroEl.count()) ? (await zeroEl.first().innerText()).trim() : null;
  const pilulas = await p.locator(".ob-c").allInnerTexts();
  // O livre do mês na pílula: "R$ X livres", ou "R$ X acima do plano" (negativo, como no Orçamento).
  const acimaDoPlano = pilulas.find((x) => /acima do plano/.test(x));
  const livresTexto = pilulas.find((x) => /livres/.test(x));
  const livres = livresTexto ? reais(livresTexto) : acimaDoPlano ? -(reais(acimaDoPlano) ?? 0) : null;
  const porDia = pilulas.find((x) => /por dia/.test(x));
  const acima = pilulas.find((x) => /acima/.test(x)) ?? null;
  return { cartoes, naPilha, esperam, zero, livres, porDia: reais(porDia), acima: acima ? acima.replace(/\n+/g, " ") : null };
}

// ------------------------------------------------------------------ Posso comprar
export async function lerPossoComprar(p: Page, caderno: Caderno): Promise<{ livreDoMes: number | null; frase: string }> {
  await abrir(p, "/decidir/comprar", caderno, "Posso comprar");
  await p.getByRole("button", { name: "Eletrônico" }).click();
  await p.getByLabel("Quanto custa").fill("300");
  await p.getByRole("button", { name: "Continuar", exact: true }).click();
  await p.getByRole("button", { name: /^Continuar/ }).first().click();
  await p.getByRole("button", { name: /Quero muito/ }).click();
  await p.getByRole("button", { name: "Continuar", exact: true }).click();
  // "Seu livre de outubro é R$ X", ou "Seu plano de outubro já passou R$ X" (negativo).
  const h = p.getByRole("heading", { name: /Seu livre de|Seu plano de .* já passou/ });
  await h.waitFor();
  const frase = (await h.innerText()).replace(/\s+/g, " ");
  await conferirTextoELayout(p, caderno, "Posso comprar (passo 5)");
  const n = reais(frase);
  return { livreDoMes: n === null ? null : /já passou/.test(frase) ? -n : n, frase };
}

// ------------------------------------------------------------------ Recorrentes
export async function lerRecorrentes(p: Page, caderno: Caderno) {
  await abrir(p, "/orcamento/contas", caderno, "Recorrentes");
  const ls = linhas(await textoVisivel(p));
  const depois = (rotulo: string) => {
    const i = ls.findIndex((l) => l === rotulo);
    return i >= 0 ? reais(ls[i + 1]) : null;
  };
  const faltam = ls.find((l) => /^Faltam/.test(l)) ?? null;
  const acima = depois("Acima do plano");
  return { contas: depois("Contas"), parcelas: depois("Parcelas"), assinaturas: depois("Assinaturas"), livre: depois("Livre") ?? (acima === null ? null : -acima), faltam, texto: ls.join(" | ") };
}

// ------------------------------------------------------------------ Metas
export async function lerMetas(p: Page, caderno: Caderno) {
  await abrir(p, "/planejamento/metas", caderno, "Metas");
  const ls = linhas(await textoVisivel(p));
  const iG = ls.findIndex((l) => l === "Guardado nas metas");
  const total = iG >= 0 ? reais(ls.slice(iG + 1, iG + 3).join(" ")) : null;
  const metas: Record<string, number> = {};
  // Cada cartão: (selos) · nome · "N%" · "R$ valor" · "de R$ alvo". A fileira de fotos de cima
  // também tem nome e "N%", mas sem valor logo depois.
  for (let i = iG + 1; i < ls.length - 2; i++) {
    if (!/^\d+%$/.test(ls[i + 1])) continue;
    const depois = ls.slice(i + 2, i + 5).join(" ");
    const v = depois.match(/^R\$\s*([\d.]+(?:,\d+)?)/);
    if (v) metas[ls[i]] = reais(`R$ ${v[1]}`) ?? 0;
  }
  return { total, metas };
}

// ------------------------------------------------------------------ Widget
// Uma chave por navegador (cada um é uma pessoa logada).
const chaves = new WeakMap<object, string>();
export async function lerWidget(p: Page, base: string, request?: APIRequestContext) {
  const ctx = request ?? p.request;
  let chaveDoWidget = chaves.get(p.context()) ?? null;
  if (!chaveDoWidget) {
    const r = await p.evaluate(async () => {
      const x = await fetch("/api/widget/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aparelho: "jornada-teste-aparelho-0001" }) });
      return { status: x.status, corpo: await x.json().catch(() => null) };
    });
    chaveDoWidget = r.corpo?.chave ?? null;
    if (!chaveDoWidget) return { erro: `sem chave (${r.status})` } as const;
    chaves.set(p.context(), chaveDoWidget);
  }
  const r = await ctx.get(`${base}/api/widget`, { headers: { authorization: `Bearer ${chaveDoWidget}` } });
  if (!r.ok()) return { erro: `HTTP ${r.status()}` } as const;
  return (await r.json()) as {
    livre: { valor: number | null; rotulo: string; porDia: number | null };
    /** O livre do mês (a fonte única): valor sempre positivo, o rótulo diz "livres no mês" ou "acima do plano". */
    mes?: { valor: number | null; rotulo: string };
    fimDoMes: { valor: number | null; palavra: string | null; rotulo: string };
    metas: { nome: string; atual: number; alvo: number }[];
  };
}
export function esquecerWidget(p: Page) {
  chaves.delete(p.context());
}

// ------------------------------------------------------------------ Assinaturas (regra única)
// A mesma assinatura em três telas (lib/assinaturas, 15/10/2026): a última resposta vale em todas.
const exato = (nome: string) => new RegExp(`^\\s*${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);

/** Raio-X do Decidir: "aberto", "Mantido", "Vou cancelar", "Cancelada", ou "fora" (não aparece). */
export async function lerAssinaturaNoRaioX(p: Page, caderno: Caderno, nome: string): Promise<string> {
  await abrir(p, "/decidir/raio-x", caderno, "Raio-X");
  const item = p.locator('[data-guia="raiox-item"]').filter({ has: p.locator("p", { hasText: exato(nome) }) }).first();
  if (!(await item.count())) return "fora";
  const t = (await item.textContent()) ?? "";
  return /Cancelada/.test(t) ? "Cancelada" : /Vou cancelar/.test(t) ? "Vou cancelar" : /Mantido/.test(t) ? "Mantido" : "aberto";
}

/** Recorrentes › Assinaturas: "na lista", "para cancelar", ou "fora". */
export async function lerAssinaturaEmRecorrentes(p: Page, caderno: Caderno, nome: string): Promise<string> {
  await abrir(p, "/orcamento/contas", caderno, "Recorrentes");
  const li = p.locator("[data-assinaturas] li").filter({ hasText: nome }).first();
  if (!(await li.count())) return "fora";
  return /para cancelar/.test((await li.textContent()) ?? "") ? "para cancelar" : "na lista";
}

/** Dinheiro perdido › Ver tudo › Assinatura: "Para conferir", "Não uso", "Uso", ou "fora". */
export async function lerAssinaturaNoDinheiroPerdido(p: Page, caderno: Caderno, nome: string): Promise<string> {
  await abrir(p, "/orcamento/contas/perdido", caderno, "Dinheiro perdido");
  const ver = p.getByRole("button", { name: "Ver tudo" });
  if (!(await ver.count())) return "fora";
  await ver.click();
  const li = p.locator("li").filter({ has: p.locator("span", { hasText: exato(nome) }) }).first();
  if (!(await li.count())) return "fora";
  const t = (await li.textContent()) ?? "";
  return /Não uso/.test(t) ? "Não uso" : /Uso/.test(t) ? "Uso" : /Para conferir/.test(t) ? "Para conferir" : t.trim().slice(0, 40);
}

// ------------------------------------------------------------------ Matriz dos números (numeros.jornada.ts)
/** Os totais do mês somando a lista de Transações, do jeito que ela leria: entrou, saiu, guardou. */
export function somarTransacoes(t: RetratoDasTransacoes) {
  let entrou = 0;
  let gastou = 0;
  let guardou = 0;
  for (const l of t.linhas) {
    if (/^Entrada/.test(l.categoria)) entrou += l.valor;
    else if (/^Guardado/.test(l.categoria)) guardou += Math.abs(l.valor);
    else if (/^Resgatei/.test(l.categoria)) guardou -= Math.abs(l.valor);
    else if (l.valor < 0) gastou -= l.valor;
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { entrou: r2(entrou), gastou: r2(gastou), guardou: r2(guardou) };
}

/** O Resumo do mês atual: o "Ficou com você em <mês>", o "Guardado em <ano>" e os Próximos meses. */
export async function lerResumoDosNumeros(p: Page, caderno: Caderno) {
  const r = await lerResumo(p, caderno);
  const ls = linhas(await textoVisivel(p));
  const depois = (re: RegExp) => {
    const i = ls.findIndex((l) => re.test(l));
    return i >= 0 ? reais(ls.slice(i, i + 3).join(" ")) : null;
  };
  const proximos: Record<string, number> = {};
  const iP = ls.findIndex((l) => l === "Próximos meses");
  // Cada mês: "Nov", às vezes "+R$ 210" (a parcela que acabou) e o total "R$ 1.820".
  if (iP >= 0) {
    for (let i = iP + 1; i < ls.length; i++) {
      if (!/^[A-Z][a-z]{2}$/.test(ls[i])) {
        if (/^\+?R\$/.test(ls[i])) continue;
        break;
      }
      const total = ls.slice(i + 1, i + 3).find((x) => /^R\$/.test(x));
      if (total) proximos[ls[i]] = reais(total) ?? 0;
    }
  }
  const ano = r.heroi.match(/Guardado em (\d{4})\s*R\$\s*([\d.]+)/);
  return {
    ...r,
    ficouPassado: depois(/^Ficou com você em /),
    guardadoNoAno: ano ? { ano: Number(ano[1]), valor: Number(ano[2].replace(/\./g, "")) } : null,
    proximos,
  };
}

/** O Resumo de um mês que passou: "Em setembro, ficou com você R$ X" e "N% do que entrou". */
export async function lerMesPassadoDosNumeros(p: Page, caderno: Caderno, m: Mes) {
  await lerResumo(p, caderno, m);
  const t = (await textoVisivel(p)).replace(/\n+/g, " ");
  const ficou = t.match(/ficou com você\s*(-?R\$\s*[\d.,]+|R\$\s*-?\s*[\d.,]+)/);
  const pct = t.match(/(-?\d+)% do que entrou/);
  return { ficou: ficou ? reais(ficou[1]) : null, pct: pct ? Number(pct[1]) : null, texto: t };
}

/** Recorrentes › Parcelas: o total do topo ("Parcelas R$ X") e cada parcela da lista. */
export async function lerParcelas(p: Page, caderno: Caderno) {
  const r = await lerRecorrentes(p, caderno);
  const ls = linhas(await textoVisivel(p));
  const itens: { nome: string; atual: number; total: number; faltam: number; valor: number }[] = [];
  const i0 = ls.findIndex((l) => /^Parcelas R\$/.test(l));
  if (i0 >= 0) {
    for (let i = i0 + 1; i < ls.length - 2; i++) {
      if (/^(Assinaturas|Dívidas por mês|Contas do ano)/.test(ls[i])) break;
      const m = ls[i + 1].match(/^(\d+) de (\d+)(?: · faltam (\d+))?/);
      if (!m) continue;
      const valor = reais(ls.slice(i + 2, i + 4).find((x) => /R\$/.test(x)));
      itens.push({ nome: ls[i], atual: Number(m[1]), total: Number(m[2]), faltam: Number(m[3] ?? Number(m[2]) - Number(m[1]) + 1), valor: valor ?? 0 });
    }
  }
  return { topo: r.parcelas, contas: r.contas, assinaturas: r.assinaturas, doTitulo: i0 >= 0 ? reais(ls[i0]) : null, itens, texto: r.texto };
}

/** Gastos do ano: o total "Gastou" da vista Ano. */
export async function lerGastosDoAno(p: Page, caderno: Caderno, ano: number) {
  await abrir(p, `/mensal/gastos?view=ano&year=${ano}`, caderno, `Gastos ${ano}`);
  const ls = linhas(await textoVisivel(p));
  const iG = ls.findIndex((l) => l === "Gastou");
  return iG >= 0 ? reais(ls.slice(iG, iG + 4).find((l) => /R\$/.test(l))) : null;
}

/** Carteira: o total do topo e a soma do "Por tipo". */
export async function lerCarteira(p: Page, caderno: Caderno) {
  await abrir(p, "/carteira", caderno, "Carteira");
  const ls = linhas(await textoVisivel(p));
  const iT = ls.findIndex((l) => l === "Sua carteira");
  // "R$" · "6.451" · ",15": o total vem quebrado em três linhas.
  const bloco = ls.slice(iT + 1, iT + 6).join(" ").replace(/\s+,/, ",").replace(/R\$\s+/, "R$ ");
  const total = reais(bloco);
  const porTipo: number[] = [];
  const iP = ls.findIndex((l) => l === "Por tipo");
  if (iP >= 0) for (let i = iP + 1; i < ls.length; i++) if (/^\d+ ativos?$/.test(ls[i]) && /R\$/.test(ls[i + 1] ?? "")) porTipo.push(reais(ls[i + 1]) ?? 0);
  return { total, porTipo };
}

/** Metas: o "precisa R$ X por mês" e o mês em que chega, como a tela de Metas e o Decidir dizem. */
export async function lerDecidirDaMeta(p: Page, caderno: Caderno) {
  await abrir(p, "/decidir", caderno, "Decidir");
  const t = (await textoVisivel(p)).replace(/\n+/g, " ");
  const quando = t.match(/([a-z]{3}\/\d{4})\s*Quando chego na minha meta/);
  const falta = t.match(/Falta guardar\s*R\$\s*([\d.,]+)\s*faltam dos (R\$\s*[\d.,]+) que o plano guarda/);
  return { quando: quando?.[1] ?? null, faltaGuardar: falta ? { falta: reais(`R$ ${falta[1]}`), plano: reais(falta[2]) } : null };
}

/** Raio-X: o lembrete de cancelar no item ("lembrete dia 1", "pede o dia", ou "sem lembrete"). */
export async function lerLembreteNoRaioX(p: Page, caderno: Caderno, nome: string): Promise<string> {
  await abrir(p, "/decidir/raio-x", caderno, "Raio-X");
  const item = p.locator('[data-guia="raiox-item"]').filter({ has: p.locator("p", { hasText: exato(nome) }) }).first();
  if (!(await item.count())) return "fora";
  const selo = item.locator("[data-lembrete]");
  if (await selo.count()) return ((await selo.textContent()) ?? "").replace(/\s+/g, " ").trim();
  if (await item.getByText("Que dia ela cobra?").count()) return "pede o dia";
  return "sem lembrete";
}

/**
 * Carteira › um ativo (15/10/2026): abre o grupo do Por tipo em que ele está, toca nele e lê o
 * valor com centavos do detalhe e a linha "Estimado pelo CDI de dd/mm, antes do IR".
 */
export async function lerAtivoDaCarteira(p: Page, caderno: Caderno, nomeNaLista: string) {
  await abrir(p, "/carteira", caderno, "Carteira");
  const secao = p.locator('section[aria-label="Por tipo"]');
  const item = secao.locator("li li button").filter({ hasText: nomeNaLista }).first();
  const grupos = secao.locator(":scope > ul > li > button");
  const n = await grupos.count();
  for (let i = 0; i < n && !(await item.isVisible()); i++) {
    if ((await grupos.nth(i).getAttribute("aria-expanded")) === "false") await grupos.nth(i).click();
  }
  await item.click();
  const valor = p.locator("[data-valor-do-ativo]");
  await valor.waitFor();
  const v = reais(((await valor.locator("span").first().textContent()) ?? "").replace(/R\$\s*/, "R$ "));
  const texto = await conferirTextoELayout(p, caderno, `Carteira › ${nomeNaLista}`);
  const linha = texto.match(/Estimado [^\n]*antes do IR/)?.[0] ?? null;
  await p.keyboard.press("Escape");
  return { valor: v, linha };
}
