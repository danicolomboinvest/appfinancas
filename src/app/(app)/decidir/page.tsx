import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ShoppingBag, CalendarDays, Gauge, MapPin, PiggyBank, Flag, ShieldCheck, Zap, TrendingUp, Home, Car, Landmark, Scale, Scissors, Clock, Bookmark } from "lucide-react";
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
  // "Vale a pena comprar?" existia, mas nenhuma tela levava até ele (só a lista de /simuladores,
  // que também não tinha porta de entrada).
  const grandes: { href: string; icon: typeof Home; t: string; sub?: string }[] = [
    { href: "/simuladores/vale-a-pena", icon: Clock, t: p.valeAPena, sub: tx.decValeAPenaSub },
    { href: "/simuladores/financiar-vs-alugar", icon: Home, t: p.financiar },
    { href: "/simuladores/amortizar-vs-investir", icon: Landmark, t: p.amortizar },
    { href: "/simuladores/consorcio", icon: Scale, t: p.consorcio },
    { href: "/simuladores/carro", icon: Car, t: p.carro },
    { href: "/simuladores/marcacao-mercado", icon: TrendingUp, t: p.marcacao },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={tx.decTitulo} subtitle={tx.decSub} />

      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{tx.decDiaADia}</h2>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{tx.decGrandes}</h2>
        <Card className="flex flex-col divide-y divide-border py-1">
          {grandes.map((q) => (
            <Link key={q.href} href={q.href} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-muted">
                <q.icon size={18} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{q.t}</span>
                {q.sub && <span className="block text-caption text-ink-muted">{q.sub}</span>}
              </span>
              <ChevronRight size={16} className="ml-auto shrink-0 text-ink-faint" />
            </Link>
          ))}
        </Card>
        {/* As simulações que ela salvou moram em /simuladores, que nenhuma tela abria — e o
            aviso ao salvar diz que "ela fica na lista de simuladores". */}
        <Link
          href="/simuladores"
          className="flex min-h-11 w-fit items-center gap-2 px-1 text-sm font-semibold text-accent-strong hover:underline"
        >
          <Bookmark size={16} strokeWidth={1.9} aria-hidden />
          {salvas > 0 ? tx.decSimulacoesSalvas(salvas) : tx.decVerCalculadoras}
        </Link>
      </section>
    </div>
  );
}
