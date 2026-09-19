import { describe, expect, it } from "vitest";
import { escolherQuemAvisar, marcaComoAvisada, type TentativaDeImport } from "../import-outreach";
import { mensagemImplausivel } from "@/lib/repositories/import-diagnostic.repo";

/**
 * Esta regra decide quem recebe mensagem no WhatsApp. Errar aqui não é um bug de tela: é uma
 * cliente irritada recebendo "oi, vi que deu um errinho" sobre um problema que ela já resolveu,
 * ou recebendo a mesma mensagem todo dia.
 */

let n = 0;
function tentativa(over: Partial<TentativaDeImport> = {}): TentativaDeImport {
  n += 1;
  return {
    id: `d${n}`,
    userId: "u1",
    stage: "parse",
    ok: false,
    created: 0,
    moneyLines: 0,
    parsed: 0,
    message: "Não consegui ler o arquivo.",
    fileName: "extrato.pdf",
    avisadoEm: null,
    createdAt: new Date("2026-09-19T12:00:00Z"),
    user: { email: "aluna@example.com", name: "Aluna" },
    ...over,
  };
}

describe("escolherQuemAvisar", () => {
  it("chama quem tentou e não conseguiu", () => {
    const r = escolherQuemAvisar([tentativa()]);
    expect(r).toHaveLength(1);
    expect(r[0].email).toBe("aluna@example.com");
    expect(r[0].problema).toBe("Não consegui ler o arquivo");
  });

  /** O caso que mais importa: ela se virou sozinha. Falar agora é ruído. */
  it("não chama quem resolveu depois", () => {
    const rows = [
      tentativa({ stage: "confirm", ok: true, created: 42, createdAt: new Date("2026-09-19T13:00:00Z") }),
      tentativa({ createdAt: new Date("2026-09-19T12:00:00Z") }),
    ];
    expect(escolherQuemAvisar(rows)).toEqual([]);
  });

  /** Erro DEPOIS de um sucesso antigo ainda é um problema em aberto. */
  it("chama quem conseguiu antes e falhou agora", () => {
    const rows = [
      tentativa({ createdAt: new Date("2026-09-19T14:00:00Z") }),
      tentativa({ stage: "confirm", ok: true, created: 10, createdAt: new Date("2026-09-18T09:00:00Z") }),
    ];
    expect(escolherQuemAvisar(rows)).toHaveLength(1);
  });

  it("não repete aviso já dado", () => {
    expect(escolherQuemAvisar([tentativa({ avisadoEm: new Date("2026-09-19T12:30:00Z") })])).toEqual([]);
  });

  it("manda uma mensagem só, mesmo com várias tentativas seguidas", () => {
    const rows = [
      tentativa({ createdAt: new Date("2026-09-19T12:05:00Z") }),
      tentativa({ createdAt: new Date("2026-09-19T12:03:00Z") }),
      tentativa({ createdAt: new Date("2026-09-19T12:00:00Z") }),
    ];
    const r = escolherQuemAvisar(rows);
    expect(r).toHaveLength(1);
    // A mais recente, que é a que ela lembra de ter tentado.
    expect(r[0].diagnosticId).toBe(rows[0].id);
  });

  it("separa pessoas diferentes", () => {
    const rows = [
      tentativa({ userId: "u1", user: { email: "a@example.com", name: "A" } }),
      tentativa({ userId: "u2", user: { email: "b@example.com", name: "B" } }),
    ];
    expect(escolherQuemAvisar(rows).map((p) => p.email).sort()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("chama também quem importou valores implausíveis, que é o pior caso", () => {
    const rows = [tentativa({ ok: true, message: mensagemImplausivel(["Valor fora de escala."]) })];
    const r = escolherQuemAvisar(rows);
    expect(r).toHaveLength(1);
    expect(r[0].problema).toBe("os valores entraram errados no app");
  });

  it("chama quem teve leitura parcial e diz o tamanho do buraco", () => {
    const rows = [tentativa({ ok: true, moneyLines: 210, parsed: 21 })];
    expect(escolherQuemAvisar(rows)[0].problema).toBe("o app leu só 21 de 210 linhas do arquivo");
  });

  it("deixa em paz quem importou bem", () => {
    const rows = [tentativa({ ok: true, moneyLines: 40, parsed: 40, message: null })];
    expect(escolherQuemAvisar(rows)).toEqual([]);
  });
});

/**
 * Quem fica marcada como "já avisada" e quem continua na fila.
 *
 * Marcar cedo demais é o erro caro: enquanto o token do ManyChat não estava configurado, o app
 * não conseguia nem TENTAR, e mesmo assim marcava todo mundo. No dia em que o token entrasse,
 * essas pessoas já teriam sido riscadas da fila sem nunca ter recebido nada.
 */
describe("marcaComoAvisada", () => {
  it("marca quando a mensagem foi entregue", () => {
    expect(marcaComoAvisada("enviado")).toBe(true);
  });

  /** Fato sobre a pessoa: insistir amanhã não muda. */
  it("marca quando o motivo não vai mudar sozinho", () => {
    expect(marcaComoAvisada("nao-encontrado")).toBe(true);
    expect(marcaComoAvisada("fora-da-janela")).toBe(true);
  });

  /** Buraco nosso: quando for tapado, essas pessoas ainda precisam ser avisadas. */
  it("NÃO marca quando faltava configuração do nosso lado", () => {
    expect(marcaComoAvisada("sem-token")).toBe(false);
    expect(marcaComoAvisada("sem-fluxo")).toBe(false);
    expect(marcaComoAvisada("sem-configuracao")).toBe(false);
  });
});
