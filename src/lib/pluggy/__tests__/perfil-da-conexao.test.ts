import { describe, expect, it } from "vitest";
import { escolherPerfilDaConexao } from "../perfil-da-conexao";

/**
 * O banco conectado no Pessoal continua entrando no Pessoal mesmo que o cron rode com a Empresa
 * ativa — antes, o perfil ativo na hora da busca decidia e os gastos da casa caíam na DRE.
 */
describe("perfil de destino do Open Finance", () => {
  it("fica no perfil onde as transações da folga já estão, mesmo com outro perfil ativo", () => {
    expect(escolherPerfilDaConexao({ jaImportadas: ["pessoal", "pessoal"], perfilDoUltimoLote: null, perfilAtivo: "empresa" })).toBe("pessoal");
  });

  it("vence o perfil com mais transações já importadas", () => {
    expect(escolherPerfilDaConexao({ jaImportadas: ["empresa", "pessoal", "pessoal"], perfilDoUltimoLote: "empresa", perfilAtivo: "empresa" })).toBe("pessoal");
  });

  it("histórico sem perfil não conta como lugar da conexão", () => {
    expect(escolherPerfilDaConexao({ jaImportadas: [null, null], perfilDoUltimoLote: "pessoal", perfilAtivo: "empresa" })).toBe("pessoal");
  });

  it("sem transação repetida, usa o perfil do último lote deste banco", () => {
    expect(escolherPerfilDaConexao({ jaImportadas: [], perfilDoUltimoLote: "pessoal", perfilAtivo: "empresa" })).toBe("pessoal");
  });

  it("primeira busca entra no perfil ativo, onde ela está ao conectar", () => {
    expect(escolherPerfilDaConexao({ jaImportadas: [], perfilDoUltimoLote: null, perfilAtivo: "empresa" })).toBe("empresa");
  });
});
