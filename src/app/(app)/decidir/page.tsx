import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ShoppingBag, CalendarDays, Gauge, MapPin, PiggyBank, Flag, ShieldCheck, Zap, TrendingUp, Home, Car, Landmark, Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

/**
 * Decidir: o catálogo das perguntas que o app sabe responder com os números da pessoa.
 *
 * Mora no "Mais" de propósito. O principal chega sozinho na aba Foco; aqui é pra quem quer
 * consultar. Cada pergunta leva pra tela que já calcula aquilo — nenhuma resposta é texto
 * solto: é sempre a conta do app, com o "como cheguei nisso" do lado.
 */
export default async function DecidirPage() {
  // Decidir é da pessoa (regra dos 90% da renda, pequenos gastos): a empresa não vê no menu.
  if (ehEmpresa((await getRequiredSession()).profileKind)) redirect("/mensal/foco");
  const dia = [
    { href: "/decidir/comprar", icon: ShoppingBag, t: "Posso comprar isso?", destaque: true },
    // Cada pergunta abre a RESPOSTA, com os números dela, e não a tela que ela mesma preencheu.
    { href: "/decidir/pergunta/semana", icon: CalendarDays, t: "Quanto posso gastar essa semana?" },
    { href: "/decidir/pergunta/gastando", icon: Gauge, t: "Estou gastando demais?" },
    { href: "/decidir/pergunta/exagerando", icon: MapPin, t: "Onde estou exagerando?" },
    { href: "/decidir/pergunta/guardar", icon: PiggyBank, t: "Quanto preciso guardar?" },
    { href: "/decidir/pergunta/meta", icon: Flag, t: "Quando atinjo minha meta?" },
    { href: "/decidir/pergunta/reserva", icon: ShieldCheck, t: "Minha reserva está suficiente?" },
    { href: "/decidir/pergunta/acabou", icon: Zap, t: "Por que meu dinheiro acabou mais rápido?" },
    { href: "/decidir/pergunta/melhorei", icon: TrendingUp, t: "Melhorei em relação ao mês passado?" },
  ];
  const grandes = [
    { href: "/simuladores/financiar-vs-alugar", icon: Home, t: "Financiar ou alugar?" },
    { href: "/simuladores/amortizar-vs-investir", icon: Landmark, t: "Amortizar ou investir?" },
    { href: "/simuladores/consorcio", icon: Scale, t: "Consórcio ou financiamento?" },
    { href: "/simuladores/carro", icon: Car, t: "Carro: assinar ou comprar?" },
    { href: "/simuladores/marcacao-mercado", icon: TrendingUp, t: "Marcação a mercado" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Decidir" subtitle="As perguntas que o app responde com os seus números. Toda resposta mostra a conta." />

      <section className="flex flex-col gap-3">
        <h2 className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">No dia a dia</h2>
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
        <h2 className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">Decisões grandes</h2>
        <Card className="flex flex-col divide-y divide-border py-1">
          {grandes.map((q) => (
            <Link key={q.href} href={q.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover">
              <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-muted">
                <q.icon size={18} strokeWidth={1.8} />
              </span>
              <span className="text-sm font-medium text-ink">{q.t}</span>
              <ChevronRight size={16} className="ml-auto text-ink-faint" />
            </Link>
          ))}
        </Card>
      </section>
    </div>
  );
}
