/**
 * Celular brasileiro, guardado sempre normalizado com DDI: "5511987654321". A pessoa digita do
 * jeito que quiser — "(11) 98765-4321", "11987654321", "+55 11 98765-4321" — e a gente limpa.
 * Normalizado assim, vira link de WhatsApp direto (wa.me/5511987654321) no painel admin.
 */

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Tira o DDI se a pessoa digitou (com ou sem +); recolocamos no final.
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  // DDD (2) + celular (9 dígitos, começa em 9) ou fixo (8). Fora disso, número inválido.
  if (local.length !== 10 && local.length !== 11) return null;
  const ddd = Number(local.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  return `55${local}`;
}

/** "5511987654321" → "(11) 98765-4321", pra exibir bonito. */
export function formatPhone(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const local = stored.startsWith("55") ? stored.slice(2) : stored;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return stored;
}

/** Link "conversar no WhatsApp" do painel admin. */
export function whatsappUrl(stored: string): string {
  return `https://wa.me/${stored}`;
}
