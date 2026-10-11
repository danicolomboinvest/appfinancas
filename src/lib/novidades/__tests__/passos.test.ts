import { describe, expect, it } from "vitest";
import { ABERTURA_DAS_NOVIDADES, PASSOS_DAS_NOVIDADES, contadorDoPasso } from "../passos";

describe("Tivemos uma mudança", () => {
  it("abre com a frase curta e os dois botões", () => {
    expect(ABERTURA_DAS_NOVIDADES).toEqual({ titulo: "Tivemos uma mudança", texto: "O SPI ficou mais simples. Te mostro em 1 minuto.", ver: "Ver o que mudou", pular: "Pular" });
  });

  it("passa pelas cinco mudanças da Fase 1, cada uma apontando um elemento de verdade", () => {
    expect(PASSOS_DAS_NOVIDADES.map((p) => p.alvo)).toEqual(["topo", "fluxo", "registrar", "livre", "perfil"]);
    expect(contadorDoPasso(1)).toBe("2 de 5");
  });

  it("sem emoji e sem travessão", () => {
    const textos = [...Object.values(ABERTURA_DAS_NOVIDADES), ...PASSOS_DAS_NOVIDADES.flatMap((p) => [p.titulo, p.texto, p.acao?.rotulo ?? ""])];
    for (const t of textos) expect(t, t).not.toMatch(/\p{Extended_Pictographic}|[—–]/u);
  });
});
