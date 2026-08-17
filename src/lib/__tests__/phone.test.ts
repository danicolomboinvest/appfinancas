import { describe, expect, it } from "vitest";
import { normalizePhone, formatPhone, whatsappUrl } from "../phone";

describe("normalizePhone", () => {
  it("aceita os jeitos comuns de digitar e guarda sempre igual", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizePhone("11987654321")).toBe("5511987654321");
    expect(normalizePhone("+55 11 98765-4321")).toBe("5511987654321");
    expect(normalizePhone("5511987654321")).toBe("5511987654321");
    expect(normalizePhone("11 9 8765 4321")).toBe("5511987654321");
  });

  it("aceita fixo (10 dígitos) também", () => {
    expect(normalizePhone("(21) 3456-7890")).toBe("552134567890");
  });

  it("rejeita número curto, longo ou DDD inválido", () => {
    expect(normalizePhone("987654321")).toBeNull(); // sem DDD
    expect(normalizePhone("119876543210000")).toBeNull(); // longo demais
    expect(normalizePhone("(01) 98765-4321")).toBeNull(); // DDD 01 não existe
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("rejeita número estrangeiro com DDI explícito, em vez de confundir com DDD brasileiro", () => {
    // Bug real: "+1 647 919 5010" (Canadá) perdia o "+1" ao tirar os não-dígitos e "16"
    // (Campinas) virava DDD válido por acidente — guardava celular canadense como se fosse BR.
    expect(normalizePhone("+1 647 919 5010")).toBeNull();
    expect(normalizePhone("+44 7732 060362")).toBeNull(); // Reino Unido
    expect(normalizePhone("+351 912 345 678")).toBeNull(); // Portugal
    // +55 continua aceito normalmente (não é o país estrangeiro que quebra, é a falta de DDI).
    expect(normalizePhone("+55 11 98765-4321")).toBe("5511987654321");
  });

  it("exibe formatado e gera link de WhatsApp", () => {
    expect(formatPhone("5511987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("552134567890")).toBe("(21) 3456-7890");
    expect(formatPhone(null)).toBeNull();
    expect(whatsappUrl("5511987654321")).toBe("https://wa.me/5511987654321");
  });
});
