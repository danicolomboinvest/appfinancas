import { describe, expect, it } from "vitest";
import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import { PRODUTOS_APPLE, tokenDaConta } from "../config";
import { ehAppAndroid, ehAppDaApple } from "../app-da-apple";
import { anteriorAoReembolso, decidirLiberacaoApple, linhaDoPagamento, revogacaoAppleCorta, transacaoValendo } from "@/lib/repositories/assinaturaApple.repo";

const agora = new Date("2026-10-02T12:00:00Z");
const daqui30 = new Date("2026-11-01T12:00:00Z");
const tx = (extra: Partial<JWSTransactionDecodedPayload> = {}): JWSTransactionDecodedPayload => ({
  originalTransactionId: "1000",
  productId: PRODUTOS_APPLE.mensal,
  expiresDate: daqui30.getTime(),
  ...extra,
});

describe("tokenDaConta: o UUID que liga a compra da Apple à conta", () => {
  it("é um UUID v4 válido, sempre o mesmo pra mesma conta e diferente entre contas", () => {
    const a = tokenDaConta("a@exemplo.com");
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(tokenDaConta("a@exemplo.com")).toBe(a);
    expect(tokenDaConta("b@exemplo.com")).not.toBe(a);
  });
  it("vem do e-mail: conta excluída e recriada com o mesmo e-mail recupera a assinatura", () => {
    expect(tokenDaConta(" A@Exemplo.com ")).toBe(tokenDaConta("a@exemplo.com"));
  });
});

describe("ehAppDaApple", () => {
  it("só o app iOS (marca no user-agent) conta como app da Apple; Safari não", () => {
    expect(ehAppDaApple("Mozilla/5.0 (iPhone) AppleWebKit/605 SPIFinanceApp-iOS")).toBe(true);
    expect(ehAppDaApple("Mozilla/5.0 (iPhone) Version/18 Mobile Safari/604.1")).toBe(false);
    expect(ehAppDaApple(null)).toBe(false);
  });
  it("o app Android tem marca própria e não vira app da Apple", () => {
    const android = "Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile SPIFinanceApp-Android";
    expect(ehAppAndroid(android)).toBe(true);
    expect(ehAppDaApple(android)).toBe(false);
  });
});

describe("transacaoValendo", () => {
  it("assinatura nossa, sem reembolso e no prazo vale", () => {
    expect(transacaoValendo(tx(), agora)).toBe(true);
  });
  it("produto de outro app, reembolsada ou vencida não vale", () => {
    expect(transacaoValendo(tx({ productId: "com.outro.app" }), agora)).toBe(false);
    expect(transacaoValendo(tx({ revocationDate: agora.getTime() }), agora)).toBe(false);
    expect(transacaoValendo(tx({ expiresDate: agora.getTime() - 1 }), agora)).toBe(false);
  });
});

describe("decidirLiberacaoApple", () => {
  it("sem liberação: a Apple libera até o fim do período pago", () => {
    expect(decidirLiberacaoApple(null, daqui30, agora)).toEqual({ expiresAt: daqui30 });
  });
  it("compra do Hubla valendo não é tocada (nem encurtada)", () => {
    const hubla = { source: "HUBLA", active: true, expiresAt: new Date("2027-09-20T00:00:00Z"), lastHublaInvoiceId: "inv" };
    expect(decidirLiberacaoApple(hubla, daqui30, agora)).toBeNull();
  });
  it("VIP sem prazo da Dani não é tocado", () => {
    expect(decidirLiberacaoApple({ source: "MANUAL", active: true, expiresAt: null, lastHublaInvoiceId: null }, daqui30, agora)).toBeNull();
  });
  it("Hubla vencida ou reembolsada: a assinatura da Apple reabre o acesso", () => {
    const vencida = { source: "HUBLA", active: true, expiresAt: new Date("2026-09-01T00:00:00Z"), lastHublaInvoiceId: "inv" };
    expect(decidirLiberacaoApple(vencida, daqui30, agora)).toEqual({ expiresAt: daqui30 });
    expect(decidirLiberacaoApple({ ...vencida, active: false }, daqui30, agora)).toEqual({ expiresAt: daqui30 });
  });
  it("renovação da Apple estende; aviso repetido com prazo menor não encurta", () => {
    const apple = { source: "APPLE", active: true, expiresAt: daqui30, lastHublaInvoiceId: null };
    const mais = new Date("2026-12-01T12:00:00Z");
    expect(decidirLiberacaoApple(apple, mais, agora)).toEqual({ expiresAt: mais });
    expect(decidirLiberacaoApple(apple, new Date("2026-10-15T00:00:00Z"), agora)).toBeNull();
  });
});

describe("revogacaoAppleCorta: reembolso da Apple só tira o que a Apple deu", () => {
  it("corta liberação da Apple", () => {
    expect(revogacaoAppleCorta({ source: "APPLE", active: true, expiresAt: daqui30, lastHublaInvoiceId: null })).toBe(true);
  });
  it("não corta Hubla, VIP, nem linha da Apple que o Hubla também pagou", () => {
    expect(revogacaoAppleCorta({ source: "HUBLA", active: true, expiresAt: daqui30, lastHublaInvoiceId: "inv" })).toBe(false);
    expect(revogacaoAppleCorta({ source: "MANUAL", active: true, expiresAt: null, lastHublaInvoiceId: null })).toBe(false);
    expect(revogacaoAppleCorta({ source: "APPLE", active: true, expiresAt: daqui30, lastHublaInvoiceId: "inv" })).toBe(false);
    expect(revogacaoAppleCorta(null)).toBe(false);
  });
});

describe("anteriorAoReembolso: recibo guardado ou aviso velho não reabre acesso reembolsado", () => {
  const reembolso = new Date("2026-10-10T00:00:00Z");
  it("compra de antes do reembolso é barrada", () => {
    expect(anteriorAoReembolso(tx({ purchaseDate: new Date("2026-10-01T00:00:00Z").getTime() }), reembolso)).toBe(true);
  });
  it("assinar de novo depois do reembolso vale", () => {
    expect(anteriorAoReembolso(tx({ purchaseDate: new Date("2026-10-20T00:00:00Z").getTime() }), reembolso)).toBe(false);
  });
  it("sem reembolso, nada é barrado", () => {
    expect(anteriorAoReembolso(tx({ purchaseDate: 1 }), null)).toBe(false);
  });
});

describe("linhaDoPagamento: o que o Farol soma (06/10/2026)", () => {
  it("o preço vem em milésimos e vira centavos: R$ 87,90 = 87900 = 8790 centavos", () => {
    const l = linhaDoPagamento(tx({ transactionId: "1000", price: 87900, currency: "BRL", purchaseDate: agora.getTime() }));
    expect(l?.precoCentavos).toBe(8790);
    expect(l?.moeda).toBe("BRL");
    expect(l?.tipo).toBe("compra");
    expect(l?.compradaEm.toISOString()).toBe(agora.toISOString());
  });
  it("renovação tem transactionId próprio e conta como renovação", () => {
    expect(linhaDoPagamento(tx({ transactionId: "2000", price: 19900 }))?.tipo).toBe("renovacao");
    expect(linhaDoPagamento(tx({ transactionId: "1000", price: 19900 }), "DID_RENEW")?.tipo).toBe("renovacao");
  });
  it("sem preço fica null, nunca zero", () => {
    expect(linhaDoPagamento(tx({ transactionId: "1000" }))?.precoCentavos).toBeNull();
  });
  it("sem transactionId não vira linha", () => {
    expect(linhaDoPagamento(tx())).toBeNull();
  });
});
