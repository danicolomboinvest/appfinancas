import { describe, expect, it } from "vitest";
import { FATURA_PENDENTE, addAccessPeriod, decidirPrazoHubla } from "../allowedEmail.repo";

const agora = new Date("2026-10-01T12:00:00Z");
const umAno = addAccessPeriod(agora);
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/** Aplica a decisão como o grantFromHubla grava no banco. */
function aplicar(
  linha: { active: boolean; expiresAt: Date | null; lastHublaInvoiceId: string | null } | null,
  invoiceId: string | null,
  now = agora,
) {
  const d = decidirPrazoHubla(linha, invoiceId, now);
  return {
    decisao: d,
    linha: {
      active: true,
      expiresAt: linha && !d.extended ? linha.expiresAt : d.expiresAt,
      lastHublaInvoiceId: d.lastHublaInvoiceId !== undefined ? d.lastHublaInvoiceId : (linha?.lastHublaInvoiceId ?? null),
    },
  };
}

describe("decidirPrazoHubla: a primeira compra dá UM ano, em qualquer ordem dos eventos", () => {
  it("member_added (sem fatura) antes do payment_succeeded: 1 ano, não 2", () => {
    const membro = aplicar(null, null);
    expect(membro.linha.lastHublaInvoiceId).toBe(FATURA_PENDENTE);
    const pagamento = aplicar(membro.linha, "inv_1");
    expect(pagamento.decisao.extended).toBe(false);
    expect(iso(pagamento.linha.expiresAt)).toBe(iso(umAno));
    expect(pagamento.linha.lastHublaInvoiceId).toBe("inv_1");
  });

  it("payment_succeeded antes do member_added: 1 ano", () => {
    const pagamento = aplicar(null, "inv_1");
    const membro = aplicar(pagamento.linha, null);
    expect(membro.decisao.extended).toBe(false);
    expect(iso(membro.linha.expiresAt)).toBe(iso(umAno));
  });

  it("reenvio da mesma fatura não estende", () => {
    const pagamento = aplicar(null, "inv_1");
    const reenvio = aplicar(pagamento.linha, "inv_1");
    expect(reenvio.decisao.extended).toBe(false);
    expect(iso(reenvio.linha.expiresAt)).toBe(iso(umAno));
  });

  it("renovação do ano seguinte (fatura nova) soma um ano ao vencimento", () => {
    const pagamento = aplicar(null, "inv_1");
    const renovacao = aplicar(pagamento.linha, "inv_2", new Date("2027-09-20T12:00:00Z"));
    expect(renovacao.decisao.extended).toBe(true);
    expect(iso(renovacao.linha.expiresAt)).toBe(iso(addAccessPeriod(umAno)));
  });

  it("fatura que chega muito depois de um período sem fatura é renovação de verdade", () => {
    const membro = aplicar(null, null);
    const depois = new Date("2027-09-20T12:00:00Z");
    const renovacao = aplicar(membro.linha, "inv_2", depois);
    expect(renovacao.decisao.extended).toBe(true);
  });

  it("acesso VIP sem prazo e valendo não é encurtado por uma compra", () => {
    const vip = { active: true, expiresAt: null, lastHublaInvoiceId: null };
    expect(decidirPrazoHubla(vip, "inv_1", agora)).toMatchObject({ extended: false, expiresAt: null });
    expect(decidirPrazoHubla(vip, null, agora)).toMatchObject({ extended: false, expiresAt: null });
  });

  it("linha desativada sem prazo ganha um ano (não volta sem prazo)", () => {
    const d = decidirPrazoHubla({ active: false, expiresAt: null, lastHublaInvoiceId: null }, null, agora);
    expect(d.extended).toBe(true);
    expect(iso(d.expiresAt)).toBe(iso(umAno));
  });
});
