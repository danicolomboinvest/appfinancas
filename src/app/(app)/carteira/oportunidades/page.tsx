import { redirect } from "next/navigation";
import { Building2, Globe, Lock, ShieldCheck, TrendingUp, type LucideIcon } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { estadoDaAssessoria } from "@/lib/assessoria/estado";
import { ConviteDaAssessoria } from "../ConviteDaAssessoria";

/**
 * Oportunidades (rodadas 51 e 68): a aba existe, mas o conteúdo do mês ainda não foi publicado,
 * então fica "em breve" para todo mundo. Debaixo do vidro só formas: o servidor não manda nenhum
 * nome, código ou número de oportunidade (o filtro é aqui, não no CSS).
 */
const CATEGORIAS: [string, LucideIcon, string][] = [
  ["Ações do mês", TrendingUp, "var(--color-strat-acoes)"],
  ["Fundos imobiliários", Building2, "var(--color-strat-fiis)"],
  ["Renda fixa", ShieldCheck, "var(--color-strat-pos)"],
  ["Exterior", Globe, "var(--color-strat-exterior)"],
];

export default async function OportunidadesPage() {
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/carteira");
  const user = await getOwnUser(ctx);
  const estado = estadoDaAssessoria(user.assessoriaEstado);

  return (
    <div className="flex flex-col gap-5">
      <div className="px-1">
        <h1 className="titulo-tema text-[28px] font-light leading-tight text-ink">Oportunidades</h1>
        <p className="mt-1 text-[15px] text-ink-muted">Novas todo mês, para quem abriu conta pela Fatos Capital.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5" aria-hidden>
        {CATEGORIAS.map(([nome, Icone, cor]) => (
          <div key={nome} className="glass flex flex-col gap-3 rounded-3xl p-3.5">
            <span className="flex min-h-9 items-center gap-2 text-[14px] font-medium leading-tight text-ink">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2" style={{ color: cor }}>
                <Icone size={15} strokeWidth={1.8} />
              </span>
              {nome}
            </span>
            <span
              className="relative flex h-20 items-center justify-center overflow-hidden rounded-2xl"
              style={{ background: `radial-gradient(60% 70% at 30% 40%, color-mix(in srgb, ${cor} 32%, transparent), transparent), radial-gradient(50% 60% at 75% 70%, color-mix(in srgb, ${cor} 22%, transparent), transparent), var(--color-surface-2)` }}
            >
              <span className="absolute inset-0 backdrop-blur-md" />
              <span className="relative flex size-9 items-center justify-center rounded-full bg-surface text-ink shadow-sm">
                <Lock size={15} />
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="glass rounded-3xl px-5 py-4 text-center">
        <p className="text-[16px] font-medium text-ink">As oportunidades do mês chegam em breve</p>
        <p className="mt-1 text-[14px] text-ink-muted">Elas aparecem aqui, na sua Carteira.</p>
      </div>

      {estado !== "cliente" && <ConviteDaAssessoria estado={estado} podeOcultar={false} />}
    </div>
  );
}
