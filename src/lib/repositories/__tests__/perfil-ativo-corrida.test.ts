import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Primeira entrada: o layout e a página chamam getOrCreateActiveProfile ao mesmo tempo, os dois
 * sem perfil nenhum no banco. Sem trava, cada um criava o seu e a conta nascia com dois
 * "Pessoal" ativos. Aqui o banco é de mentira, com latência e com o lock por transação
 * (pg_advisory_xact_lock) simulado: só uma transação por vez passa da trava.
 */

type Linha = { id: string; userId: string; name: string; kind: string; icon: string; theme: string; position: number; isDefault: boolean; createdAt: number };

const banco = vi.hoisted(() => ({ linhas: [] as Linha[], seq: 0 }));

vi.mock("@/lib/db/prisma", () => {
  const esperar = () => new Promise((r) => setTimeout(r, 5));
  const filtra = (where: { userId: string; isDefault?: boolean }) =>
    banco.linhas.filter((l) => l.userId === where.userId && (where.isDefault === undefined || l.isDefault === where.isDefault)).sort((a, b) => a.createdAt - b.createdAt);
  const financialProfile = {
    findFirst: async ({ where }: { where: { userId: string; isDefault?: boolean } }) => {
      await esperar();
      return filtra(where)[0] ?? null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Linha> }) => {
      await esperar();
      const l = banco.linhas.find((x) => x.id === where.id)!;
      Object.assign(l, data);
      return l;
    },
    create: async ({ data }: { data: Omit<Linha, "id" | "position" | "createdAt"> }) => {
      await esperar();
      const l: Linha = { position: 0, ...data, id: `p${++banco.seq}`, createdAt: banco.seq };
      banco.linhas.push(l);
      return l;
    },
  };
  // Uma trava só: basta pra provar que as transações passam uma de cada vez.
  let fila: Promise<unknown> = Promise.resolve();
  const $transaction = async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    let soltar!: () => void;
    const travou = new Promise<void>((r) => (soltar = r));
    const tx = {
      financialProfile,
      $executeRaw: async () => {
        const anterior = fila;
        fila = anterior.then(() => travou);
        await anterior;
      },
    };
    try {
      return await fn(tx);
    } finally {
      soltar();
    }
  };
  return { prisma: { financialProfile, $transaction } };
});

import { getOrCreateActiveProfile } from "../profile.repo";

describe("getOrCreateActiveProfile: primeira entrada", () => {
  beforeEach(() => {
    banco.linhas = [];
    banco.seq = 0;
  });

  it("layout e página ao mesmo tempo criam UM perfil só, e os dois recebem o mesmo", async () => {
    const [a, b] = await Promise.all([getOrCreateActiveProfile("u1"), getOrCreateActiveProfile("u1")]);
    expect(banco.linhas.filter((l) => l.userId === "u1")).toHaveLength(1);
    expect(a.id).toBe(b.id);
    expect(a.isDefault).toBe(true);
  });

  it("conta que já ficou com dois ativos devolve sempre o mais antigo", async () => {
    banco.linhas.push(
      { id: "novo", userId: "u2", name: "Empresa", kind: "EMPRESA", icon: "briefcase", theme: "padrao", position: 1, isDefault: true, createdAt: 20 },
      { id: "velho", userId: "u2", name: "Pessoal", kind: "PESSOAL", icon: "wallet", theme: "padrao", position: 0, isDefault: true, createdAt: 10 },
    );
    expect((await getOrCreateActiveProfile("u2")).id).toBe("velho");
  });
});
