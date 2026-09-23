import { Section } from "@/components/ui/Section";
import { Donut, type DonutSlice } from "@/components/charts/Donut";
import { serverMoney } from "@/lib/money-server";
import type { Voz } from "@/lib/profiles/voice";
import { partesDoTexto } from "@/lib/profiles/textos/shell";


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
  voz,
}: {
  income: number;
  expense: number;
  investment: number;
  balance: number;
  /** A voz do tema do perfil, que a página já resolveu: o card não vai ao banco de novo por ela. */
  voz: Voz;
}) {
  const money = await serverMoney();
  if (income <= 0) return null;
  const t = voz.titulos;

  // Saldo negativo (gastou mais do que ganhou) não vira fatia: não existe "sobra de -R$ 300"
  // num gráfico de partes de um todo. Nesse caso o aviso embaixo conta o que aconteceu.
  const leftover = Math.max(0, balance);
  const slices: DonutSlice[] = [
    { name: t.uiRendaFatiaGastos, value: expense, color: "var(--color-danger)" },
    { name: t.uiRendaFatiaAportes, value: investment, color: "var(--color-accent)" },
    { name: t.uiRendaFatiaSobrou, value: leftover, color: "var(--color-success)" },
  ].filter((s) => s.value > 0);

  const savedShare = income > 0 ? (investment + leftover) / income : 0;

  return (
    <Section title={t.uiRendaDividida}>
      {/* O centro carrega a renda do mês, não a soma das fatias: é dela que as partes saíram, e
          ver o total no meio é o que dá sentido a "Gastos 67%". */}
      <Donut
        slices={slices}
        centerLabel={t.uiRendaCentro}
        centerValue={money(income, { round: true })}
        maxSlices={4}
        size={160}
      />
      {/* A frase era "De cada R$ 100 que entraram, você manteve R$ 33". Tirar o "R$" para a
          moeda deixar de ser fixa quebrou o sentido — virou "De cada 100 você manteve 33", que
          não diz de quê. Em percentual a frase não depende de moeda nenhuma. O percentual vem
          marcado com ** na voz e vira o destaque aqui. */}
      <p className="text-caption text-ink-faint">
        {balance < 0
          ? t.uiRendaGastouAMais(money(Math.abs(balance), { round: true }))
          : partesDoTexto(t.uiRendaManteve(`${Math.round(savedShare * 100)}%`)).map((p, i) =>
              p.negrito ? (
                <span key={i} className="font-medium text-ink">
                  {p.texto}
                </span>
              ) : (
                p.texto
              ),
            )}
      </p>
    </Section>
  );
}
