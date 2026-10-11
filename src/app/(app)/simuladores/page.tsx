import { getRequiredSession } from "@/lib/auth/session";
import { listSimulations } from "@/lib/repositories/simulation.repo";
import { TelaDasCalculadoras } from "@/components/calculadoras/TelaDasCalculadoras";

/**
 * Calculadoras (versão nova, 11/10/2026): "Qual é o seu momento?" com os cartões de foto e as
 * simulações salvas embaixo. O título da tela fica no topo do app ("Calculadoras").
 */
export default async function SimuladoresPage() {
  const ctx = await getRequiredSession();
  const salvas = await listSimulations(ctx);
  return (
    <TelaDasCalculadoras
      salvas={salvas.map((s) => ({
        id: s.id,
        tipo: String(s.type),
        nome: s.name ?? "",
        resumo: typeof s.outputJson === "object" && s.outputJson && "resumo" in s.outputJson ? String(s.outputJson.resumo) : "",
        data: s.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", ""),
      }))}
    />
  );
}
