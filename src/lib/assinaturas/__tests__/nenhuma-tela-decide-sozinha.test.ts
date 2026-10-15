import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * "Nenhuma tela decide sozinha" para as assinaturas (15/10/2026), como em lib/avisos: quem LÊ o
 * registro único é só lib/assinaturas, e as três telas montam a lista e gravam a resposta pelo
 * módulo. Uma tela nova que mostre assinatura entra aqui, de propósito.
 */

function arquivos(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === "__tests__" || nome === "node_modules") continue;
      arquivos(caminho, achados);
    } else if (/\.(ts|tsx)$/.test(nome)) achados.push(caminho);
  }
  return achados;
}
const ler = (c: string) => readFileSync(c, "utf-8");

describe("só o módulo de assinaturas decide o estado de uma assinatura", () => {
  it("ninguém fora de lib/assinaturas lê ou grava o registro único", () => {
    const fora = arquivos("src").filter((c) => !c.startsWith("src/lib/assinaturas/"));
    expect(fora.filter((c) => /assinatura_resposta|TIPO_DO_REGISTRO/.test(ler(c)))).toEqual([]);
  });

  it("as três telas montam o que mostram pela regra única", () => {
    expect(ler("src/app/(app)/mensal/foco/dados.ts")).toMatch(/raioXComARegraUnica\(/);
    expect(ler("src/app/(app)/orcamento/contas/perdido/dados.ts")).toMatch(/cartaComARegraUnica\(/);
    // Recorrentes e o cartão do Resumo montam a lista pelo mesmo módulo, que aplica a regra única.
    expect(ler("src/lib/assinaturas/montar.ts")).toMatch(/assinaturasComARegraUnica</);
    expect(ler("src/app/(app)/orcamento/contas/page.tsx")).toMatch(/montarAssinaturas\(/);
    expect(ler("src/app/(app)/mensal/foco/novo/cartoes-novos.tsx")).toMatch(/montarAssinaturas\(/);
    // E Recorrentes não filtra mais pela recusa por conta própria.
    expect(ler("src/app/(app)/orcamento/contas/page.tsx")).not.toMatch(/listarRecusasDeAssinatura/);
  });

  it("os botões das três telas gravam pela regra única", () => {
    expect(ler("src/app/(app)/mensal/foco/actions.ts")).toMatch(/responderAssinatura\(/);
    expect(ler("src/app/(app)/decidir/actions.ts")).toMatch(/desfazerAssinatura\(/);
    const perdido = ler("src/app/(app)/orcamento/contas/perdido/actions.ts");
    expect(perdido).toMatch(/responderAssinatura\(/);
    expect(perdido).toMatch(/desfazerAssinatura\(/);
    const recorrentes = ler("src/app/(app)/orcamento/contas/assinaturas-actions.ts");
    expect(recorrentes).toMatch(/responderAssinatura\(/);
    expect(recorrentes).toMatch(/desfazerAssinatura\(/);
    expect(recorrentes).not.toMatch(/recusarAssinatura\(|desfazerRecusaDeAssinatura\(/);
  });
});
