import { describe, expect, it } from "vitest";
import { cartaoDaPilha, contadorDaPilha, juntarComE, ordenarPilha, type DadosDaPilha } from "../pilha";
import { planoDeCobrir, type CategoriaParaRemanejo } from "@/lib/planning/remanejo";
import type { FocoItem } from "../foco";

const money = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

/** O plano de outubro da Ana (ana-canonica.md). "Compras" no app real é Outros. */
const ana: CategoriaParaRemanejo[] = [
  { key: "MORADIA", label: "Moradia", planejado: 2700, gasto: 2666 },
  { key: "ALIMENTACAO", label: "Alimentação", planejado: 1500, gasto: 360 },
  { key: "OUTROS", label: "Compras", planejado: 950, gasto: 0 },
  { key: "TRANSPORTE", label: "Transporte", planejado: 800, gasto: 181 },
  { key: "LAZER", label: "Lazer", planejado: 600, gasto: 186 },
  { key: "EDUCACAO", label: "Educação", planejado: 400, gasto: 249 },
  { key: "SAUDE", label: "Saúde", planejado: 350, gasto: 417 },
];

const dados = (mudar: Partial<DadosDaPilha> = {}): DadosDaPilha => ({
  money,
  remanejo: { categorias: ana, essenciais: [], livre: 3241, diasRestantes: 25 },
  metas: [{ id: "europa", nome: "Europa", atual: 1429, alvo: 20000, prazoCurto: "nov/2027", porMes: 1340, ritmo: 200, chega: { curto: "mai/2032", ano: 2032, mes: 5 }, vencida: false }],
  reserva: { atual: 4200, alvo: 21000, fimDoMes: 383 },
  hrefMes: "/mensal/2026/10",
  ...mudar,
});

const estouro: FocoItem = {
  id: "estouro-SAUDE",
  nivel: 1,
  titulo: "Saúde passou",
  texto: "",
  href: "/orcamento",
  acao: "",
  detalhe: { tipo: "estouro", categoria: "SAUDE", label: "Saúde", gasto: 417, planejado: 350, sobra: 0, dias: 25, decorrido: 0.2 },
};
const meta: FocoItem = { id: "meta-europa", nivel: 2, titulo: "", texto: "", href: "", acao: "", detalhe: { tipo: "meta", metaId: "europa", nome: "Europa", porMes: 1340, quando: "novembro de 2027", vencida: false, ultimoMes: false } };
const reserva: FocoItem = { id: "reserva", nivel: 3, titulo: "", texto: "", href: "", acao: "", detalhe: { tipo: "reserva", meses: 0.6, minimo: 3 } };

describe("pilha do Decidir (rodadas 38, 49 e 53)", () => {
  it("Ana, Saúde: R$ 67 a mais, 'De onde sai?', Tirar de Compras sobrando R$ 883, o livre deixa R$ 127 por dia", () => {
    const c = cartaoDaPilha(estouro, dados())!;
    expect(c).toMatchObject({ titulo: "Saúde passou do plano", numero: "R$ 67", linha: "a mais que os R$ 350 do mês", pergunta: "De onde sai?", progresso: 1 });
    expect(c.respostas.map((r) => [r.id, r.titulo, r.sub ?? "", Boolean(r.principal)])).toEqual([
      ["tirar", "Tirar de Compras", "sobra R$ 883", true],
      ["livre", "Usar o livre do mês", "fica R$ 127 por dia", false],
      ["deixar", "Deixar assim por agora", "", false],
    ]);
  });

  it("sem folga no desejo: o livre vira a principal e o dia a dia vem com a etiqueta", () => {
    const cats = ana.map((c) => (c.key === "OUTROS" || c.key === "LAZER" ? { ...c, gasto: c.planejado } : c));
    const c = cartaoDaPilha(estouro, dados({ remanejo: { categorias: cats, essenciais: [], livre: 3241, diasRestantes: 25 } }))!;
    expect(c.respostas[0]).toMatchObject({ id: "livre", principal: true });
    expect(c.respostas[1]).toMatchObject({ id: "tirar", etiqueta: "é do dia a dia" });
    expect(c.respostas[1].principal).toBeFalsy();
  });

  it("duas origens fecham o valor exato e aparecem as duas no botão", () => {
    const cats = ana.map((c) => (c.key === "OUTROS" ? { ...c, gasto: 910 } : c.key === "LAZER" ? { ...c, gasto: 573 } : c));
    const c = cartaoDaPilha(estouro, dados({ remanejo: { categorias: cats, essenciais: [], livre: 3241, diasRestantes: 25 } }))!;
    expect(c.respostas[0].titulo).toBe("R$ 40 de Compras + R$ 27 de Lazer");
  });

  it("categoria criada marcada 'É essencial' nas preferências nunca é origem", () => {
    const cats = [...ana.map((c) => (c.key === "OUTROS" || c.key === "LAZER" ? { ...c, gasto: c.planejado } : c)), { key: "pet", label: "Pet", planejado: 500, gasto: 0 }];
    const livre = cartaoDaPilha(estouro, dados({ remanejo: { categorias: cats, essenciais: ["pet"], livre: 3241, diasRestantes: 25 } }))!;
    expect(livre.respostas.map((r) => r.titulo).join(" ")).not.toContain("Pet");
    const desejo = cartaoDaPilha(estouro, dados({ remanejo: { categorias: cats, essenciais: [], livre: 3241, diasRestantes: 25 } }))!;
    expect(desejo.respostas[0].titulo).toBe("Tirar de Pet");
  });

  it("Moradia, Saúde e Educação nunca saem, em nenhum mês sorteado", () => {
    let semente = 7;
    const sorteio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < 400; n++) {
      const cats = ana.map((c) => ({ ...c, planejado: Math.round(100 + sorteio() * 3000), gasto: Math.round(sorteio() * 3000) }));
      const passou = cats[Math.floor(sorteio() * cats.length)];
      if (passou.gasto <= passou.planejado) passou.gasto = passou.planejado + 1 + Math.round(sorteio() * 800);
      const p = planoDeCobrir(passou, cats);
      for (const o of p.origens) expect(["MORADIA", "SAUDE", "EDUCACAO", "IMPOSTOS"]).not.toContain(o.key);
      // Desejo primeiro: só cai no dia a dia quando nenhum desejo cobre sozinho ou em dupla.
      if (p.nivel === 2) {
        const desejo = cats.filter((c) => c.key !== passou.key && ["OUTROS", "LAZER"].includes(c.key)).map((c) => Math.max(0, Math.floor(c.planejado - c.gasto)));
        expect(desejo.reduce((s, f) => s + f, 0)).toBeLessThan(p.valor);
      }
      if (p.origens.length) expect(p.origens.reduce((s, o) => s + o.valor, 0)).toBe(p.valor);
    }
  });

  it("meta atrasada: 'Como recuperar?' com guardar a diferença por mês ou mudar a data pelo ritmo", () => {
    const c = cartaoDaPilha(meta, dados())!;
    expect(c).toMatchObject({ titulo: "Europa atrasada", numero: "R$ 1.429", linha: "guardados de R$ 20.000 · prazo nov/2027", pergunta: "Como recuperar?" });
    expect(c.respostas.map((r) => [r.id, r.titulo, r.sub ?? ""])).toEqual([
      ["guardar_mais", "Guardar mais R$ 1.140 por mês", "chega em nov/2027"],
      ["mudar_data", "Mudar a data", "para mai/2032"],
      ["deixar", "Deixar assim por agora", ""],
    ]);
  });

  it("meta com prazo vencido não oferece 'por mês': só a data nova", () => {
    const vencida = dados({ metas: [{ ...dados().metas[0], vencida: true }] });
    expect(cartaoDaPilha(meta, vencida)!.respostas.map((r) => r.id)).toEqual(["mudar_data", "deixar"]);
  });

  it("reserva curta: manda a sobra do fim do mês; sem sobra projetada, só 'Deixar assim'", () => {
    const c = cartaoDaPilha(reserva, dados())!;
    expect(c).toMatchObject({ titulo: "Reserva curta", numero: "R$ 4.200", linha: "na reserva · menos de 1 mês", pergunta: "Como reforçar?" });
    expect(c.respostas[0]).toMatchObject({ id: "sobra_reserva", sub: "+R$ 383 na reserva", principal: true });
    const semSobra = cartaoDaPilha(reserva, dados({ reserva: { atual: 4200, alvo: 21000, fimDoMes: -50 } }))!;
    expect(semSobra.respostas.map((r) => r.id)).toEqual(["deixar"]);
  });

  it("todo cartão tem 2 ou 3 respostas, e nenhuma leva ao Resumo", () => {
    const itens: FocoItem[] = [
      estouro,
      meta,
      reserva,
      { id: "raiox", nivel: 3, titulo: "", texto: "", href: "", acao: "", detalhe: { tipo: "raiox", n: 3, anual: 992 } },
      { id: "ritmo-LAZER", nivel: 3, titulo: "", texto: "", href: "", acao: "", detalhe: { tipo: "ritmo", categoria: "LAZER", label: "Lazer", gasto: 450, planejado: 600, sobra: 150, dias: 20, decorrido: 0.3 } },
      { id: "fora", nivel: 1, titulo: "", texto: "", href: "", acao: "", detalhe: { tipo: "fora", valor: 120, livre: 3000 } },
      { id: "aporte", nivel: 2, titulo: "", texto: "", href: "", acao: "", detalhe: { tipo: "aporte", falta: 400, guardado: 500, planejado: 900 } },
    ];
    for (const i of itens) {
      const c = cartaoDaPilha(i, dados())!;
      expect(c, i.id).not.toBeNull();
      expect(c.respostas.length, i.id).toBeGreaterThanOrEqual(2);
      expect(c.respostas.length, i.id).toBeLessThanOrEqual(3);
      for (const r of c.respostas) expect(r.href ?? "", i.id).not.toMatch(/\/mensal\/foco/);
      expect(c.respostas.filter((r) => r.principal).length, i.id).toBe(1);
    }
  });

  it("pular manda o cartão para o fim; o contador não encolhe enquanto ela resolve", () => {
    const pilha = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(ordenarPilha(pilha, { a: 1 }).map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(ordenarPilha(pilha, { a: 1, b: 1 }).map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(contadorDaPilha(3, 3)).toEqual({ atual: 1, total: 3 });
    expect(contadorDaPilha(3, 2)).toEqual({ atual: 2, total: 3 });
    expect(contadorDaPilha(3, 1)).toEqual({ atual: 3, total: 3 });
    expect(juntarComE(["Europa", "Reserva"])).toBe("Europa e Reserva");
    expect(juntarComE(["Saúde", "Europa", "Reserva"])).toBe("Saúde, Europa e Reserva");
  });
});

describe("prazo apertado na pilha (14/10/2026)", () => {
  it("a meta que pede mais do que cabe leva o selo para a sugestão de prazo", () => {
    const d = dados();
    const c = cartaoDaPilha(meta, { ...d, metas: d.metas.map((x) => ({ ...x, apertado: true })) })!;
    expect(c.prazoApertado).toBe("/planejamento/metas?prazo=europa");
  });
  it("sem aperto, sem selo (e nada mais muda)", () => {
    const c = cartaoDaPilha(meta, dados())!;
    expect(c.prazoApertado).toBeUndefined();
    expect(c.respostas[0]).toMatchObject({ id: "guardar_mais", principal: true });
  });
});
