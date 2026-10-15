import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * "Nenhuma tela mantém regra própria de 'já respondido'" (14/10/2026). Quem LÊ as respostas aos
 * avisos (as dispensas, o "Agora não" do Resumo) é só o módulo único, lib/avisos. As telas gravam
 * (as actions) e perguntam (categoriaResolvida, sugestaoResolvida, avisoResolvido...).
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

describe("só o módulo de avisos decide o que já foi respondido", () => {
  const fora = arquivos("src").filter((c) => !c.startsWith("src/lib/avisos/"));

  it("ninguém fora de lib/avisos lê as dispensas do banco", () => {
    // findMany/count/findFirst com o tipo da dispensa: gravar (create) e desfazer (deleteMany) pode.
    const leem = fora.filter((c) => {
      const t = readFileSync(c, "utf-8");
      return /(findMany|findFirst|count|groupBy)\(\{[^)]*tipo:\s*(\{[^}]*)?"(aviso_dispensado|sugestao_dispensada)"/.test(t);
    });
    expect(leem).toEqual([]);
  });

  it("ninguém fora de lib/avisos aplica a volta ou a marca do extrato por conta própria", () => {
    const usam = fora.filter((c) => /\b(respostaSeguraOAviso|limiteDaVolta|respostaResolve)\(/.test(readFileSync(c, "utf-8")));
    expect(usam).toEqual([]);
  });
});
