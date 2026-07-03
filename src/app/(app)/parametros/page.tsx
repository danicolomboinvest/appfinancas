import { getRequiredSession } from "@/lib/auth/session";
import { listReferenceRates } from "@/lib/repositories/reference-rate.repo";
import { ReferenceRateForm } from "./ReferenceRateForm";
import { DeleteRateButton } from "./DeleteRateButton";

const BASIS_LABEL: Record<string, string> = {
  ANNUAL_252: "a.a. (base 252)",
  ANNUAL_365: "a.a. (base 365)",
  MONTHLY: "a.m.",
};

export default async function ParametrosPage() {
  const ctx = await getRequiredSession();
  const rates = await listReferenceRates(ctx);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Premissas e taxas de referência</h1>
        <p className="mt-1 text-sm text-black/60">
          Taxas usadas como sugestão/âncora nos módulos de planejamento e simuladores.
        </p>
      </div>

      <ReferenceRateForm />

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-black/60">
            <th className="py-2">Nome</th>
            <th className="py-2">Taxa</th>
            <th className="py-2">Base</th>
            <th className="py-2">Vigente desde</th>
            <th className="py-2">Origem</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id} className="border-b border-black/5">
              <td className="py-2">{rate.name}</td>
              <td className="py-2">{(Number(rate.rateValue) * 100).toFixed(2)}%</td>
              <td className="py-2">{BASIS_LABEL[rate.basis]}</td>
              <td className="py-2">{rate.effectiveDate.toLocaleDateString("pt-BR")}</td>
              <td className="py-2">{rate.userId ? "Sua taxa" : "Padrão do sistema"}</td>
              <td className="py-2">{rate.userId === ctx.userId && <DeleteRateButton id={rate.id} />}</td>
            </tr>
          ))}
          {rates.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-black/40">
                Nenhuma taxa cadastrada ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
