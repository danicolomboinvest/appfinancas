import Link from "next/link";
import {
  Archive, BadgeCheck, BookOpen, Briefcase, CircleUser, Download, EyeOff, FileText, Globe, Heart, KeyRound, Landmark, MessageCircle, Palette, Pencil, Percent, Bell, Tags, TriangleAlert, Users, Info, Wallet,
} from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { preferenciaDeModo, profileTheme } from "@/lib/profiles/themes";
import type { LucideIcon } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { currencySymbol, toCurrencyCode } from "@/lib/money";
import { valoresOcultos } from "@/lib/money-server";
import { SUPORTE_EMAIL } from "./_ajustes/suporte";
import { Grupo, Icone, Linha } from "./_ajustes/Lista";
import { CancelarAssinatura } from "./_ajustes/CancelarAssinatura";
import { dadosDoCancelar } from "@/lib/cancelar/dados";
import { compraDoApp } from "@/lib/assinatura/compra";
import { dataLonga, renovacaoEm } from "@/lib/assinatura/renovacao";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { FotoDoPerfil } from "./_ajustes/FotoDoPerfil";
import { SairDaConta } from "./_ajustes/SairDaConta";

export const metadata = { title: "Configurações · SPI Finance" };

// A cor de cada grupo (rodada 35: ícones com fundo tingido por grupo, como os Ajustes do iPhone).
// Vem da paleta de categorias do tema, então cada um dos 4 temas pinta do seu jeito.
const COR = {
  conta: "var(--color-cat-saude)",
  dinheiro: "var(--color-cat-moradia)",
  app: "var(--color-cat-lazer)",
  dados: "var(--color-cat-transporte)",
  ajuda: "var(--color-cat-educacao)",
};

const MODO = { light: "claro", dark: "escuro", auto: "automático" } as const;

/**
 * Configurações completas (versão nova, rodadas 25, 35, 62, 65, 71 e 74): o cartão da conta com a
 * foto, e as listas Conta, Seu dinheiro, App, Dados e Ajuda, cada linha com o estado de agora.
 */
export default async function ConfiguracoesPage() {
  const ctx = await getRequiredSession();
  const [user, perfis, ocultos] = await Promise.all([getOwnUser(ctx), listProfiles(ctx.userId), valoresOcultos()]);
  // Renovação: sempre 1 ano depois da compra. Sem data de compra (liberação manual), sem linha.
  const compra = await compraDoApp(ctx.userId, user.email);
  const renova = compra ? dataLonga(renovacaoEm(compra.em, nowInBrazil())) : null;
  const cancelar = compra ? await dadosDoCancelar(ctx, compra) : null;
  const nome = user.name?.trim() || user.email;
  const tema = profileTheme(ctx.profileTheme);
  const modo = MODO[preferenciaDeModo(user.theme)];
  const i = (C: LucideIcon) => <C size={17} strokeWidth={1.8} />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-4">
        <FotoDoPerfil nome={nome} foto={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-[19px] font-medium leading-snug text-ink">{user.name || "Sem nome"}</p>
          <p className="break-all text-sm text-ink-muted">{user.email}</p>
          <span className="mt-1.5 inline-block whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] font-medium text-accent-strong">SPI Finance · anual</span>
        </div>
        <Link href="/configuracoes/perfil" aria-label="Editar meus dados" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-ink">
          <Pencil size={17} aria-hidden />
        </Link>
      </section>

      <Grupo titulo="Conta">
        <Linha href="/configuracoes/perfil" icone={i(CircleUser)} cor={COR.conta} rotulo="Meus dados" sub={[user.name, user.phone ? formatPhone(user.phone) : null].filter(Boolean).join(" · ") || "Nome, e-mail e celular"} />
        {renova && (
          <div className="flex min-h-[60px] items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
            <Icone cor={COR.conta}>{i(BadgeCheck)}</Icone>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] leading-snug text-ink">Assinatura</span>
              <span className="block text-[13px] text-ink-muted">Anual · renova em {renova}</span>
            </span>
          </div>
        )}
        <Linha href="/configuracoes/perfis" icone={i(Users)} cor={COR.conta} rotulo="Perfis financeiros" sub={perfis.map((p) => p.name).join(", ")} />
        <Linha href="/esqueci-senha" icone={i(KeyRound)} cor={COR.conta} rotulo="Trocar senha" sub="Por e-mail" />
      </Grupo>

      <Grupo titulo="Seu dinheiro">
        <Linha href="/configuracoes/categorias" icone={i(Tags)} cor={COR.dinheiro} rotulo="Categorias" sub="Criar, esconder e o que o app aprendeu" />
        <Linha href="/configuracoes/contas-e-cartoes" icone={i(Landmark)} cor={COR.dinheiro} rotulo="Contas e cartões" sub="Importar extrato e limite do cartão" />
        <Linha href="/configuracoes/taxas" icone={i(Percent)} cor={COR.dinheiro} rotulo="Taxas de referência" sub="CDI, Selic e IPCA" />
        <Linha href="/configuracoes/moeda" icone={i(Wallet)} cor={COR.dinheiro} rotulo="Moeda e dólar" sub={currencySymbol(toCurrencyCode(user.currency))} />
      </Grupo>

      <Grupo titulo="App">
        <Linha href="/configuracoes/aparencia" icone={i(Palette)} cor={COR.app} rotulo="Aparência" sub={`${tema.label} · ${modo}`} />
        <Linha href="/configuracoes/voz" icone={i(Heart)} cor={COR.app} rotulo="Voz do app" sub={tema.nomeDaVoz ?? tema.label} />
        <Linha href="/configuracoes/notificacoes" icone={i(Bell)} cor={COR.app} rotulo="Notificações" sub="O que o app te avisa" />
        <Linha href="/configuracoes/assessoria" icone={i(Briefcase)} cor={COR.app} rotulo="Assessoria" sub={user.ofertasDesligadas ? "Ofertas desligadas" : "Abrir conta pela Fatos Capital"} />
        <Linha href="/configuracoes/privacidade" icone={i(EyeOff)} cor={COR.app} rotulo="Privacidade" sub={ocultos ? "Valores escondidos" : "Valores à mostra"} />
        <Linha href="/configuracoes/idioma" icone={i(Globe)} cor={COR.app} rotulo="Idioma" sub="Português (Brasil)" />
      </Grupo>

      <Grupo titulo="Dados">
        <Linha href="/configuracoes/dados" icone={i(Download)} cor={COR.dados} rotulo="Exportar" sub="Lançamentos e carteira em CSV" />
        <Linha href="/configuracoes/backup" icone={i(Archive)} cor={COR.dados} rotulo="Backup" sub="Automático, todo dia" />
        <Linha href="/configuracoes/dados#excluir" icone={i(TriangleAlert)} cor="var(--color-danger)" rotulo="Apagar minha conta" sub="Não tem volta" />
      </Grupo>

      <Grupo titulo="Ajuda">
        <Linha href="/configuracoes/ajuda" icone={i(BookOpen)} cor={COR.ajuda} rotulo="Central de ajuda" sub="Perguntas frequentes" />
        <Linha href="/configuracoes/suporte" icone={i(MessageCircle)} cor={COR.ajuda} rotulo="Falar com o suporte" sub={SUPORTE_EMAIL} />
        <Linha href="/termos" icone={i(FileText)} cor={COR.ajuda} rotulo="Termos e privacidade" />
        <Linha href="/configuracoes/sobre" icone={i(Info)} cor={COR.ajuda} rotulo="Sobre" sub="Versão 0.1.0" />
      </Grupo>

      <Grupo>
        <SairDaConta />
      </Grupo>
      {cancelar && <CancelarAssinatura dados={cancelar} />}
    </div>
  );
}
