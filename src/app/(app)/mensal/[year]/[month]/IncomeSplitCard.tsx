import { Card } from "@/components/ui/Card";
import { Donut, type DonutSlice } from "@/components/charts/Donut";
import { serverMoney } from "@/lib/money-server";


/**
 * Para onde a RENDA foi — não os gastos (isso é a outra rosca), mas a divisão do bolo inteiro:
 * quanto virou gasto, quanto virou aporte e quanto sobrou. É a visão que responde "estou
 * guardando uma fatia decente do que ganho?", que nenhum número isolado da tela responde.
 *
 * Só aparece com renda lançada no mês: sem renda, "dividir a renda" não significa nada (e a
 * conta de porcentagem viraria divisão por zero).
 */
export async function IncomeSplitCard({
  income,
  expense,
  investment,
  balance,
}: {
  income: number;
  expense: number;
  investment: number;
  balance: number;
}) {
  const money = await serverMoney();
  if (income <= 0) return null;

  // Saldo negativo (gastou mais do que ganhou) não vira fatia: não existe "sobra de -R$ 300"
  // num gráfico de partes de um todo. Nesse caso o aviso embaixo conta o que aconteceu.
  const leftover = Math.max(0, balance);
  const slices: DonutSlice[] = [
    { name: "Gastos", value: expense, color: "var(--color-danger)" },
    { name: "Aportes", value: investment, color: "var(--color-accent)" },
    { name: "Sobrou", value: leftover, color: "var(--color-success)" },
  ].filter((s) => s.value > 0);

  const savedShare = income > 0 ? (investment + leftover) / income : 0;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="text-sm font-medium text-ink">Como sua renda foi dividida</p>
      {/* O centro carrega a renda do mês, não a soma das fatias: é dela que as partes saíram, e
          ver o total no meio é o que dá sentido a "Gastos 67%". */}
      <Donut
        slices={slices}
        centerLabel="Renda"
        centerValue={money(income, { round: true })}
        maxSlices={4}
        size={160}
      />
      <p className="text-caption text-ink-faint">
        {balance < 0 ? (
          <>Você gastou {money(Math.abs(balance), { round: true })} a mais do que entrou este mês.</>
        ) : (
          <>
            De cada 100 que entraram, você manteve{" "}
            <span className="font-medium text-ink">{Math.round(savedShare * 100)}</span> (entre aportes e sobra).
          </>
        )}
      </p>
    </Card>
  );
}
