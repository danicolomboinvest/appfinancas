import { describe, expect, it } from "vitest";
import { lerData } from "@/lib/contas/contas";
import { abriuEm, estadoDoReset } from "../progresso";
import { MISSOES, naVoz, vocabularioDaVoz } from "../missoes";
import { GUIAS } from "../guias";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import { vozDoTema } from "@/lib/profiles/voice";

const d = (s: string) => lerData(s)!;

describe("progresso do Money Reset", () => {
  it("sem o Dia 0, nada abre", () => {
    const e = estadoDoReset({ inicio: null, feitas: new Map(), hoje: d("2026-10-05") });
    expect(e.fase).toBe("dia0");
    expect(e.atual).toBeNull();
  });

  it("o dia 1 abre no dia seguinte ao Dia 0", () => {
    const mesmoDia = estadoDoReset({ inicio: d("2026-10-05"), feitas: new Map(), hoje: d("2026-10-05") });
    expect(mesmoDia).toMatchObject({ fase: "andamento", atual: 1, disponivel: false });
    expect(mesmoDia.status[1]).toBe("amanha");
    const amanha = estadoDoReset({ inicio: d("2026-10-05"), feitas: new Map(), hoje: d("2026-10-06") });
    expect(amanha).toMatchObject({ atual: 1, disponivel: true });
    expect(amanha.status[1]).toBe("hoje");
  });

  it("uma por dia: feita hoje, a próxima só amanhã; pulou dias, continua de onde parou", () => {
    const feitas = new Map([[1, d("2026-10-06")]]);
    expect(estadoDoReset({ inicio: d("2026-10-05"), feitas, hoje: d("2026-10-06") })).toMatchObject({ atual: 2, disponivel: false });
    const depois = estadoDoReset({ inicio: d("2026-10-05"), feitas, hoje: d("2026-10-20") });
    expect(depois).toMatchObject({ atual: 2, disponivel: true, feitas: 1 });
    expect(depois.status[1]).toBe("feita");
    expect(depois.status[3]).toBe("bloqueada");
  });

  it("as 21 feitas: concluído", () => {
    const feitas = new Map(MISSOES.map((m) => [m.d, d("2026-10-06")]));
    expect(estadoDoReset({ inicio: d("2026-10-05"), feitas, hoje: d("2026-10-30") })).toMatchObject({ fase: "concluido", feitas: 21 });
  });

  it("a missão conta o que ela fez desde o dia em que abriu", () => {
    const feitas = new Map([[1, d("2026-10-06")], [2, d("2026-10-09")]]);
    expect(abriuEm({ dia: 1, inicio: d("2026-10-05"), feitas }).toISOString().slice(0, 10)).toBe("2026-10-06");
    expect(abriuEm({ dia: 3, inicio: d("2026-10-05"), feitas }).toISOString().slice(0, 10)).toBe("2026-10-10");
  });
});

describe("as 21 missões", () => {
  it("são 21, uma por dia, 7 por semana, e cada uma tem guia ou tela", () => {
    expect(MISSOES.map((m) => m.d)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    for (const s of [1, 2, 3]) expect(MISSOES.filter((m) => m.semana === s)).toHaveLength(7);
    for (const m of MISSOES) expect(Math.ceil(m.d / 7), `dia ${m.d}`).toBe(m.semana);
  });

  it("no Girly, Metas viram Sonhos e o orçamento vira combinado; nenhuma marca sobra em tema nenhum", () => {
    const g = vocabularioDaVoz(vozDoTema("girly"));
    for (const m of MISSOES) {
      const tudo = [m.t, m.por, m.sozinho, m.btn, ...m.passos, ...m.toques, m.travou ?? ""].join(" | ");
      expect(naVoz(tudo, g), `dia ${m.d}`).not.toMatch(/\bmetas?\b|orçamento/i);
      for (const tema of PROFILE_THEMES) expect(naVoz(tudo, vocabularioDaVoz(vozDoTema(tema.key))), `${tema.key} dia ${m.d}`).not.toMatch(/\{|\}/);
    }
  });

  it("o guia diz o nome do botão que está na tela, no tema da pessoa", () => {
    const g = vocabularioDaVoz(vozDoTema("girly"));
    expect(g.Registrar).toBe("Anotar");
    expect(g.GravarAudio).toBe("Me contar por voz");
    expect(g.Importar).toBe("Mandar o extrato ou a fatura");
    expect(vocabularioDaVoz(vozDoTema("padrao")).Importar).toBe("Importar extrato ou fatura");
    for (const tema of PROFILE_THEMES) {
      const v = vocabularioDaVoz(vozDoTema(tema.key));
      for (const passos of Object.values(GUIAS)) for (const p of passos) expect(naVoz([p.txt, p.txtComputador ?? "", p.dica ?? ""].join(" "), v), tema.key).not.toMatch(/\{|\}/);
    }
  });
});
