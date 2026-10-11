import Link from "next/link";
import { Briefcase, Check, Heart, User, Users } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { lugaresDosPerfis } from "@/lib/perfis/lugares";
import { extrasLiberados } from "@/lib/perfis/extras-liberados";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";
import { Cabecalho } from "../_ajustes/Lista";
import { UsarPerfil } from "../_ajustes/Interativos";

// O extra é cobrado em real (Hubla), qualquer que seja a moeda do app (como no branch de cobrança).
const preco = (v: number) => formatMoney(v, DEFAULT_CURRENCY, { round: true });

export const metadata = { title: "Perfis financeiros · SPI Finance" };

const ICONE = { PESSOAL: User, CASAL: Heart, EMPRESA: Briefcase } as const;
const TIPO = { PESSOAL: "Pessoal", CASAL: "Casal", EMPRESA: "Empresa" } as const;
const NOME_DO_TIPO: Record<string, string> = { PESSOAL: "Pessoal", CASAL: "Casal", EMPRESA: "Empresa", CASA: "Casa", PROJETO: "Projeto", OUTRO: "Outro" };

/**
 * Perfis com 3 lugares fixos (rodadas 71, 73 e 74): Pessoal, Nós dois (+ R$ 27 por ano) e Empresa
 * (+ R$ 37 por ano). O extra que ela ainda não tem vira o cartão "Liberar por R$ X por ano", que
 * leva para a compra em /adicionais/<qual>. Quem já tem mais perfis mantém todos.
 */
export default async function PerfisPage() {
  const ctx = await getRequiredSession();
  const [perfis, liberados] = await Promise.all([listProfiles(ctx.userId), extrasLiberados(ctx.userId)]);
  const { lugares, mantidos } = lugaresDosPerfis(perfis, liberados);
  const emUso = (id: string) => id === ctx.profileId;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Perfis financeiros" sub="Você, o casal ou a empresa." />
      <p className="text-sm text-ink">Cada perfil é um dinheiro separado: lançamentos, metas e carteira não se misturam entre eles. São até 3: Pessoal, Nós dois e Empresa.</p>
      <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-4">
        {lugares.map((l) => {
          const Icone = ICONE[l.tipo];
          return (
            <li key={l.tipo} className="flex flex-col gap-2 py-3.5">
              <div className="flex items-center gap-3">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${l.liberado ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-ink-muted"}`} aria-hidden>
                  <Icone size={19} strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] text-ink">{l.perfil?.name ?? l.rotulo}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {TIPO[l.tipo]}
                    {l.preco ? ` · + ${preco(l.preco)} por ano` : ""}
                    {l.perfil && emUso(l.perfil.id) ? " · em uso agora" : ""}
                  </span>
                </span>
                {l.perfil && !emUso(l.perfil.id) && <UsarPerfil id={l.perfil.id} />}
                {!l.perfil && l.liberado && (
                  <Link href="/perfis" className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-surface-2 px-4 text-sm font-medium text-ink">
                    Criar
                  </Link>
                )}
              </div>
              {l.preco && l.liberado && l.perfil && (
                <span className="ml-14 inline-flex w-fit items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] text-ink">
                  <Check size={13} aria-hidden /> Já liberado
                </span>
              )}
              {!l.liberado && l.adicional && (
                <Link href={`/adicionais/${l.adicional}`} className="ml-14 inline-flex min-h-11 items-center justify-center rounded-full bg-accent-gradient px-4 text-sm font-medium text-on-accent">
                  Liberar por {preco(l.preco ?? 0)} por ano
                </Link>
              )}
              {l.tipo === "CASAL" && l.liberado && <p className="ml-14 text-[13px] text-ink-muted">O seu par entra por convite e não ocupa um perfil seu.</p>}
            </li>
          );
        })}
      </ul>

      {mantidos.length > 0 && (
        <section className="flex flex-col gap-2">
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-4">
            {mantidos.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted" aria-hidden>
                  <Users size={19} strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] text-ink">{p.name}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {NOME_DO_TIPO[p.kind] ?? "Perfil"}
                    {emUso(p.id) ? " · em uso agora" : ""}
                  </span>
                </span>
                {!emUso(p.id) && <UsarPerfil id={p.id} />}
              </li>
            ))}
          </ul>
          <p className="px-1 text-[13px] text-ink-muted">Você mantém os perfis que já tinha.</p>
        </section>
      )}

      <Link href="/perfis" className="mx-auto min-h-11 py-2 text-sm text-ink underline underline-offset-2">
        Nome e tema de cada perfil
      </Link>
    </div>
  );
}
