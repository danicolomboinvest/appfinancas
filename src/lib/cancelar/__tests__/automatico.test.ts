import { describe, expect, it } from "vitest";
import { podeReceberEmail, prazoComPresente } from "../presente";
import { assuntoDaDuvida, respostaDaDuvida } from "../assuntos";
import { avisosDeHoje, lembretesDeEstender } from "../regras";
import { emailDaDuvida, emailDaRenovacao, emailDoErrado, emailDoReembolso, emailDosMeses, emailEstenderNaHubla } from "../emails";

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia, 3));
const agora = d(2026, 10, 11);

describe("2 meses grátis automáticos", () => {
  it("somam 60 dias ao prazo do acesso; sem prazo gravado, contam da renovação", () => {
    expect(prazoComPresente(d(2027, 3, 15), d(2027, 3, 15)).toISOString().slice(0, 10)).toBe("2027-05-14");
    expect(prazoComPresente(null, d(2027, 3, 15)).toISOString().slice(0, 10)).toBe("2027-05-14");
  });
});

describe("e-mails só para quem pode receber", () => {
  const ativo = { active: true, canceladoEm: null, expiresAt: d(2027, 3, 15) };
  it("ativo recebe; cancelou, pediu reembolso ou venceu, não", () => {
    expect(podeReceberEmail(ativo, agora)).toBe(true);
    expect(podeReceberEmail({ ...ativo, canceladoEm: agora }, agora)).toBe(false);
    expect(podeReceberEmail({ ...ativo, active: false }, agora)).toBe(false);
    expect(podeReceberEmail({ ...ativo, expiresAt: d(2026, 10, 1) }, agora)).toBe(false);
    expect(podeReceberEmail(null, agora)).toBe(false);
  });

  it("o aviso sai uma vez só, no dia certo (ou no seguinte, se o cron falhar), e não para quem cancelou", () => {
    const base = { tipo: "aviso_renovacao", estado: "aberto", avisarEm: new Date(Date.UTC(2027, 2, 8)), emailEnviadoEm: null as Date | null, podeReceber: true };
    const no = (dia: number, p = base) => avisosDeHoje([p], new Date(Date.UTC(2027, 2, dia))).length;
    expect(no(7)).toBe(0);
    expect(no(8)).toBe(1);
    expect(no(9)).toBe(1);
    expect(no(10)).toBe(0);
    expect(no(8, { ...base, emailEnviadoEm: new Date() })).toBe(0);
    expect(no(8, { ...base, podeReceber: false })).toBe(0);
    expect(no(8, { ...base, tipo: "duvida" })).toBe(0);
  });
});

describe("resposta automática da dúvida", () => {
  it("acha o assunto pelas palavras", () => {
    expect(assuntoDaDuvida("Não consigo importar o extrato do Nubank")).toBe("importar");
    expect(assuntoDaDuvida("esqueci a senha e não consigo entrar")).toBe("acesso");
    expect(assuntoDaDuvida("o app colocou o iFood na categoria errada")).toBe("categoria");
    expect(assuntoDaDuvida("como crio uma meta de viagem?")).toBe("metas");
    expect(assuntoDaDuvida("onde vejo o limite do cartão")).toBe("cartao");
    expect(assuntoDaDuvida("achei tudo muito confuso")).toBeNull();
  });
  it("cada assunto tem passo a passo e guia; o vídeo combina quando existe", () => {
    expect(respostaDaDuvida("meta").resposta.video).toContain("como-funciona-4-metas");
    expect(respostaDaDuvida("senha").resposta.video).toBeNull();
    expect(respostaDaDuvida("confuso").resposta.guia).toBe("/guia");
  });
});

describe("os e-mails do fluxo, no estilo B com o tema", () => {
  const base = { tema: "girly", nome: "Ana Souza", urlDoApp: "https://app.test" };
  const todos = [
    emailDosMeses({ ...base, ate: "14 de maio de 2027" }),
    emailDaDuvida({ ...base, resposta: respostaDaDuvida("extrato").resposta, duvida: "<b>como importo?</b>" }),
    emailDoErrado(base),
    emailDoReembolso({ ...base, ate: "15 de outubro" }),
    emailDaRenovacao({ ...base, renova: "15 de março de 2027" }),
  ];
  it("sem travessão nem emoji, com o logo do tema", () => {
    for (const e of todos) {
      expect(e.subject + e.html).not.toMatch(/[—–]/);
      expect(e.subject).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(e.html).toContain("logo-girly.png");
    }
  });
  it("os textos combinados", () => {
    expect(todos[0].html).toContain("agora vale até <b>14 de maio de 2027</b>");
    expect(todos[1].html).toContain("Se não resolveu, responda este e-mail.");
    expect(todos[1].html).toContain("https://app.test/videos/como-funciona-1-primeiro-mes.mp4");
    expect(todos[1].html).not.toContain("<b>como importo?</b>");
    expect(todos[2].html).toContain("A gente te responde em até 48 horas");
    expect(todos[2].html).not.toMatch(/corrig/);
  });
  it("Titânio leva o logo dele", () => {
    expect(emailDoErrado({ ...base, tema: "titanio" }).html).toContain("logo-titanio.png");
  });
});

describe("estender 60 dias na Hubla (a Dani, com um toque)", () => {
  it("o aviso para ela tem o assunto, a linha e o link", () => {
    const e = emailEstenderNaHubla({ nome: "Ana Souza", email: "ana@x.com", link: "https://app.hub.la/dashboard/subscriptions/sub_1" });
    expect(e.subject).toBe("Estender 60 dias: Ana Souza");
    expect(e.html).toContain("Abra, digite 60 e toque em Estender vencimento.");
    expect(e.html).toContain("https://app.hub.la/dashboard/subscriptions/sub_1");
  });
  it("o lembrete sai uma vez só, depois de 24 horas sem 'Feito na Hubla'", () => {
    const criado = new Date("2026-10-11T12:00:00Z");
    const p = { tipo: "meses_gratis", estado: "aberto", createdAt: criado, lembreteEm: null as Date | null };
    expect(lembretesDeEstender([p], new Date("2026-10-12T11:00:00Z"))).toHaveLength(0);
    expect(lembretesDeEstender([p], new Date("2026-10-12T12:00:00Z"))).toHaveLength(1);
    expect(lembretesDeEstender([{ ...p, lembreteEm: new Date() }], new Date("2026-10-13T12:00:00Z"))).toHaveLength(0);
    expect(lembretesDeEstender([{ ...p, estado: "feito" }], new Date("2026-10-13T12:00:00Z"))).toHaveLength(0);
  });
});
