import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, CalendarDays, Gauge, MapPin, PiggyBank, Flag, ShieldCheck, Zap, TrendingUp, Scissors, Bookmark } from "lucide-react";
import { GradeDeCalculadoras } from "@/components/calculadoras/GradeDeCalculadoras";
import { calculadoras } from "@/lib/calculadoras";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/db/prisma";

/**
 * Decidir: o catálogo das perguntas que o app sabe responder com os números da pessoa.
 *
 * Mora no "Mais" de propósito. O principal chega sozinho na aba Foco; aqui é pra quem quer
 * consultar. Cada pergunta leva pra tela que já calcula aquilo — nenhuma resposta é texto
 * solto: é sempre a conta do app, com o "como cheguei nisso" do lado.
 *
 * As perguntas vêm da voz do tema (`decPerguntas`): no Girly é "Quando chego no meu sonho?",
 * e as decisões grandes perderam o nome de mercado ("Marcação a mercado", "Amortizar").
 */
export default async function DecidirPage() {
  // Decidir é da pessoa (regra dos 90% da renda, pequenos gastos): a empresa não vê no menu.
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const tx = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const p = tx.decPerguntas;
  // Só a contagem: o link das simulações salvas aparece quando existe alguma pra abrir.
  const salvas = await prisma.simulation.count({ where: { userId: ctx.userId, profileId: ctx.profileId } });
  const dia = [
    { href: "/decidir/comprar", icon: ShoppingBag, t: p.comprar, destaque: true },
    // Cada pergunta abre a RESPOSTA, com os números dela, e não a tela que ela mesma preencheu.
    { href: "/decidir/pergunta/semana", icon: CalendarDays, t: p.semana },
    { href: "/decidir/pergunta/gastando", icon: Gauge, t: p.gastando },
    { href: "/decidir/pergunta/exagerando", icon: MapPin, t: p.exagerando },
    { href: "/decidir/pergunta/guardar", icon: PiggyBank, t: p.guardar },
    { href: "/decidir/pergunta/meta", icon: Flag, t: p.meta },
    { href: "/decidir/pergunta/reserva", icon: ShieldCheck, t: p.reserva },
    { href: "/decidir/pergunta/acabou", icon: Zap, t: p.acabou },
    { href: "/decidir/pergunta/melhorei", icon: TrendingUp, t: p.melhorei },
    // O Raio-X só abria por um cartão do Foco; aqui é o lugar de quem vem procurar.
    { href: "/decidir/raio-x", icon: Scissors, t: p.raiox },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Sem subtítulo fixo (06/10/2026): as perguntas já dizem o que fazem. */}
      <PageHeader title={tx.decTitulo} />

      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold text-ink-muted">{tx.decDiaADia}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {dia.map((q) => (
            <Link key={q.t} href={q.href} className={q.destaque ? "col-span-2 lg:col-span-1" : ""}>
              <Card className="flex h-full min-h-24 flex-col justify-between gap-3 p-4 transition-colors hover:bg-surface-hover">
                <span className={`flex size-9 items-center justify-center rounded-xl ${q.destaque ? "bg-pill text-on-pill" : "bg-accent-soft text-accent-strong"}`}>
                  <q.icon size={18} strokeWidth={1.8} />
                </span>
                <span className="text-sm font-semibold leading-snug text-ink">{q.t}</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* As calculadoras, em cartões coloridos, como na tela delas (06/10/2026). Antes eram uma
          lista cinza de "Decisões grandes" e um link no fim, que ninguém achava. */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-caption font-semibold text-ink-muted">{tx.calcTitulo}</h2>
          {salvas > 0 && (
            <Link href="/simuladores" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-strong hover:underline">
              <Bookmark size={15} strokeWidth={1.9} aria-hidden />
              {tx.decSimulacoesSalvas(salvas)}
            </Link>
          )}
        </div>
        <GradeDeCalculadoras itens={calculadoras(tx)} />
      </section>
    </div>
  );
}
