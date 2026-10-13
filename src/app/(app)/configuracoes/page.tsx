import {
  Archive, BadgeCheck, BookOpen, Briefcase, CircleUser, Download, EyeOff, FileText, Globe, Heart, KeyRound, Landmark, MessageCircle, Palette, Percent, Bell, Repeat, Tags, TriangleAlert, Users, Info, Wallet, HeartHandshake } from "lucide-react";
import { LINK_VER_DE_NOVO, estadoDasNovidades, jaUsava } from "@/lib/novidades/passos";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { preferenciaDeModo, profileTheme } from "@/lib/profiles/themes";
import type { LucideIcon } from "lucide-react";
import { formatPhone } from "@/lib/phone";
import { currencySymbol, toCurrencyCode } from "@/lib/money";
import { serverMoney, valoresOcultos } from "@/lib/money-server";
import { getMonthlyPlan } from "@/lib/repositories/monthly-plan.repo";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
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
  const agoraCfg = nowInBrazil();
  const [user, perfis, ocultos, plano, money] = await Promise.all([getOwnUser(ctx), listProfiles(ctx.userId), valoresOcultos(), getMonthlyPlan(ctx, agoraCfg.getFullYear(), agoraCfg.getMonth() + 1), serverMoney()]);
  const rendaDoPlano = plano && plano.plannedIncome > 0 ? plano.plannedIncome : null;
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
      {/* Protótipo: o título grande e o cartão dourado com a foto (lápis no canto), o nome, o
          e-mail e a pílula do plano lado a lado. */}
      <h1 className="titulo-tema px-1 text-[28px] font-medium leading-tight text-ink">Configurações</h1>
      <HeroiDoTema>
        <div className="flex items-center gap-4">
          <FotoDoPerfil nome={nome} foto={user.avatarUrl} tamanho={64} />
          <div className="flex min-w-0 flex-col">
            <p className="break-words text-[19px] font-medium leading-snug">{user.name || "Sem nome"}</p>
            <p className="max-w-full break-words text-sm text-heroi-suave">{user.email}</p>
            <span className="heroi-veu mt-1.5 w-fit whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium">SPI Finance · anual</span>
          </div>
        </div>
      </HeroiDoTema>

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
        <Linha href="/configuracoes/perfis" icone={i(Users)} cor={COR.conta} rotulo="Perfis" sub={perfis.length === 1 ? "1 perfil" : `${perfis.length} perfis`} />
        {/* Casal simples: nomes, jeito de dividir e a saída da casa. */}
        {ctx.casa && <Linha href="/configuracoes/casa" icone={i(HeartHandshake)} cor={COR.conta} rotulo="Casa" sub={`Você e ${ctx.casa.outro.nome}`} />}
        <Linha href="/esqueci-senha" icone={i(KeyRound)} cor={COR.conta} rotulo="Trocar senha" sub="Por e-mail" />
      </Grupo>

      <Grupo titulo="Seu dinheiro">
        <Linha href="/configuracoes/renda" icone={i(Wallet)} cor={COR.dinheiro} rotulo="Renda e dia do pagamento" sub={[rendaDoPlano ? money(rendaDoPlano, { round: true }) : null, user.diaDoPagamento ? `dia ${user.diaDoPagamento}` : null].filter(Boolean).join(" · ") || "Quanto entra e quando"} />
        <Linha href="/configuracoes/categorias" icone={i(Tags)} cor={COR.dinheiro} rotulo="Categorias" sub="Criar, esconder e o que o app aprendeu" />
        <Linha href="/configuracoes/contas-e-cartoes" icone={i(Landmark)} cor={COR.dinheiro} rotulo="Contas e cartões" sub="Importar extrato e limite do cartão" />
        <Linha href="/configuracoes/taxas" icone={i(Percent)} cor={COR.dinheiro} rotulo="Taxas de referência" sub="CDI, Selic e IPCA" />
        <Linha href="/configuracoes/assessoria" icone={i(Briefcase)} cor={COR.dinheiro} rotulo="Assessoria" sub={user.ofertasDesligadas ? "Ofertas desligadas" : "Abrir conta pela Fatos Capital"} />
        <Linha href="/configuracoes/moeda" icone={i(Wallet)} cor={COR.dinheiro} rotulo="Moeda e dólar" sub={currencySymbol(toCurrencyCode(user.currency))} />
      </Grupo>

      <Grupo titulo="App">
        <Linha href="/configuracoes/aparencia" icone={i(Palette)} cor={COR.app} rotulo="Aparência" sub={`${tema.label} · ${modo}`} />
        <Linha href="/configuracoes/voz" icone={i(Heart)} cor={COR.app} rotulo="Voz do app" sub={tema.nomeDaVoz ?? tema.label} />
        <Linha href="/configuracoes/notificacoes" icone={i(Bell)} cor={COR.app} rotulo="Notificações" sub="O que o app te avisa" />
        <Linha href="/configuracoes/privacidade" icone={i(EyeOff)} cor={COR.app} rotulo="Privacidade" sub={ocultos ? "Valores escondidos" : "Valores à mostra"} />
        <Linha href="/configuracoes/idioma" icone={i(Globe)} cor={COR.app} rotulo="Idioma" sub="Português (Brasil)" />
      </Grupo>

      <Grupo titulo="Dados">
        <Linha href="/configuracoes/dados" icone={i(Download)} cor={COR.dados} rotulo="Exportar" sub="Lançamentos e carteira em CSV" />
        <Linha href="/configuracoes/backup" icone={i(Archive)} cor={COR.dados} rotulo="Backup" sub="Automático, todo dia" />
        <Linha href="/configuracoes/apagar" icone={i(TriangleAlert)} cor="var(--color-danger)" rotulo="Apagar dados ou conta" sub="Com confirmação" />
      </Grupo>

      <Grupo titulo="Ajuda">
        <Linha href="/configuracoes/ajuda" icone={i(BookOpen)} cor={COR.ajuda} rotulo="Central de ajuda" sub="Perguntas frequentes" />
        {/* O começo de novo (protótipo): as boas-vindas para quem é nova, o "o que mudou" para quem já usava. */}
        <Linha href={LINK_VER_DE_NOVO} icone={i(Repeat)} cor={COR.ajuda} rotulo={jaUsava(estadoDasNovidades(user.novidadesVersaoNova)) ? "Ver de novo o que mudou" : "Ver o começo de novo"} sub="Boas-vindas" />
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
