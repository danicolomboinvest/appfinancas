/**
 * Cliente mínimo da API da Pluggy (Open Finance). Só o que o SPI usa: chave de API (2h),
 * connect token pro widget (30 min), item, contas, transações, apagar. Credenciais ficam
 * no servidor; o navegador só vê o connect token.
 */
const BASE = "https://api.pluggy.ai";

export function isPluggyConfigured(): boolean {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

let cached: { apiKey: string; at: number } | null = null;

async function apiKey(): Promise<string> {
  if (cached && Date.now() - cached.at < 100 * 60 * 1000) return cached.apiKey;
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`pluggy auth ${res.status}`);
  const data = (await res.json()) as { apiKey: string };
  cached = { apiKey: data.apiKey, at: Date.now() };
  return data.apiKey;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = await apiKey();
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", "X-API-KEY": key, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`pluggy ${init.method ?? "GET"} ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export type PluggyItem = { id: string; status: string; connector: { id: number; name: string; imageUrl?: string }; lastUpdatedAt?: string | null; nextAutoSyncAt?: string | null };
export type PluggyAccount = { id: string; type: "BANK" | "CREDIT"; subtype?: string; name: string; marketingName?: string | null; number?: string | null; balance: number };
export type PluggyTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type?: "DEBIT" | "CREDIT";
  status?: "PENDING" | "POSTED";
  creditCardMetadata?: { installmentNumber?: number | null; totalInstallments?: number | null; totalAmount?: number | null } | null;
};

export async function createConnectToken(clientUserId: string): Promise<string> {
  const data = await call<{ accessToken: string }>("/connect_token", { method: "POST", body: JSON.stringify({ options: { clientUserId, avoidDuplicates: true } }) });
  return data.accessToken;
}

export async function getItem(itemId: string): Promise<PluggyItem> {
  return call<PluggyItem>(`/items/${itemId}`);
}

export async function triggerItemUpdate(itemId: string): Promise<void> {
  await call(`/items/${itemId}`, { method: "PATCH", body: JSON.stringify({}) }).catch(() => undefined);
}

export async function deleteItem(itemId: string): Promise<void> {
  await call(`/items/${itemId}`, { method: "DELETE" }).catch(() => undefined);
}

export async function listAccounts(itemId: string): Promise<PluggyAccount[]> {
  const data = await call<{ results: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  return data.results ?? [];
}

export async function listTransactions(accountId: string, from: Date, to: Date): Promise<PluggyTransaction[]> {
  const out: PluggyTransaction[] = [];
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  for (let page = 1; page <= 20; page += 1) {
    const data = await call<{ results: PluggyTransaction[]; totalPages: number }>(
      `/transactions?accountId=${encodeURIComponent(accountId)}&from=${iso(from)}&to=${iso(to)}&page=${page}&pageSize=500`,
    );
    out.push(...(data.results ?? []));
    if (page >= (data.totalPages ?? 1)) break;
  }
  return out;
}

/** Id do conector "MeuPluggy" (o proxy gratuito), lido da lista de conectores. */
export async function findMeuPluggyConnectorId(): Promise<number | null> {
  const data = await call<{ results: { id: number; name: string; type?: string }[] }>("/connectors?name=MeuPluggy");
  const hit = data.results?.find((c) => /meu\s?pluggy/i.test(c.name)) ?? data.results?.[0];
  return hit?.id ?? null;
}
