import { PageHeader } from "@/components/ui/PageHeader";
import { TravelPlanner } from "./TravelPlanner";

export default function ViagemPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Planejar viagem"
        subtitle="Estime quanto custa o destino dos seus sonhos e transforme em meta com aporte mensal."
      />
      <TravelPlanner />
    </div>
  );
}
