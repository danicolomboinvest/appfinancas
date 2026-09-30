import { describe, it, expect } from "vitest";
import { isExpired, mascararEmail, prazoAoLiberarDeNovo, situacaoDaLiberacao } from "../allowedEmail.repo";

// Instantes sempre ao meio-dia: evita que uma diferença de fuso entre a máquina que roda o
// teste e o Brasil (America/Sao_Paulo, usado por dentro de isExpired) empurre a data pro dia
// vizinho e estrague a comparação — o que se testa aqui é a regra de calendário, não a
// conversão de fuso em si (isso é responsabilidade de nowInBrazil).
const noon = (year: number, month: number, day: number) => new Date(year, month, day, 12, 0, 0);

describe("isExpired", () => {
  it("sem prazo (null) nunca vence", () => {
    expect(isExpired(null, noon(2027, 0, 1))).toBe(false);
  });

  it("acesso 'até' um dia ainda vale o dia inteiro (não vence no mesmo dia)", () => {
    expect(isExpired(noon(2026, 7, 30), noon(2026, 7, 30))).toBe(false);
  });

  it("vence no dia seguinte ao prazo", () => {
    expect(isExpired(noon(2026, 7, 30), noon(2026, 7, 31))).toBe(true);
  });

  it("não vence antes do prazo", () => {
    expect(isExpired(noon(2027, 0, 1), noon(2026, 11, 31))).toBe(false);
  });

  it("vence bem depois do prazo (virada de ano)", () => {
    expect(isExpired(noon(2026, 11, 31), noon(2027, 0, 1))).toBe(true);
  });
});

describe("prazoAoLiberarDeNovo (colar a lista de novo)", () => {
  const hoje = noon(2026, 8, 28);
  const umAno = noon(2027, 8, 28);

  it("VIP sem prazo continua sem prazo quando a lista vem com +1 ano", () => {
    expect(prazoAoLiberarDeNovo({ active: true, expiresAt: null }, umAno, hoje)).toBeUndefined();
  });

  it("quem tinha até 2028 não cai pra daqui a um ano", () => {
    expect(prazoAoLiberarDeNovo({ active: true, expiresAt: noon(2028, 0, 10) }, umAno, hoje)).toBeUndefined();
  });

  it("prazo novo mais longo estende quem está valendo", () => {
    expect(prazoAoLiberarDeNovo({ active: true, expiresAt: noon(2026, 11, 1) }, umAno, hoje)).toEqual(umAno);
  });

  it("campo em branco libera sem prazo, inclusive para quem já está valendo", () => {
    expect(prazoAoLiberarDeNovo({ active: true, expiresAt: noon(2026, 11, 1) }, null, hoje)).toBeNull();
  });

  it("vencida recebe o prazo novo — e campo em branco tira o vencimento antigo", () => {
    const vencida = { active: true, expiresAt: noon(2026, 7, 1) };
    expect(prazoAoLiberarDeNovo(vencida, umAno, hoje)).toEqual(umAno);
    expect(prazoAoLiberarDeNovo(vencida, null, hoje)).toBeNull();
  });

  it("desativada recomeça com o prazo informado agora, mesmo que fosse sem prazo antes", () => {
    expect(prazoAoLiberarDeNovo({ active: false, expiresAt: null }, umAno, hoje)).toEqual(umAno);
  });

  it("sem prazo informado (undefined) não mexe", () => {
    expect(prazoAoLiberarDeNovo({ active: false, expiresAt: noon(2026, 7, 1) }, undefined, hoje)).toBeUndefined();
  });
});

describe("situacaoDaLiberacao (quem usa o app, desde o fim do freemium)", () => {
  const hoje = noon(2026, 8, 30);
  it("sem linha na lista = nunca comprou com este e-mail", () => {
    expect(situacaoDaLiberacao(null, hoje)).toBe("sem-compra");
  });
  it("desativada (reembolso, cancelamento) = encerrado, mesmo dentro do prazo", () => {
    expect(situacaoDaLiberacao({ active: false, expiresAt: noon(2027, 8, 30) }, hoje)).toBe("encerrado");
  });
  it("ativa mas passou do prazo = vencido; no último dia ainda vale", () => {
    expect(situacaoDaLiberacao({ active: true, expiresAt: noon(2026, 8, 29) }, hoje)).toBe("vencido");
    expect(situacaoDaLiberacao({ active: true, expiresAt: noon(2026, 8, 30) }, hoje)).toBe("ativo");
  });
  it("ativa sem prazo = ativo", () => {
    expect(situacaoDaLiberacao({ active: true, expiresAt: null }, hoje)).toBe("ativo");
  });
});

describe("mascararEmail", () => {
  it("mostra o começo e o domínio, pra ela reconhecer sem entregar o endereço inteiro", () => {
    expect(mascararEmail("Thanize@Ymail.com ")).toBe("th•••••@ymail.com");
  });
  it("e-mail curtinho mostra só a primeira letra e ainda esconde com 3 pontos no mínimo", () => {
    expect(mascararEmail("ana@x.com")).toBe("a•••@x.com");
    expect(mascararEmail("jo@x.com")).toBe("j•••@x.com");
  });
});
