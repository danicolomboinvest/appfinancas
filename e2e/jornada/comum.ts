import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { Caderno, PASTA_DE_SAIDA, lerAchados, resumoDosAchados, type Achado, type TipoDeAchado } from "./achados";
import { irPara, relogioNaPagina } from "./relogio";
import { aba, peloMenu } from "./acoes";
import { textoVisivel } from "./texto";
import { conferirTextoELayout } from "./telas";

/**
 * O que toda jornada usa: o passo (ação + conferências), a checagem de "tela velha" (o app mostra
 * a cópia guardada da tela em vez da nova depois de uma ação) e o fechamento por tipo de achado.
 */

export async function novaPagina(p: Page) {
  await relogioNaPagina(p);
}

export async function dia(c: Caderno, diaHora: string, paginas: Page[]) {
  c.dia = diaHora;
  await irPara(diaHora, paginas);
}

/** Um passo da jornada: o nome da ação vai para o caderno e para o relatório do Playwright. */
export async function passo(c: Caderno, nome: string, corpo: () => Promise<void>) {
  c.acao = nome;
  await test.step(`${c.dia} · ${nome}`, corpo);
}

/** Linhas que mudam sozinhas entre duas leituras (relógio, pílulas, carregando). */
const VOLATIL = /^(Desfazer|Fechar|Carregando|Salvo|Apagado|Pronto|Foi pontual|.* coberta|Teto de .*|Meta apagada|Tivemos uma mudança|O SPI ficou mais simples.*|Ver o que mudou|Pular|Ver depois em Ajuda)$/;

function linhasEstaveis(t: string) {
  return t
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !VOLATIL.test(l));
}

type Destino = { nome: string; ir: (p: Page) => Promise<void>; caminho: RegExp };
export const DESTINOS: Record<string, Destino> = {
  Resumo: { nome: "Resumo", ir: (p) => aba(p, "Resumo"), caminho: /\/mensal\/foco/ },
  Orçamento: { nome: "Orçamento", ir: (p) => aba(p, "Orçamento"), caminho: /\/orcamento/ },
  Transações: { nome: "Transações", ir: (p) => aba(p, "Transações"), caminho: /\/mensal\/\d{4}\/\d+/ },
  Recorrentes: { nome: "Recorrentes", ir: (p) => aba(p, "Recorrentes"), caminho: /\/orcamento\/contas/ },
  Decidir: { nome: "Decidir", ir: (p) => peloMenu(p, "Decidir"), caminho: /\/decidir$/ },
  Metas: { nome: "Metas", ir: (p) => peloMenu(p, "Metas"), caminho: /\/planejamento\/metas$/ },
};

/**
 * Antes da ação: passa pelas telas pelo próprio app (como ela faz), para o app guardar a cópia.
 * Depois da ação (em menos de 30 s): volta nelas pelo app e compara com a tela recarregada.
 * Diferença = ela veria a tela velha. Anota como achado "numero" (tela que não atualizou).
 */
export async function visitarPeloApp(p: Page, telas: string[]) {
  if (!(await p.locator('nav[aria-label="Abas da Visão geral"]').count())) await p.goto("/mensal/foco");
  for (const t of telas) {
    await DESTINOS[t].ir(p);
    await p.waitForURL(DESTINOS[t].caminho, { timeout: 30_000 }).catch(() => undefined);
  }
}

export async function conferirTelaVelha(p: Page, c: Caderno, telas: string[]) {
  for (const t of telas) {
    if (!(await p.locator('nav[aria-label="Abas da Visão geral"]').count()) && !["Decidir", "Metas"].includes(t)) await p.goto("/mensal/foco");
    await DESTINOS[t].ir(p);
    await p.waitForURL(DESTINOS[t].caminho, { timeout: 30_000 }).catch(() => undefined);
    await p.waitForLoadState("networkidle").catch(() => undefined);
    await p.waitForTimeout(600);
    const viaApp = linhasEstaveis(await textoVisivel(p));
    await conferirTextoELayout(p, c, t);
    await p.reload();
    await p.waitForLoadState("networkidle").catch(() => undefined);
    const recarregada = linhasEstaveis(await textoVisivel(p));
    const so1 = viaApp.filter((l) => !recarregada.includes(l));
    const so2 = recarregada.filter((l) => !viaApp.includes(l));
    if (so1.length || so2.length) {
      fs.appendFileSync(path.join(PASTA_DE_SAIDA, `tela-velha-${c.perfil}.txt`), `\n### ${c.acao} · ${t}\n--- pelo app:\n${viaApp.join("\n")}\n--- recarregada:\n${recarregada.join("\n")}\n`);
      await c.anotar(p, {
        tipo: "numero",
        telaDeOrigem: c.acao,
        telaErrada: `${t} (aberta pelo app, sem recarregar)`,
        esperado: `o mesmo que a tela recarregada: ${so2.slice(0, 4).join(" / ") || "(nada a mais)"}`,
        visto: `tela velha: ${so1.slice(0, 4).join(" / ") || "(faltando linhas)"}`,
        chave: `${c.perfil}|tela-velha|${t}|${c.acao}`,
      });
    }
  }
}

/**
 * O fim de cada jornada: falha com os achados que não são de aviso (números, textos, telas).
 * Os de aviso ficam para o teste próprio, marcado como esperado-falhar.
 */
export function exigirSemAchados(perfil: string, tipos: TipoDeAchado[]) {
  const lista: Achado[] = lerAchados(perfil).filter((a) => tipos.includes(a.tipo));
  expect(lista, `Achados de ${perfil}:\n${resumoDosAchados(lista)}`).toEqual([]);
}

export { Caderno };
