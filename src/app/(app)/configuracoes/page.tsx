import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Building2, ChevronRight, Download, FileText, KeyRound, LifeBuoy, Palette, Percent, Tags, Wallet } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { vozDoTema } from "@/lib/profiles/voice";
import { profileTheme, temaDeixaEscolherModo } from "@/lib/profiles/themes";
import { isPluggyConfigured } from "@/lib/pluggy/client";
import { formatPhone } from "@/lib/phone";
import { currencySymbol } from "@/lib/money";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { EditarNoCanto } from "@/components/ui/EditarNoCanto";
import { ProfileForm } from "./perfil/ProfileForm";
import { AjustesRapidos } from "./_ajustes/AjustesRapidos";
import { SairDaConta } from "./_ajustes/SairDaConta";

export const metadata = { title: "Configurações · SPI Finance" };

/** Uma linha da lista: ícone num quadradinho colorido, o nome, o valor de agora e a setinha. */
function Linha({ href, icone, cor, rotulo, valor, externo }: { href: string; icone: ReactNode; cor: string; rotulo: string; valor?: string; externo?: boolean }) {
  return (
    <Link
      href={href}
      {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-2 transition-colors first:border-t-0 hover:bg-surface-hover"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${cor} 16%, transparent)`, color: cor }} aria-hidden>
        {icone}
      </span>
      <span className="shrink-0 whitespace-nowrap text-[15px] font-medium text-ink">{rotulo}</span>
      <span className="min-w-0 flex-1 truncate text-right text-sm text-ink-muted">{valor}</span>
      <ChevronRight size={18} className="shrink-0 text-ink-faint" aria-hidden />
    </Link>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-ink-muted">{titulo}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">{children}</div>
    </section>
  );
}

/**
 * Configurações numa tela só (07/10/2026), no jeito das configurações do celular: quem está logada
 * no topo, o modo e a moeda trocando num toque, e o resto em listas com ícone. A Dani achou a tela
 * antiga feia e a moeda "muito longe": eram sete abas (Perfil, Preferências, Categorias…), cada uma
 * com um formulário e um Salvar.
 */
export default async function ConfiguracoesPage() {
  const ctx = await getRequiredSession();
  const [user, perfis] = await Promise.all([getOwnUser(ctx), listProfiles(ctx.userId)]);
  const { titulos: t } = vozDoTema(ctx.profileTheme, ctx.profileKind);
  const nome = user.name?.trim() || user.email;
  const inicial = nome.charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-h1 font-bold tracking-tight text-ink">Configurações</h1>

      <HeroiDoTema>
        <div className="flex items-center gap-4">
          <span className="heroi-veu-forte flex size-14 shrink-0 items-center justify-center rounded-full text-2xl font-bold" aria-hidden>
            {inicial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold tracking-tight">{user.name || "Sem nome"}</p>
            <p className="truncate text-sm text-heroi-suave">{user.email}</p>
            {user.phone && <p className="truncate text-sm text-heroi-suave">{formatPhone(user.phone)}</p>}
          </div>
          <EditarNoCanto titulo={t.cfgPerfilTitulo}>
            <ProfileForm defaults={{ name: user.name, email: user.email, phone: formatPhone(user.phone) }} semMoldura />
          </EditarNoCanto>
        </div>
      </HeroiDoTema>

      <Grupo titulo="Aparência">
        <AjustesRapidos
          moeda={user.currency}
          modo={user.theme}
          podeEscolherModo={temaDeixaEscolherModo(ctx.profileTheme)}
          rotulos={{ modo: "Modo", claro: t.cfgTemaClaro, escuro: t.cfgTemaEscuro, moeda: t.cfgMoeda, moedaAviso: `${t.cfgMoedaAvisoTexto1(`${currencySymbol("EUR")} 3.000`, `${currencySymbol("BRL")} 3.000`)} ${t.cfgMoedaAvisoTexto2}` }}
        />
        <Linha href="/perfis" icone={<Palette size={16} />} cor="var(--color-accent)" rotulo="Estilo do app" valor={profileTheme(ctx.profileTheme).label} />
      </Grupo>

      <Grupo titulo="Seu dinheiro">
        <Linha href="/perfis" icone={<Wallet size={16} />} cor="var(--color-cat-moradia)" rotulo="Perfis financeiros" valor={perfis.map((p) => p.name).join(", ")} />
        <Linha href="/configuracoes/categorias" icone={<Tags size={16} />} cor="var(--color-cat-alimentacao)" rotulo={t.cfgAbaCategorias} />
        <Linha href="/configuracoes/notificacoes" icone={<Bell size={16} />} cor="var(--color-cat-saude)" rotulo={t.cfgAbaNotificacoes} />
        {isPluggyConfigured() && <Linha href="/configuracoes/conexoes" icone={<Building2 size={16} />} cor="var(--color-cat-transporte)" rotulo="Conectar meu banco" />}
        <Linha href="/configuracoes/taxas" icone={<Percent size={16} />} cor="var(--color-cat-educacao)" rotulo={t.cfgAbaTaxas} />
      </Grupo>

      <Grupo titulo="Conta">
        <Linha href="/esqueci-senha" icone={<KeyRound size={16} />} cor="var(--color-ink-muted)" rotulo="Trocar senha" />
        <Linha href="/configuracoes/dados" icone={<Download size={16} />} cor="var(--color-ink-muted)" rotulo="Exportar ou excluir dados" />
        <Linha href="/suporte" icone={<LifeBuoy size={16} />} cor="var(--color-ink-muted)" rotulo="Suporte" />
        <Linha href="/termos" icone={<FileText size={16} />} cor="var(--color-ink-muted)" rotulo="Termos e privacidade" />
        <div className="border-t border-border">
          <SairDaConta />
        </div>
      </Grupo>
    </div>
  );
}
