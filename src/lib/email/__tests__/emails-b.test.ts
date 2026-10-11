import { describe, expect, it } from "vitest";
import { PROFILE_THEMES } from "@/lib/profiles/themes";
import { coresDoEmail, URL_DAS_IMAGENS } from "../blocos";
import { ANA, SOBROU_DA_ANA, avisosDaAna, exemplosDeEmail } from "../exemplos";
import { buildBudgetAlerts, metasQueChegaramLa } from "@/lib/insights/alerts";
import { alertEmail } from "../templates";
import { categoriasDoResumo, mesesDoGrafico, serieDoGrafico } from "@/lib/recap/email-do-resumo";

/**
 * Os e-mails na direção B ("Aurora"), todos, nos quatro temas, com os números da Ana canônica
 * (seção 8 de versao-nova-implementacao.md). O claro vai inline; o escuro vai no bloco
 * prefers-color-scheme, com as cores escuras do mesmo tema.
 */

/** O texto que a pessoa lê, sem o <head> e sem as tags: é o que o snapshot guarda. */
function textoVisivel(html: string): string {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#847;|&zwnj;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TEMAS = PROFILE_THEMES.map((t) => t.key);
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;
const TRAVESSAO = /[—–]/;

describe.each(TEMAS)("e-mails B no tema %s", (tema) => {
  const exemplos = exemplosDeEmail(tema);

  it.each(exemplos.map((e) => [e.nome, e.email] as const))("%s: assunto e texto (snapshot)", (_nome, email) => {
    expect({ assunto: email.subject, texto: textoVisivel(email.html) }).toMatchSnapshot();
  });

  it.each(exemplos.map((e) => [e.nome, e.email] as const))("%s: claro inline, escuro no bloco, do tema", (nome, email) => {
    // Quem comprou e ainda não criou a conta não tem tema: esses dois saem sempre no Padrão.
    const { claro, escuro } = coresDoEmail(nome.startsWith("conta-dia") ? "padrao" : tema);
    const logo = nome.startsWith("conta-dia") ? "padrao" : tema;
    // Claro: o fundo e o logo do tema, direto no HTML.
    expect(email.html).toContain(`background-color:${claro.canvas}`);
    expect(email.html).toContain(`${URL_DAS_IMAGENS}/logo-${logo}.png`);
    // Escuro: as mesmas classes com as cores escuras do tema, e o degradê do herói escuro.
    expect(email.html).toContain("@media (prefers-color-scheme: dark)");
    expect(email.html).toContain(`.bg-canvas{background-color:${escuro.canvas}!important;}`);
    expect(email.html).toContain(`.c-ink{color:${escuro.ink}!important;}`);
    expect(email.html).toContain(`linear-gradient(160deg,${escuro.heroDe} 0%,${escuro.heroPara} 75%)`);
    expect(email.html).toContain('<meta name="color-scheme" content="light dark">');
    // Outlook.com escuro.
    expect(email.html).toContain("[data-ogsb] .bg-canvas");
  });

  it.each(exemplos.map((e) => [e.nome, e.email] as const))("%s: sem estourou, sem emoji, sem travessão, assunto com maiúscula", (_nome, email) => {
    expect(`${email.subject} ${email.html}`.toLowerCase()).not.toContain("estour");
    expect(email.subject).not.toMatch(EMOJI);
    expect(email.html).not.toMatch(EMOJI);
    expect(email.subject).not.toMatch(TRAVESSAO);
    expect(email.html).not.toMatch(TRAVESSAO);
    expect(email.subject.charAt(0)).toBe(email.subject.charAt(0).toLocaleUpperCase("pt-BR"));
  });

  it.each(exemplos.map((e) => [e.nome, e.email] as const))("%s: compatível com cliente de e-mail", (_nome, email) => {
    expect(email.html).not.toMatch(/<script|<svg|\.svg"/i);
    // Toda imagem tem endereço completo (o e-mail não tem "site" para resolver caminho relativo).
    for (const [, src] of email.html.matchAll(/<img[^>]+src="([^"]+)"/g)) expect(src).toMatch(/^https:\/\//);
    // Até 600 px, e o Gmail corta a mensagem acima de ~102 KB.
    expect(email.html).toContain("max-width:600px");
    expect(Buffer.byteLength(email.html)).toBeLessThan(100_000);
  });
});

describe("números da Ana canônica (seção 8)", () => {
  const e = Object.fromEntries(exemplosDeEmail("padrao").map((x) => [x.nome, x.email]));

  it("resumo: entrou 7.700, gastou 4.059, guardou 900, sobrou 2.741", () => {
    expect(SOBROU_DA_ANA).toBe(2741);
    expect(e.resumo.subject).toBe("Sobrou R$ 2.741 em outubro");
    const t = textoVisivel(e.resumo.html);
    expect(t).toContain("Entrou R$ 7.700");
    expect(t).toContain("Gastou R$ 4.059");
    expect(t).toContain("Guardou R$ 900");
    expect(t).toContain("Viagem Europa 2027 7% R$ 1.429 de R$ 20.000");
    expect(t).toContain("Saúde R$ 417");
    expect(t).toContain("passou R$ 67");
  });

  it("Saúde passou R$ 67: tirar de Compras sobra R$ 883; com o livre, R$ 127 por dia", () => {
    const [passou] = avisosDaAna();
    expect(passou.title.replace(/\u00a0/g, " ")).toBe("Saúde passou R$ 67");
    expect(e.passou.subject).toBe("Saúde passou R$ 67");
    const t = textoVisivel(e.passou.html);
    expect(t).toContain("Tirar de Compras · sobra R$ 883");
    expect(t).toContain("O livre vai de R$ 3.241 para R$ 3.174. Fica R$ 127 por dia.");
    expect(t).toContain("Ainda faltam 25 dias de outubro");
    expect(t).toContain("R$ 417 gastos");
    expect(t).toContain("plano R$ 350");
  });

  it("os botões do aviso só ABREM a folha de resolver no app (um link, nada é executado)", () => {
    const links = [...e.passou.html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    const doApp = links.filter((l) => !l.includes("/configuracoes/"));
    expect(doApp.length).toBeGreaterThanOrEqual(2);
    for (const l of doApp) expect(l).toBe("https://financas.danicolombo.com.br/orcamento/2026?resolver=SAUDE");
    expect(textoVisivel(e.passou.html)).toContain("Nada muda sem você confirmar lá.");
  });

  it("vários avisos: o passou vira o herói e os outros entram embaixo", () => {
    expect(e["passou-e-mais"].subject).toBe("Saúde passou R$ 67 e mais 1");
    expect(textoVisivel(e["passou-e-mais"].html)).toContain("Também hoje");
  });

  it("meta: Você chegou lá, com o tempo e a média", () => {
    expect(e.meta.subject).toBe("Viagem para o Chile: você chegou lá");
    expect(textoVisivel(e.meta.html)).toContain("Em 9 meses, guardando R$ 889 por mês. Ela é sua.");
  });

  it("os números dos outros temas são os mesmos (muda a voz, não a conta)", () => {
    for (const tema of TEMAS) {
      const r = exemplosDeEmail(tema).find((x) => x.nome === "resumo")!;
      expect(r.email.subject).toBe("Sobrou R$ 2.741 em outubro");
    }
  });
});

describe("metas que chegaram lá", () => {
  const base = { id: "a", name: "Chile", alvo: 8000, guardado: 8000, criadaEm: new Date(2026, 0, 7), temAporteNoMes: true };
  it("só a que bateu o alvo com aporte neste mês (a antiga não ganha e-mail atrasado)", () => {
    expect(metasQueChegaramLa({ hoje: ANA.hoje, goals: [base] })).toHaveLength(1);
    expect(metasQueChegaramLa({ hoje: ANA.hoje, goals: [{ ...base, temAporteNoMes: false }] })).toEqual([]);
    expect(metasQueChegaramLa({ hoje: ANA.hoje, goals: [{ ...base, guardado: 7999 }] })).toEqual([]);
  });
  it("conta os meses desde a criação, pelo menos 1", () => {
    expect(metasQueChegaramLa({ hoje: ANA.hoje, goals: [base] })[0]).toMatchObject({ meses: 9 });
    expect(metasQueChegaramLa({ hoje: ANA.hoje, goals: [{ ...base, criadaEm: ANA.hoje }] })[0].meses).toBe(1);
  });
});

describe("dados novos do resumo", () => {
  it("o gráfico pega os 6 meses até o do resumo, e corta os meses antes do primeiro movimento", () => {
    const meses = mesesDoGrafico(2026, 2);
    expect(meses.map((m) => m.rotulo)).toEqual(["set", "out", "nov", "dez", "jan", "fev"]);
    const serie = serieDoGrafico(meses, [
      { year: 2026, month: 1, category: "INCOME", total: 5000 },
      { year: 2026, month: 2, category: "EXPENSE", total: 3000 },
    ]);
    expect(serie).toEqual([
      { rotulo: "jan", entrou: 5000, gastou: 0 },
      { rotulo: "fev", entrou: 0, gastou: 3000 },
    ]);
  });
  it("as 3 categorias que mais pesaram, com o plano de cada", () => {
    const cats = categoriasDoResumo(
      [
        { amount: 2666, parentCategory: "MORADIA", customCategoryId: null },
        { amount: 417, parentCategory: "SAUDE", customCategoryId: null },
        { amount: 500, parentCategory: null, customCategoryId: "pet" },
        { amount: 100, parentCategory: "LAZER", customCategoryId: null },
      ],
      [
        { parentCategory: "MORADIA", customCategoryId: null, planned: 2700 },
        { parentCategory: "SAUDE", customCategoryId: null, planned: 350 },
      ],
      (g) => g.parentCategory ?? "Pet",
    );
    expect(cats).toEqual([
      { chave: "MORADIA", nome: "MORADIA", gasto: 2666, plano: 2700 },
      { chave: null, nome: "Pet", gasto: 500, plano: 0 },
      { chave: "SAUDE", nome: "SAUDE", gasto: 417, plano: 350 },
    ]);
  });
});

/**
 * Prévia e corpo do aviso dizem o mesmo número de dias (11/10/2026). A prévia é o texto do aviso
 * (buildBudgetAlerts) e contava sem hoje; o corpo conta com hoje. O "passou" da Ana dizia
 * "faltam 24 dias" na prévia e "Ainda faltam 25 dias de outubro" lá dentro.
 */
describe("prévia e corpo do aviso: os mesmos dias", () => {
  const previa = (html: string) => html.match(/<div style="display:none;[^"]*">([^<]*?)&#847;/)?.[1] ?? "";
  const diasEm = (texto: string) => [...texto.matchAll(/(\d+) dias?\b/g)].map((m) => Number(m[1]));
  const reais = (v: number) => `R$ ${v}`;

  it.each(TEMAS)("exemplos da Ana no tema %s: passou, passou-e-mais, perto e cartao", (tema) => {
    for (const { nome, email } of exemplosDeEmail(tema).filter((x) => ["passou", "passou-e-mais", "perto", "cartao"].includes(x.nome))) {
      const p = previa(email.html);
      expect(p, nome).not.toBe("");
      const corpo = textoVisivel(email.html).slice(textoVisivel(email.html).indexOf(p) + p.length);
      const naPrevia = diasEm(p);
      // Todo número de dias que a prévia diz aparece igual no corpo.
      for (const n of naPrevia) expect(diasEm(corpo), `${nome}: prévia diz ${n}`).toContain(n);
    }
  });

  it("todo dia de outubro e o último de dezembro: passou e perto com o mesmo número nos dois lugares", () => {
    const casos: { ano: number; mes: number; dia: number }[] = [...Array.from({ length: 31 }, (_, i) => ({ ano: 2026, mes: 10, dia: i + 1 })), { ano: 2026, mes: 12, dia: 31 }, { ano: 2028, mes: 2, dia: 29 }];
    for (const { ano, mes, dia } of casos) {
      const alertas = buildBudgetAlerts({
        year: ano,
        month: mes,
        today: new Date(ano, mes - 1, dia),
        planned: [
          { parentCategory: "SAUDE", planned: 350 },
          { parentCategory: "ALIMENTACAO", planned: 1000 },
        ],
        spent: [
          { parentCategory: "SAUDE", spent: 417 },
          { parentCategory: "ALIMENTACAO", spent: 850 },
        ],
        money: reais,
      });
      for (const a of alertas) {
        const email = alertEmail({ name: "Ana", alerts: [a], preferencesUrl: "https://x/p", tema: "padrao" });
        const p = previa(email.html);
        const corpo = textoVisivel(email.html).slice(textoVisivel(email.html).indexOf(p) + p.length);
        const esperado = a.dados && "diasRestantes" in a.dados ? a.dados.diasRestantes : null;
        expect(esperado, `${a.key} ${dia}/${mes}`).not.toBeNull();
        expect(diasEm(p), `prévia ${a.key} ${dia}/${mes}`).toEqual([esperado]);
        expect(diasEm(corpo), `corpo ${a.key} ${dia}/${mes}`).toContain(esperado);
      }
    }
  });
});
