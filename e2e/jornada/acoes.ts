import { expect, type Page } from "@playwright/test";
import { SENHA } from "./config";

/**
 * O que a cliente faz, tocando nos botões como ela toca. Nada aqui chama ação de servidor direto.
 */

export async function entrar(p: Page, email: string) {
  await p.goto("/login");
  const ja = p.getByRole("button", { name: "Já tenho conta" });
  if (await ja.count()) await ja.click();
  await p.locator("#email").fill(email);
  await p.locator("#password").fill(SENHA);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 60_000 });
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

/**
 * Chamado depois de preencher um campo (o teste liga em conferirTextoELayout): pega campo coberto
 * e tela cortada no meio da ação, que é quando ela vê.
 */
let aoPreencher: (p: Page, tela: string) => Promise<void> = async () => undefined;
export function quandoPreencher(f: (p: Page, tela: string) => Promise<void>) {
  aoPreencher = f;
}

/** Os campos de dinheiro leem dígitos como centavos: "4000,00" vira R$ 4.000. */
export const digitado = (v: number) => v.toFixed(2).replace(".", ",");

export async function sair(p: Page) {
  await p.context().clearCookies();
}

/** Espera a pílula (toast) com o texto e devolve o locator dela. */
export function pilula(p: Page, texto: string | RegExp) {
  return p.locator("[role=status], [data-toast], [aria-live]").filter({ hasText: texto }).first();
}

/** Abas da Visão geral (navegação do próprio app, sem recarregar). */
export async function aba(p: Page, nome: "Resumo" | "Orçamento" | "Transações" | "Recorrentes") {
  await p.locator('nav[aria-label="Abas da Visão geral"]').getByRole("tab", { name: nome }).click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

/** Pelo menu (☰), como ela vai para Metas e Decidir. */
export async function peloMenu(p: Page, nome: string) {
  await p.getByRole("button", { name: "Abrir menu" }).click();
  await p.getByRole("link", { name: nome, exact: true }).first().click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

async function abrirRegistrar(p: Page) {
  if (!(await p.getByRole("button", { name: "Registrar" }).count())) await p.goto("/mensal/foco");
  await p.getByRole("button", { name: "Registrar" }).first().click();
}

async function teclar(p: Page, valor: number) {
  const centavos = String(Math.round(valor * 100));
  const d = p.getByRole("dialog");
  for (const ch of centavos) await d.getByRole("button", { name: ch, exact: true }).click();
}

export type Lancamento = { valor: number; categoria: string; descricao?: string; entrada?: boolean; ontem?: boolean };

/** "+" → Digitar → valor no teclado → categoria → (descrição) → Salvar. */
export async function lancarAMao(p: Page, l: Lancamento) {
  await abrirRegistrar(p);
  await p.getByRole("dialog").getByText("Digitar", { exact: true }).click();
  const d = p.getByRole("dialog");
  if (l.entrada) await d.getByRole("button", { name: "Entrada", exact: true }).click();
  await teclar(p, l.valor);
  await d.getByRole("button", { name: l.categoria, exact: true }).click();
  if (l.ontem) await d.getByRole("button", { name: "Ontem", exact: true }).click();
  if (l.descricao) {
    await d.getByText("Mais opções", { exact: true }).click();
    await d.locator("#digitar-mais input").first().fill(l.descricao);
  }
  await d.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(d).toBeHidden({ timeout: 20_000 });
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

/**
 * Por voz: o navegador de teste não tem microfone, então trocamos o reconhecimento de fala por um
 * que "ouve" a frase dada (o resto do caminho é o de verdade: entenderFalaAction e o Digitar).
 */
export async function prepararVoz(p: Page) {
  await p.addInitScript(() => {
    class FalaFalsa {
      lang = "pt-BR";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onstart: (() => void) | null = null;
      start() {
        this.onstart?.();
      }
      stop() {
        const frase = (window as unknown as { __fraseDaJornada?: string }).__fraseDaJornada ?? "";
        const r = [Object.assign([{ transcript: frase, confidence: 0.95 }], { isFinal: true })];
        this.onresult?.({ resultIndex: 0, results: r });
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
      addEventListener(tipo: string, f: (e: unknown) => void) {
        (this as unknown as Record<string, unknown>)[`on${tipo}`] = f;
      }
      removeEventListener() {}
    }
    (window as unknown as Record<string, unknown>).SpeechRecognition = FalaFalsa;
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FalaFalsa;
  });
}

export async function lancarPorVoz(p: Page, frase: string) {
  await abrirRegistrar(p);
  await p.getByRole("dialog").getByText("Gravar áudio", { exact: true }).click();
  await p.evaluate((f) => ((window as unknown as { __fraseDaJornada?: string }).__fraseDaJornada = f), frase);
  const botao = p.getByRole("button", { name: "Segure para falar o lançamento" });
  const caixa = await botao.boundingBox();
  if (!caixa) throw new Error("botão de falar sem caixa");
  await p.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(1200);
  await p.mouse.up();
  const d = p.getByRole("dialog");
  await d.getByRole("button", { name: "Salvar", exact: true }).waitFor({ timeout: 20_000 });
  await d.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(d).toBeHidden({ timeout: 20_000 });
}

/** O "+" → "Extrato ou fatura" → arquivo → anotar. */
export async function importarArquivo(p: Page, caminho: string | string[]) {
  await abrirRegistrar(p);
  await p.getByRole("dialog").getByText("Extrato ou fatura", { exact: true }).click();
  await p.locator('input[type=file]').first().setInputFiles(caminho);
  const confirmar = p.locator("[data-confirmacao-do-arquivo]");
  await confirmar.waitFor({ timeout: 90_000 });
  const pular = p.getByRole("button", { name: /Pular e anotar/ });
  const pronto = p.getByRole("button", { name: /^Pronto, anotar/ });
  if (await pronto.count()) await pronto.click();
  else await pular.click();
  // Depois de anotar: a oferta de avisos ("Agora não") às vezes aparece.
  await p.waitForTimeout(1500);
  const agoraNao = p.getByRole("button", { name: "Agora não" });
  if (await agoraNao.count()) await agoraNao.first().click().catch(() => undefined);
  await p.keyboard.press("Escape").catch(() => undefined);
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

/** Orçamento: abre a folha "O que fazer?" da categoria. */
export async function abrirOQueFazer(p: Page, ano: number, chave: string) {
  await p.goto(`/orcamento/${ano}?resolver=${chave}`);
  await p.locator("[data-o-que-fazer]").waitFor();
}

export async function foiPontual(p: Page, ano: number, chave: string) {
  await abrirOQueFazer(p, ano, chave);
  await p.locator("[data-o-que-fazer]").getByRole("button", { name: /Foi pontual/ }).click();
  await pilula(p, "Foi pontual").waitFor({ timeout: 15_000 }).catch(() => undefined);
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

export async function cobrirCom(p: Page, ano: number, chave: string, de?: string) {
  await abrirOQueFazer(p, ano, chave);
  const f = p.locator("[data-o-que-fazer]");
  await f.getByRole("button", { name: /Cobrir com outra categoria/ }).click();
  const c = p.locator("[data-cobrir]");
  if (de) await c.getByRole("button", { name: new RegExp(`^${de} ·`) }).click();
  await c.getByRole("button", { name: /^Cobrir R\$|R\$ .* de / }).last().click();
  await pilula(p, /coberta/).waitFor({ timeout: 15_000 }).catch(() => undefined);
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

/** O lápis: "Plano de R$ N por mês" no painel da categoria → valor → Salvar. */
export async function lapis(p: Page, ano: number, nomeDaCategoria: string, valor: number) {
  await p.goto(`/orcamento/${ano}`);
  await p.locator('[data-brilho^="cat-"]').filter({ hasText: nomeDaCategoria }).first().click();
  const painel = p.locator("[data-painel-categoria]");
  await painel.getByRole("button", { name: /Plano de R\$|Definir um plano/ }).click();
  const campo = p.getByLabel(/Planejado por mês/);
  await campo.fill(digitado(valor));
  await aoPreencher(p, "Orçamento (lápis)");
  await p.getByRole("button", { name: "Salvar", exact: true }).click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await p.waitForTimeout(500);
}

/** Resumo: "Agora não" na sugestão que estiver aparecendo. Devolve o texto dela. */
export async function agoraNaoNoResumo(p: Page) {
  await p.goto("/mensal/foco");
  const s = p.locator("[data-sugestao]").first();
  await s.waitFor();
  const texto = (await s.innerText()).split("\n")[0];
  await s.getByRole("button", { name: "Agora não" }).click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await p.waitForTimeout(500);
  return texto;
}

/** Resumo: toca no botão da sugestão (ex.: "Ver limite"). Devolve o texto e o botão. */
export async function tocarNaSugestao(p: Page) {
  await p.goto("/mensal/foco");
  const s = p.locator("[data-sugestao]").first();
  await s.waitFor();
  const texto = (await s.innerText()).split("\n")[0];
  const botao = s.getByRole("link").first();
  const rotulo = (await botao.innerText()).trim();
  await botao.click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
  return { texto, rotulo };
}

/** Decidir: responde o cartão do topo com o botão dado. */
export async function responderNoDecidir(p: Page, idDoCartao: string, botao: string | RegExp) {
  await p.goto("/decidir");
  const c = p.locator(`[data-cartao="${idDoCartao}"]`);
  await c.waitFor();
  await c.getByRole("button", { name: botao }).first().click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await p.waitForTimeout(700);
}

/** Transações: abre o lançamento pela descrição. */
export async function abrirLancamento(p: Page, ano: number, mes: number, descricao: string) {
  await p.goto(`/mensal/${ano}/${mes}`);
  await p.locator("[data-linha-transacao]").filter({ hasText: descricao }).first().click();
  await p.getByRole("dialog").waitFor();
}

export async function apagarLancamento(p: Page, ano: number, mes: number, descricao: string, desfazer = false) {
  await abrirLancamento(p, ano, mes, descricao);
  await p.getByRole("dialog").getByRole("button", { name: "Remover", exact: true }).click();
  // Confirmação, se houver.
  const conf = p.getByRole("button", { name: /^(Remover|Apagar)( este)?$/ });
  if (await conf.count().catch(() => 0)) await conf.last().click().catch(() => undefined);
  const t = pilula(p, /Apagado|Removido/);
  await t.waitFor({ timeout: 15_000 });
  if (desfazer) {
    await t.getByRole("button", { name: "Desfazer" }).click();
    await p.waitForTimeout(1200);
  }
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

export async function moverParaPerfil(p: Page, ano: number, mes: number, descricao: string, perfil: string) {
  await abrirLancamento(p, ano, mes, descricao);
  await p.locator("[data-enviar-um]").click();
  await p.locator("[data-enviar-passo=perfil]").getByRole("button", { name: new RegExp(perfil) }).first().click();
  const so = p.getByRole("button", { name: "Só esta" });
  if (await so.count()) await so.click();
  await p.getByRole("button", { name: "Enviar", exact: true }).click();
  await pilula(p, /Envi|Mov/).waitFor({ timeout: 15_000 }).catch(() => undefined);
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

export async function naoEParcela(p: Page, nome: string) {
  await p.goto("/orcamento/contas");
  await p.getByRole("button", { name: `Mais opções de ${nome}` }).first().click();
  await p.getByRole("menuitem", { name: "Não é parcela" }).or(p.getByRole("button", { name: "Não é parcela" })).first().click();
  const confirma = p.getByRole("alertdialog").getByRole("button", { name: "Não é parcela", exact: true });
  if (await confirma.count()) await confirma.click();
  await pilula(p, /não é parcela/i).waitFor({ timeout: 15_000 }).catch(() => undefined);
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

/** Nova meta pelo caminho de 5 passos. */
export async function criarMeta(p: Page, nome: string, valor: number) {
  await p.goto("/planejamento/metas");
  await p.locator('[data-guia="nova-meta"]').first().click();
  const d = p.getByRole("dialog", { name: "Nova meta" });
  await d.getByLabel("Nome da meta").fill(nome);
  await d.getByRole("button", { name: "Continuar", exact: true }).click();
  await d.getByLabel("Quanto você precisa").fill(digitado(valor));
  await aoPreencher(p, "Nova meta (Quanto você precisa?)");
  for (let i = 0; i < 4; i++) {
    const criar = d.getByRole("button", { name: "Criar meta", exact: true });
    if (await criar.count()) break;
    await d.getByRole("button", { name: "Continuar", exact: true }).click();
  }
  await d.getByRole("button", { name: "Criar meta", exact: true }).click();
  await expect(d).toBeHidden({ timeout: 20_000 });
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

export async function apagarMeta(p: Page, nome: string, desfazer = false) {
  await p.goto("/planejamento/metas");
  await p.getByRole("button", { name: `Mais opções de ${nome}` }).first().click();
  await p.getByRole("menuitem", { name: "Apagar" }).click();
  await p.getByRole("alertdialog").getByRole("button", { name: "Apagar", exact: true }).click();
  const t = pilula(p, "Meta apagada");
  await t.waitFor({ timeout: 15_000 });
  if (desfazer) await t.getByRole("button", { name: "Desfazer" }).click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
}

export async function aporteNaMeta(p: Page, nome: string, valor: number) {
  await p.goto("/planejamento/metas");
  await p.locator('a[href^="/planejamento/metas/"]').filter({ hasText: nome }).first().click();
  await p.waitForURL(/\/planejamento\/metas\/.+/);
  await p.getByRole("button", { name: "Adicionar", exact: true }).first().click();
  await p.getByLabel("Valor").fill(digitado(valor));
  await aoPreencher(p, "Meta (Quanto você vai adicionar?)");
  await p.locator("section").filter({ hasText: "Quanto você vai adicionar?" }).getByRole("button", { name: "Adicionar", exact: true }).click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await p.waitForTimeout(800);
}

/** Fechamento do mês passado: Está certo → Continuar → Fechar {mês}. */
export async function fecharMes(p: Page, nomeDoMes: string) {
  await p.goto("/mensal/foco/fechamento");
  await p.getByRole("button", { name: "Está certo" }).click();
  await p.getByRole("button", { name: "Continuar", exact: true }).click();
  const deixar = p.getByRole("button", { name: "Deixar como está" });
  if (await deixar.count()) await deixar.first().click();
  await p.getByRole("button", { name: new RegExp(`^Fechar ${nomeDoMes}`, "i") }).click();
  await p.getByRole("button", { name: /Voltar ao Resumo/ }).or(p.getByRole("link", { name: /Voltar ao Resumo/ })).first().waitFor({ timeout: 20_000 });
}

/** Foto do topo → "Perfil" → toca no perfil. */
export async function trocarPerfil(p: Page, nome: string) {
  await p.goto("/mensal/foco");
  await p.getByRole("button", { name: "Abrir perfil e conta" }).click();
  const d = p.getByRole("dialog", { name: "Perfil" });
  await d.getByRole("button", { name: new RegExp(nome) }).first().click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await p.waitForTimeout(800);
}

/** Empresa: "+" → Vendi → valor → Registrar venda. */
export async function vendiNaEmpresa(p: Page, valor: number) {
  await p.goto("/empresa");
  await p.getByRole("button", { name: "Registrar" }).first().click();
  await p.getByRole("button", { name: /^Vendi/ }).first().click();
  const campo = p.getByRole("dialog").locator("input").first();
  await campo.fill(digitado(valor));
  await p.getByRole("button", { name: "Registrar venda" }).click();
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await p.waitForTimeout(800);
}
