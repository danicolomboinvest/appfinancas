import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Apagar a conta é direito da pessoa (LGPD) e quebra CALADO.
 *
 * Toda tabela nova que aponta pra User sem `onDelete: Cascade` precisa ser apagada à mão em
 * deleteUserAndAllData. Quem esquece não descobre na hora: o app compila, os testes passam, e
 * só quando uma cliente de verdade pede pra excluir a conta é que estoura erro de chave
 * estrangeira — e a exclusão inteira falha, inclusive as tabelas que estavam certas.
 *
 * Aconteceu ao criar a ImportFile. Este teste lê o schema e o repositório e compara os dois,
 * então quem criar a próxima tabela descobre aqui, e não pela cliente.
 */

const raiz = join(__dirname, "..", "..", "..", "..");
const schema = readFileSync(join(raiz, "prisma", "schema.prisma"), "utf-8");
const repo = readFileSync(join(raiz, "src", "lib", "repositories", "delete-account.repo.ts"), "utf-8");

/** Modelos com `userId` apontando pra User, e se o banco já apaga sozinho (cascade). */
function modelosLigadosAoUsuario(): { nome: string; cascade: boolean }[] {
  const encontrados: { nome: string; cascade: boolean }[] = [];
  for (const [, nome, corpo] of schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    if (nome === "User") continue;
    const relacaoUser = corpo.match(/^\s*user\s+User\??\s+@relation\(([^)]*)\)/m);
    if (!relacaoUser) continue;
    encontrados.push({ nome, cascade: /onDelete:\s*Cascade/.test(relacaoUser[1]) });
  }
  return encontrados;
}

const nomeNoPrisma = (modelo: string) => modelo[0].toLowerCase() + modelo.slice(1);

describe("deleteUserAndAllData cobre todas as tabelas do usuário", () => {
  it("acha as tabelas ligadas ao usuário no schema (se não achar, o teste não está testando nada)", () => {
    expect(modelosLigadosAoUsuario().length).toBeGreaterThan(15);
  });

  it("não deixa de fora nenhuma tabela que o banco não apaga sozinho", () => {
    const faltando = modelosLigadosAoUsuario()
      .filter((m) => !m.cascade)
      .filter((m) => !repo.includes(`prisma.${nomeNoPrisma(m.nome)}.deleteMany`))
      .map((m) => m.nome);

    expect(
      faltando,
      `Estas tabelas apontam pra User sem cascade e não são apagadas em deleteUserAndAllData. ` +
        `Quem tiver dado nelas não consegue excluir a conta: ${faltando.join(", ")}`,
    ).toEqual([]);
  });

  it("apaga os lançamentos antes do lote que os agrupa (senão a chave estrangeira trava)", () => {
    expect(repo.indexOf("prisma.monthlyEntry.deleteMany")).toBeLessThan(repo.indexOf("prisma.importBatch.deleteMany"));
  });
});
