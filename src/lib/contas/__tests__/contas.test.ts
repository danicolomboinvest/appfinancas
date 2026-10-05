import { describe, expect, it } from "vitest";
import { contasDoFoco, depoisDePagar, diasAte, hojeEmBrasilia, lembretesDeHoje, lerData, proximoMes, situacao, type ContaParaRegra } from "../contas";

const d = (s: string) => lerData(s)!;
const conta = (id: string, venc: string, extra: Partial<ContaParaRegra> = {}): ContaParaRegra => ({ id, nome: id, valor: 100, vencimento: d(venc), repete: false, lembrar: true, quitada: false, ...extra });

describe("situação da conta", () => {
  const hoje = d("2026-10-05");
  it("atrasada, hoje, amanhã, na semana e depois", () => {
    expect(situacao(d("2026-10-04"), hoje)).toBe("atrasada");
    expect(situacao(d("2026-10-05"), hoje)).toBe("hoje");
    expect(situacao(d("2026-10-06"), hoje)).toBe("amanha");
    expect(situacao(d("2026-10-12"), hoje)).toBe("semana");
    expect(situacao(d("2026-10-13"), hoje)).toBe("depois");
    expect(diasAte(d("2026-10-12"), hoje)).toBe(7);
  });
  it("hoje é o dia de Brasília: 01:00 UTC ainda é ontem", () => {
    expect(hojeEmBrasilia(new Date("2026-10-06T01:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-05");
    expect(hojeEmBrasilia(new Date("2026-10-06T03:30:00Z")).toISOString().slice(0, 10)).toBe("2026-10-06");
  });
});

describe("conta que repete", () => {
  it("vai pro mesmo dia do mês seguinte", () => {
    expect(proximoMes(d("2026-10-10")).toISOString().slice(0, 10)).toBe("2026-11-10");
    expect(proximoMes(d("2026-12-10")).toISOString().slice(0, 10)).toBe("2027-01-10");
  });
  it("dia 31 em fevereiro vira o último dia, e volta pro 31 em março", () => {
    const fev = proximoMes(d("2027-01-31"));
    expect(fev.toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(proximoMes(fev, 31).toISOString().slice(0, 10)).toBe("2027-03-31");
  });
  it("paguei: repete anda um mês; a que não repete fica quitada", () => {
    expect(depoisDePagar({ vencimento: d("2026-10-10"), repete: true })).toEqual({ vencimento: d("2026-11-10"), quitada: false });
    expect(depoisDePagar({ vencimento: d("2026-10-10"), repete: false })).toEqual({ vencimento: d("2026-10-10"), quitada: true });
  });
});

describe("Foco", () => {
  it("só atrasadas e os próximos 7 dias, da mais urgente; quitada fica de fora", () => {
    const hoje = d("2026-10-05");
    const lista = contasDoFoco([conta("internet", "2026-10-20"), conta("luz", "2026-10-06"), conta("escola", "2026-10-03"), conta("velha", "2026-10-01", { quitada: true })], hoje);
    expect(lista.map((c) => c.id)).toEqual(["escola", "luz"]);
    expect(lista[0].situacao).toBe("atrasada");
  });
});

describe("lembretes", () => {
  it("véspera e no dia; sem lembrar ou quitada não avisa; chave muda com o vencimento", () => {
    const hoje = d("2026-10-05");
    const l = lembretesDeHoje([conta("luz", "2026-10-06"), conta("agua", "2026-10-05"), conta("gas", "2026-10-07"), conta("off", "2026-10-06", { lembrar: false }), conta("paga", "2026-10-05", { quitada: true })], hoje);
    expect(l.map((x) => `${x.contaId}:${x.quando}`)).toEqual(["luz:vespera", "agua:dia"]);
    expect(l[0].chave).toBe("conta|luz|2026-10-06|vespera");
  });
});

describe("data digitada", () => {
  it("aceita AAAA-MM-DD válida e recusa 31/02", () => {
    expect(lerData("2026-10-12")?.toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(lerData("2026-02-31")).toBeNull();
    expect(lerData("12/10/2026")).toBeNull();
  });
});
