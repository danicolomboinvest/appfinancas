import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { redirect } from "next/navigation";
import { vozDoTema } from "@/lib/profiles/voice";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { getYearlySummary } from "@/lib/consolidation/yearly";
import { listarDecisoesDesde } from "@/lib/repositories/decisao.repo";
import { somarConquistas } from "@/lib/decisoes/conquistas";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * "Seu ano com o SPI": o resumo em formato de story, pra pessoa ver (e mostrar) o que fez.
 * No app de verdade chega uns 30 dias antes da renovação; aqui fica sempre acessível.
 */
export default async function SeuAnoPage() {
  const ctx = await getRequiredSession();
  // "Compras que você desistiu", "pequenos gastos cortados": é o ano da pessoa, não da empresa.
  if (ehEmpresa(ctx.profileKind)) redirect("/dashboard");
  const t = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  const money = await serverMoney();
  const m = (v: number) => money(v, { round: true });
  const now = nowInBrazil();
  const inicio = new Date(now.getFullYear(), 0, 1);
  const [decisoes, ano] = await Promise.all([listarDecisoesDesde(ctx, inicio), getYearlySummary(ctx, now.getFullYear())]);
  const c = somarConquistas(decisoes.map((d) => ({ tipo: d.tipo, valor: d.valor === null ? null : Number(d.valor), createdAt: d.createdAt })));
  const desde = c.desde ? MESES[c.desde.getMonth()] : null;

  const linhas: [string, string][] = [
    ["Guardado no ano", m(ano.totalInvestment)],
    ["Compras que você desistiu", m(c.desistidas)],
    ["Pequenos gastos cortados (por ano)", m(c.raioxAnual)],
    ["Rituais da semana feitos", String(c.rituais)],
    ["Meses fechados", String(c.fechamentos)],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/dashboard" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> {t.visaoGeral}
      </Link>
      <div
        className="flex min-h-[70vh] flex-col gap-4 rounded-3xl p-7 text-on-accent shadow-premium"
        style={{ background: "linear-gradient(160deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 72%, #000))" }}
      >
        <p className="text-caption font-bold opacity-80">Seu ano com o SPI, {now.getFullYear()}</p>
        <p className="text-[2rem] font-bold leading-tight tracking-tight">
          {c.decisoes > 0
            ? `${desde ? `Desde ${desde}, v` : "V"}ocê decidiu pelo seu futuro ${c.decisoes} ${c.decisoes > 1 ? "vezes" : "vez"}.`
            : "Seu ano começa na primeira decisão."}
        </p>
        <dl className="mt-2 flex flex-col">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-t border-current/20 py-3 text-[15px]">
              <dt>{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-auto text-caption opacity-80">{t.conqNota}</p>
      </div>
    </div>
  );
}
