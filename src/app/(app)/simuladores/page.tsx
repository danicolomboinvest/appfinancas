import { PageHeader } from "@/components/ui/PageHeader";
import { GradeDeCalculadoras } from "@/components/calculadoras/GradeDeCalculadoras";
import { calculadoras } from "@/lib/calculadoras";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { listSimulations } from "@/lib/repositories/simulation.repo";
import { SavedSimulations } from "./SavedSimulations";


export default async function SimuladoresPage() {
  const ctx = await getRequiredSession();
  const voz = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const salvas = await listSimulations(ctx);
  const items = salvas.map((s) => ({
    id: s.id,
    type: s.type as string,
    name: s.name,
    resumo: typeof s.outputJson === "object" && s.outputJson && "resumo" in s.outputJson ? String(s.outputJson.resumo) : "",
    createdAt: s.createdAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Sem subtítulo: o nome de cada calculadora já é a pergunta que ela responde. */}
      <PageHeader title={voz.titulos.calcTitulo} />
      <GradeDeCalculadoras itens={calculadoras(voz.titulos)} />
      {/* As que ela salvou ficam embaixo das calculadoras, para consultar depois. */}
      <SavedSimulations items={items} />
    </div>
  );
}
