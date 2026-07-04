import { Building2, Calculator, Car, Home, LineChart } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { HomeSectionCard } from "@/components/ui/HomeSectionCard";

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
    subtitle: "Assinatura de carro ou compra 0km — qual sai mais em conta?",
  },
];

export default function SimuladoresPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Simuladores" subtitle="Calculadoras para decisões financeiras importantes do dia a dia." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATORS.map((simulator) => (
          <HomeSectionCard key={simulator.href} {...simulator} />
        ))}
      </div>
    </div>
  );
}
