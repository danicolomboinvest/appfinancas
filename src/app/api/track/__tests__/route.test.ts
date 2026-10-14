import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth.config", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { usageEvent: { create: vi.fn() } } }));

const { POST } = await import("../route");

describe("POST /api/track", () => {
  it("sem sessão (o pageview da hora do login) não vira erro vermelho no console", async () => {
    const r = await POST(new Request("http://x/api/track", { method: "POST", body: JSON.stringify({ name: "pageview", path: "/login" }) }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: false });
  });
});
