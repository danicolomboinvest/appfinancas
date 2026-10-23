import { describe, expect, it } from "vitest";
import { URL_DO_APP, urlDoAppPara } from "@/lib/email/url-do-app";

describe("urlDoAppPara", () => {
  it("usa o domínio de produção quando o cron chega pelo endereço interno do deploy", () => {
    expect(urlDoAppPara("appfinancas-o9vgu6yfl-danicolomboinvests-projects.vercel.app")).toBe(URL_DO_APP);
  });
  it("usa o domínio de produção sem host", () => {
    expect(urlDoAppPara(null)).toBe(URL_DO_APP);
  });
  it("mantém o localhost no computador", () => {
    expect(urlDoAppPara("localhost:3100")).toBe("http://localhost:3100");
  });
  it("o domínio de produção nunca é uma prévia da Vercel", () => {
    expect(URL_DO_APP).not.toMatch(/vercel\.app/);
  });
});
