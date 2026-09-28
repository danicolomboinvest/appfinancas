import { describe, expect, it } from "vitest";
import { adminInviteSchema, emailSchema, loginSchema, registerSchema } from "../auth.schema";
import { escolherContaDoEmail } from "@/lib/repositories/user.repo";

/** E-mail com maiúscula (teclado do celular, contato salvo) não pode virar outra conta. */
describe("e-mail no login e no cadastro", () => {
  it("sai minúsculo e sem espaço em todos os formulários", () => {
    expect(emailSchema.parse("  Maria.Silva@Gmail.com ")).toBe("maria.silva@gmail.com");
    expect(loginSchema.parse({ email: "Maria.Silva@Gmail.com", password: "x" }).email).toBe("maria.silva@gmail.com");
    expect(registerSchema.parse({ name: "Maria", email: "Maria.Silva@Gmail.com", password: "12345678", phone: "11987654321" }).email).toBe("maria.silva@gmail.com");
    expect(adminInviteSchema.parse({ name: "Maria", email: "MARIA@X.COM", password: "12345678" }).email).toBe("maria@x.com");
  });

  it("continua recusando o que não é e-mail, em português", () => {
    const r = emailSchema.safeParse("maria");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Email inválido.");
  });
});

describe("qual conta é a do e-mail", () => {
  const antiga = { id: "a", email: "Maria.Silva@Gmail.com" };
  const duplicada = { id: "b", email: "maria.silva@gmail.com" };

  it("acha a conta antiga gravada com maiúscula quando ela digita minúsculo", () => {
    expect(escolherContaDoEmail([antiga], "maria.silva@gmail.com")?.id).toBe("a");
  });

  it("com duas contas que só diferem na caixa, vence a grafada como digitado", () => {
    expect(escolherContaDoEmail([antiga, duplicada], "maria.silva@gmail.com")?.id).toBe("b");
    expect(escolherContaDoEmail([antiga, duplicada], "Maria.Silva@Gmail.com")?.id).toBe("a");
  });

  it("sem grafia exata, vence a mais antiga (a lista vem por data de criação)", () => {
    expect(escolherContaDoEmail([antiga, duplicada], "MARIA.SILVA@GMAIL.COM")?.id).toBe("a");
  });

  it("não aceita o que o ILIKE casou por causa do _ curinga", () => {
    expect(escolherContaDoEmail([{ id: "c", email: "mariaXsilva@x.com" }], "maria_silva@x.com")).toBeNull();
  });
});
