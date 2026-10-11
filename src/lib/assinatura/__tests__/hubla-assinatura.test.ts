import { describe, expect, it } from "vitest";
import { extrairIdDaAssinatura, linkDaAssinaturaNaHubla } from "../hubla-assinatura";

describe("id da assinatura na Hubla", () => {
  it("lê os jeitos que o payload traz", () => {
    expect(extrairIdDaAssinatura({ subscription: { id: "sub_1" } })).toBe("sub_1");
    expect(extrairIdDaAssinatura({ invoice: { subscriptionId: "sub-2" } })).toBe("sub-2");
    expect(extrairIdDaAssinatura({ invoice: { subscription: { id: "sub3" } } })).toBe("sub3");
    expect(extrairIdDaAssinatura({ invoice: { id: "fat" } })).toBeNull();
    expect(extrairIdDaAssinatura({ subscription: { id: "../../x" } })).toBeNull();
  });
  it("link direto com o id, ou a busca pelo e-mail sem ele", () => {
    expect(linkDaAssinaturaNaHubla("sub_1", "a@b.com")).toBe("https://app.hub.la/dashboard/subscriptions/sub_1");
    expect(linkDaAssinaturaNaHubla(null, "ana+x@b.com")).toBe("https://app.hub.la/dashboard/subscriptions?search=ana%2Bx%40b.com&tab=subscriptions");
  });
});
