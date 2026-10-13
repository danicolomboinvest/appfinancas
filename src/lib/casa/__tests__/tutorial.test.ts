import { describe, expect, it } from "vitest";
import { lerConfigCasal } from "@/lib/casal/acerto";
import { TOTAL_DE_PASSOS_DO_CASAL, abreOTutorialDoCasal, comVisto, textosDoTutorial, type FimDoTutorial } from "../tutorial";

const lucas = { nome: "Lucas", papel: "par" as const };
const FINS: FimDoTutorial[] = ["pronto", "convidar", "liberar", "esperando"];

function todosOsTextos(outro: typeof lucas | null, fim: FimDoTutorial, preco: string | null = "R$ 27"): string[] {
  const tx = textosDoTutorial(outro, { fim, preco });
  return [...tx.passos.flatMap((p) => [p.titulo, p.texto]), ...tx.regras, tx.botaoFinal, tx.preco ?? ""];
}

describe("Como funciona o casal: os passos", () => {
  it("são seis, um conceito por tela, na ordem pedida", () => {
    const tx = textosDoTutorial(lucas);
    expect(tx.passos).toHaveLength(TOTAL_DE_PASSOS_DO_CASAL);
    expect(tx.passos.map((p) => p.id)).toEqual(["cada-um", "da-casa", "acerto", "o-que-ve", "regras", "fim"]);
    expect(tx.regras).toHaveLength(3);
  });

  it("o nome do par vem dos dados, sem artigo", () => {
    const tx = textosDoTutorial(lucas);
    expect(tx.passos[3].titulo).toBe("O que Lucas vê");
    expect(tx.passos[3].texto.startsWith("Lucas vê")).toBe(true);
    expect(todosOsTextos(lucas, "pronto").join(" ")).not.toMatch(/\b(o|a) Lucas\b/);
  });

  it("sem par, fala do par sem nome e termina no convite", () => {
    const tx = textosDoTutorial(null, { preco: "R$ 27" });
    expect(tx.passos[3].titulo).toBe("O que o par vê");
    expect(tx.passos[5].titulo).toBe("Agora, chame seu par");
    expect(tx.botaoFinal).toBe("Convidar meu par");
    expect(tx.preco).toBe("O Casal custa R$ 27 por ano, para quem convida.");
  });

  it("o preço só aparece antes de ter par, e só quando foi passado (cobrança ligada)", () => {
    expect(textosDoTutorial(lucas, { preco: "R$ 27" }).preco).toBeNull();
    expect(textosDoTutorial(lucas, { preco: "R$ 27", fim: "esperando" }).preco).toBeNull();
    expect(textosDoTutorial(null, { preco: null }).preco).toBeNull();
    expect(textosDoTutorial(null, { preco: "R$ 27", fim: "liberar" }).botaoFinal).toBe("Liberar o Casal");
  });

  it("com o convite mandado, espera o par pelo nome", () => {
    const tx = textosDoTutorial(lucas, { fim: "esperando" });
    expect(tx.passos[5].titulo).toBe("Falta Lucas entrar");
    expect(tx.botaoFinal).toBe("Pronto");
  });

  it("sem travessão, sem emoji, sem 'pra' e sem gênero", () => {
    for (const outro of [lucas, null]) {
      for (const fim of FINS) {
        for (const t of todosOsTextos(outro, fim)) {
          expect(t).not.toMatch(/[—–]/);
          expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
          expect(t).not.toMatch(/\bpra\b/i);
          expect(t).not.toMatch(/\b(sozinha|sozinho|bem-vinda|bem-vindo|pronta|preparada|ela|ele)\b/i);
        }
      }
    }
  });
});

describe("Como funciona o casal: quem vê sozinho", () => {
  it("abre uma vez, só para quem está numa casa e ainda não viu", () => {
    expect(abreOTutorialDoCasal({ naCasa: true, vistoNaConta: false, vistoNesteAparelho: false })).toBe(true);
    expect(abreOTutorialDoCasal({ naCasa: true, vistoNaConta: true, vistoNesteAparelho: false })).toBe(false);
    expect(abreOTutorialDoCasal({ naCasa: true, vistoNaConta: false, vistoNesteAparelho: true })).toBe(false);
    expect(abreOTutorialDoCasal({ naCasa: false, vistoNaConta: false, vistoNesteAparelho: false })).toBe(false);
  });

  it("a marca é por conta: a titular ver não marca o par", () => {
    const depois = comVisto(undefined, "titular-1");
    expect(depois).toEqual(["titular-1"]);
    expect(comVisto(depois, "titular-1")).toEqual(["titular-1"]);
    expect(comVisto(depois, "par-1")).toEqual(["titular-1", "par-1"]);
  });

  it("a marca mora no perfil Casal e sobrevive à leitura da configuração", () => {
    const lida = lerConfigCasal({ nomeA: "Ana", nomeB: "Lucas", divisao: "meio", acertos: [], tutorialVisto: ["u1", 7, "", "u2"] });
    expect(lida.tutorialVisto).toEqual(["u1", "u2"]);
    expect(lerConfigCasal({ nomeA: "Ana" }).tutorialVisto).toBeUndefined();
    // Quem salva o jeito de dividir espalha a configuração lida: a marca continua lá.
    expect({ ...lida, divisao: "renda" }.tutorialVisto).toEqual(["u1", "u2"]);
  });
});
