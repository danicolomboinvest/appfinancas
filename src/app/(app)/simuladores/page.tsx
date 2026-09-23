import { Building2, Calculator, Car, Home, LineChart, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { HomeSectionCard } from "@/components/ui/HomeSectionCard";
import { getRequiredSession } from "@/lib/auth/session";
import { vozDoTema } from "@/lib/profiles/voice";
import { listSimulations } from "@/lib/repositories/simulation.repo";
import { SavedSimulations } from "./SavedSimulations";

const SIMULATORS = [
  {
    href: "/simuladores/financiar-vs-alugar",
    icon: Home,
    title: "Financiar vs. Alugar",
    subtitle: "Compare financiar um imóvel ou alugar e investir a diferença.",
  },
  {
    href: "/simuladores/amortizar-vs-investir",
    icon: Calculator,
    title: "Amortizar vs. Investir",
    subtitle: "Sobrou dinheiro: quitar o financiamento antes ou investir?",
  },
  {
    href: "/simuladores/consorcio",
    icon: Building2,
    title: "Consórcio vs. Financiamento",
    subtitle: "Compare os custos reais das duas formas de adquirir um bem.",
  },
  {
    href: "/simuladores/marcacao-mercado",
    icon: LineChart,
    title: "Marcação a Mercado",
    subtitle: "Veja como a venda antecipada de um título prefixado pode gerar lucro ou prejuízo.",
  },
  {
    href: "/simuladores/carro",
    icon: Car,
    title: "Carro: Assinar vs. Comprar",
    subtitle: "Assinatura de carro ou compra 0km, qual sai mais em conta?",
  },
  {
    href: "/simuladores/vale-a-pena",
    icon: ShoppingBag,
    title: "Vale a pena comprar?",
    subtitle: "Compare um preço com suas horas de trabalho e o que ele renderia investido.",
  },
];

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
    <div className="flex flex-col gap-8">
      <PageHeader
        title={voz.titulos.simuladores}
        subtitle={voz.titulos.simuladoresSub}
      />
      {/* As salvas vêm primeiro: quem já usou volta pra consultar o que guardou, não pra
          escolher a calculadora de novo. */}
      <SavedSimulations items={items} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATORS.map((simulator) => (
          <HomeSectionCard key={simulator.href} {...simulator} {...voz.titulos.simulador(simulator.href, simulator)} />
        ))}
      </div>
    </div>
  );
}
