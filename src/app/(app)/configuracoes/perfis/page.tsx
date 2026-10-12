import Link from "next/link";
import { Briefcase, Heart, User } from "lucide-react";
import { cobrancaDosAdicionaisLigada } from "@/lib/casal-login/adicional";
import { getRequiredSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { lugaresDosPerfis } from "@/lib/perfis/lugares";
import { extrasLiberados } from "@/lib/perfis/extras-liberados";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/money";
import { ProfileIcon } from "@/components/profiles/ProfileIcon";
import { NovoPerfilNoLugar } from "@/components/profiles/NovoPerfilNoLugar";
import { Cabecalho } from "../_ajustes/Lista";

// O extra é cobrado em real (Hubla), qualquer que seja a moeda do app.
const preco = (v: number) => formatMoney(v, DEFAULT_CURRENCY, { round: true });

export const metadata = { title: "Perfis · SPI Finance" };

const NOME_DO_TIPO: Record<string, string> = { PESSOAL: "Pessoal", CASAL: "Casal", EMPRESA: "Empresa", CASA: "Casa", PROJETO: "Projeto", OUTRO: "Outro" };

/**
 * Perfis (11/10/2026, uma tela só): a lista dos perfis dela, cada um abrindo o detalhe (nome,
 * tema, usar e apagar no fim). Embaixo, "Novo perfil" com os 3 lugares fixos (Pessoal, Nós dois
 * e Empresa) que ainda estão vazios; quem já tem mais perfis mantém todos. Trocar de perfil no
 * dia a dia é pela foto, no topo.
 */
export default async function PerfisPage() {
  const ctx = await getRequiredSession();
  const [perfis, liberados] = await Promise.all([listProfiles(ctx.userId), extrasLiberados(ctx.userId)]);
  const { lugares } = lugaresDosPerfis(perfis, liberados);
  const cobrancaLigada = cobrancaDosAdicionaisLigada();
  const vazios = lugares.filter((l) => !l.perfil);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Perfis" sub="Até 3 perfis: Pessoal, Nós dois e Empresa. Cada um é um dinheiro separado." />
      <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
        {perfis.map((p) => (
          <li key={p.id}>
            <Link href={`/configuracoes/perfis/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-surface-hover">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted" aria-hidden>
                {p.kind === "CASAL" ? <Heart size={18} strokeWidth={1.75} /> : p.kind === "EMPRESA" ? <Briefcase size={18} strokeWidth={1.75} /> : p.kind === "PESSOAL" ? <User size={18} strokeWidth={1.75} /> : <ProfileIcon name={p.icon} size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-[16px] leading-snug text-ink">{p.name}</span>
                <span className={`block text-[13px] ${p.id === ctx.profileId ? "text-accent-strong" : "text-ink-muted"}`}>
                  {NOME_DO_TIPO[p.kind] ?? "Perfil"}
                  {p.id === ctx.profileId ? " · em uso" : ""}
                </span>
              </span>
              {/* Nós dois: o convite do par à direita (protótipo); as outras linhas sem seta. */}
              {p.kind === "CASAL" && <span className="shrink-0 rounded-full bg-surface-2 px-3 py-1 text-sm text-ink">Convidar</span>}
            </Link>
          </li>
        ))}
      </ul>

      {vazios.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-medium uppercase tracking-wide text-ink-muted">Novo perfil</h2>
          <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface">
            {vazios.map((l) =>
              l.liberado ? (
                <NovoPerfilNoLugar key={l.tipo} kind={l.tipo} nome={l.rotulo} rotulo={`Criar ${l.rotulo}`} />
              ) : cobrancaLigada && l.adicional ? (
                <Link key={l.tipo} href={`/adicionais/${l.adicional}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-[15px] text-ink hover:bg-surface-hover">
                  <span>{l.rotulo}</span>
                  <span className="text-sm text-accent-strong">Liberar por {preco(l.preco ?? 0)} por ano</span>
                </Link>
              ) : null,
            )}
          </div>
        </section>
      )}
    </div>
  );
}
