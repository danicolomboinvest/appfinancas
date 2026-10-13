import { Fragment } from "react";
import { temMoneyReset } from "@/lib/repositories/produtoLiberado.repo";
import { perfilTemLimiteDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { isPluggyConfigured } from "@/lib/pluggy/client";
import { AppShell } from "@/components/shell/AppShell";
import { ThemeSync } from "@/components/shell/ThemeSync";
import { getOwnUser, touchLastSeen } from "@/lib/repositories/user.repo";
import { compraComOCelular, contaConfirmada, situacaoDoAcesso, usoDoApp, type UsoDoApp } from "@/lib/repositories/allowedEmail.repo";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { casaDaRequisicao, perfilAtivoDaRequisicao, sessaoDaRequisicao, type AccountContext } from "@/lib/auth/session";
import { casaNaTela, type CasaNaTela } from "@/lib/casa/regras";
import { parDeCasaSimples, saidaRecenteDaCasa } from "@/lib/repositories/casa.repo";
import type { ProfileKind } from "@prisma/client";
import { MoneyProvider } from "@/components/money/MoneyProvider";
import { valoresOcultos } from "@/lib/money-server";
import { toCurrencyCode, type CurrencyCode } from "@/lib/money";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { chaveDoTema, modoEfetivo, preferenciaDeModo, profileTheme as temaDoPerfil, profileThemeCss, temaDeixaEscolherModo } from "@/lib/profiles/themes";
import { periodoDoDia, vozDoTema } from "@/lib/profiles/voice";
import { TelaConfirmeEmail } from "@/components/auth/TelaConfirmeEmail";
import { TelaSemAcesso } from "@/components/auth/TelaSemAcesso";
import { AssinarPelaApple } from "@/components/auth/AssinarPelaApple";
import { naAppDaApple } from "@/lib/apple/app-da-apple";
import { IDS_DOS_PRODUTOS } from "@/lib/apple/config";
import { guardarTokenApple } from "@/lib/repositories/assinaturaApple.repo";
import { linkDoSuporte } from "@/lib/support/whatsapp-link";
import { ASSUNTO_ACESSO, mensagemDeContaSemAcesso } from "@/lib/support/contato";
import { lerPreferenciasDeCategoria, type PreferenciasDeCategoria } from "@/lib/categories";
import { lerConfigCasal } from "@/lib/casal/acerto";
import { perfilDoPar, perfilDoParNaLista, situacaoDoParAgora } from "@/lib/repositories/casal-login.repo";
import { prisma } from "@/lib/db/prisma";
import { coresDoCasalCss } from "@/lib/casal-login/cores";
import { TelaDoParPausado } from "@/components/casal-login/TelaDoParPausado";
import { estadoDasNovidades, type EstadoDasNovidades } from "@/lib/novidades/passos";
import { lerComeco } from "@/lib/onboarding/comeco";
import { ferramentasDoMeiDoPerfil } from "@/lib/repositories/empresa.repo";
import type { FerramentasDoMei } from "@/lib/empresa/legal";


function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await sessaoDaRequisicao();
  // Ancorado no fuso do Brasil, não no do servidor, sem isso a saudação ("Bom dia"/"Boa noite")
  // e o mês do resumo trocariam umas horas antes da hora certa pra quem está no Brasil.
  const now = nowInBrazil();

  // Do token da sessão só como reserva: o nome ali é o do dia do login e nunca atualiza. Quem
  // corrigia o nome em Perfil via "Salvo" e a saudação continuava com o antigo até sair e entrar.
  let firstName = session?.user.name?.split(" ")[0] ?? session?.user.email?.split("@")[0];
  const mesLabel = capitalize(now.toLocaleDateString("pt-BR", { month: "long" }));
  let theme = "dark";
  let profileTheme = "padrao";
  let profileKind: ProfileKind = "PESSOAL";
  let prefsDeCategoria: PreferenciasDeCategoria = {};
  let nomesDoCasal: { A: string; B: string; comPar?: boolean } | null = null;
  // Limite do cartão é opcional (06/10/2026): o "No cartão" do + só aparece para quem montou um.
  let cartaoComLimite = false;
  let currency: CurrencyCode = toCurrencyCode(null);
  let isPremium = false;
  // Money Reset comprado (ou admin): o item no menu ☰ (12/10/2026).
  let comMoneyReset = false;
  let perfis: { id: string; name: string; icon: string; theme: string; isDefault: boolean; kind?: string }[] = [];
  let nomeDaConta: string | null = null;
  let fotoDaConta: string | null = null;
  let novidades: EstadoDasNovidades = "novo";
  let cssDoTema = "";
  // Quem entrou pelo começo novo (versão nova): o tour antigo de balões não aparece para ela.
  let perfilAtivoId = "";
  // Login do par: o menu dele mostra só o Nós dois (e as Configurações dele).
  let modoPar: { nomeTitular: string } | null = null;
  // Casal simples: eu e o par na tela (só no Pessoal que faz parte da casa).
  let casa: CasaNaTela | null = null;
  let tutorialDoCasalVisto = true;
  // Casa que veio do Nós dois: o "O casal ficou mais simples" ainda não visto por esta conta.
  let avisoDaMigracao = false;
  // Empresa: Limite do MEI e Impostos só no menu de quem tem o que ver ali (12/10/2026).
  let ferramentasDoMei: FerramentasDoMei = { limite: false, impostos: false };
  if (session?.user) {
    const ctx: AccountContext = { userId: session.user.id, role: session.user.role };
    // Uma consulta a menos em TODA navegação: o resumo do mês só existia pra alimentar a
    // faixa de saudação, que não mostra mais números.
    // Login do par (11/10/2026): quem é par e está no Nós dois abre direto no Casal da titular,
    // sem perfil próprio. Se ele também comprou o SPI, os perfis dele aparecem junto na troca.
    const doPar = session.user.par === "em-uso" ? await perfilDoPar(ctx.userId) : null;
    modoPar = doPar ? { nomeTitular: doPar.par.nomeTitular } : null;
    const [user, ativo, proprios, casalDoPar, casaDaConta, parSimples] = await Promise.all([
      getOwnUser(ctx),
      doPar ? doPar.perfil : perfilAtivoDaRequisicao(ctx.userId),
      listProfiles(ctx.userId),
      doPar ? doPar.perfil : session.user.par === "fora" ? perfilDoParNaLista(ctx.userId) : null,
      session.user.casa ? casaDaRequisicao(ctx.userId) : null,
      // Casal simples: quem é par usa o app inteiro, no Pessoal dele, sem compra própria.
      session.user.casa && !doPar ? parDeCasaSimples(ctx.userId) : null,
    ]);
    casa = casaDaConta && casaDaConta.eu.profileId === ativo.id ? casaNaTela(casaDaConta) : null;
    tutorialDoCasalVisto = casaDaConta?.tutorialVisto ?? true;
    avisoDaMigracao = Boolean(casaDaConta?.migrada && !casaDaConta.avisoMigracaoVisto);
    const todos = casalDoPar ? [...proprios, casalDoPar] : proprios;
    // O que vem depois não depende uma coisa da outra: sai tudo de uma vez (antes eram quatro
    // idas ao banco em fila, em TODA tela).
    const [acessoDaConta, confirmada, comLimite, comParNoCasal, moneyReset] = await Promise.all([
      doPar || ctx.role === "ADMIN" ? Promise.resolve("ativo" as const) : situacaoDoAcesso(user.email),
      doPar || ctx.role === "ADMIN" ? Promise.resolve(true) : contaConfirmada(user),
      perfilTemLimiteDoCartao(ctx.userId, ativo.id),
      !doPar && ativo.kind === "CASAL" ? prisma.membroCasal.count({ where: { profileId: ativo.id, saiuEm: null } }).then((n) => n > 0) : Promise.resolve(Boolean(doPar)),
      doPar ? Promise.resolve(false) : temMoneyReset(ctx.userId),
    ]);
    comMoneyReset = moneyReset;
    // O par não tem a área de investimentos (nem sabe que existe): fica no "gratis".
    let uso: UsoDoApp = "gratis";
    if (doPar) {
      // O par entra grátis: vale enquanto o Casal da titular valer. Não passa pela compra, pela
      // confirmação do e-mail nem pelo começo (o convite já provou que foi chamado).
      const situacao = await situacaoDoParAgora(doPar.par);
      if (situacao.tipo !== "liberado") return <TelaDoParPausado nomeTitular={doPar.par.nomeTitular} ate={situacao.tipo === "pausado" ? situacao.ate : null} />;
    } else {
      // Só quem comprou usa o app (fim do freemium, 30/09/2026); quem criou conta no tempo do
      // grátis continua com a parte grátis (ver usoDoApp). Vem antes da confirmação do e-mail:
      // quem não tem compra não precisa confirmar nada, precisa saber o que fazer. O e-mail é o da
      // conta no banco, não o do token, que é o do dia do login.
      const acesso = acessoDaConta;
      uso = usoDoApp(acesso, user.createdAt);
      if (parSimples && acesso !== "ativo") {
        // Casal simples (13/10/2026): "pode liberar tudo para o par, porque a pessoa já vai pagar
        // a mais pelo casal". Vale enquanto o Casal da titular valer, com a mesma pausa de 90 dias
        // do login do par. Quem tem compra própria nem passa por aqui.
        const situacao = await situacaoDoParAgora(parSimples);
        if (situacao.tipo !== "liberado") return <TelaDoParPausado nomeTitular={parSimples.nomeTitular} ate={situacao.tipo === "pausado" ? situacao.ate : null} simples />;
        uso = "completo";
      } else if (uso === "bloqueado" && acesso !== "ativo") {
        // Casal simples: quem saiu (ou foi tirado) da casa segue a pausa de hoje: o que é dele
        // fica guardado 90 dias no Pessoal dele, e volta com o SPI próprio ou num convite novo.
        const saida = await saidaRecenteDaCasa(ctx.userId);
        if (saida) return <TelaDoParPausado nomeTitular={saida.nomeTitular} ate={saida.ate} simples saiu={saida.motivo === "saiu" ? "saiu" : "tirado"} />;
        // No app da Apple, quem não tem acesso assina ali mesmo (guideline 3.1.1); a tela do
        // cadeado, que fala de compra feita fora, não pode aparecer lá.
        if (await naAppDaApple()) return <AssinarPelaApple token={await guardarTokenApple(user)} produtosIds={[...IDS_DOS_PRODUTOS]} />;
        const compraDoCelular = acesso === "sem-compra" ? await compraComOCelular(user.phone) : null;
        return <TelaSemAcesso email={user.email} situacao={acesso} compraDoCelular={compraDoCelular} whatsapp={linkDoSuporte(mensagemDeContaSemAcesso(user.email), ASSUNTO_ACESSO)} />;
      }
      // Conta nova só abre depois de confirmar o e-mail: sem isso qualquer um criava a conta com
      // o e-mail de outra pessoa (de uma compradora, inclusive). Vem antes do /comecar, que
      // também manda de volta pra cá quem não confirmou. Admin sempre passa.
      // Exceção: quem assinou pela Apple a partir desta conta. A compra já prova que a conta é
      // dela, e o revisor da Apple, que assina no Sandbox, não abre e-mail de confirmação.
      // O par entrou pelo link do convite (que já provou quem é): não confirma e-mail.
      if (ctx.role !== "ADMIN" && !confirmada && !parSimples) return <TelaConfirmeEmail email={user.email} />;
      // Primeira entrada: antes de ver qualquer tela, a pessoa escolhe o tipo e o tema do
      // perfil dela em /comecar. Uma vez só; quem já usava o app nasceu com a data preenchida.
      if (user.onboardedAt === null) redirect("/comecar");
    }
    // O apelido que ela deu no começo ("Como posso te chamar?") vale na saudação.
    firstName = lerComeco(user.comeco)?.apelido || user.name?.split(" ")[0] || user.email.split("@")[0];
    nomeDaConta = user.name?.trim() || null;
    fotoDaConta = user.avatarUrl;
    // "Tivemos uma mudança": quem já usava vê uma vez; quem chegou com a versão nova, nunca.
    novidades = estadoDasNovidades(user.novidadesVersaoNova);
    currency = toCurrencyCode(user.currency);
    theme = user.theme;
    // Compra valendo e e-mail confirmado: a área de investimentos abre toda. Quem sobrou do
    // grátis vê o cadeado nela, como antes.
    isPremium = uso === "completo";
    perfis = todos.map((p) => ({ id: p.id, name: p.name, icon: p.icon, theme: chaveDoTema(p.theme), isDefault: p.id === ativo.id, kind: p.kind }));
    perfilAtivoId = ativo.id;
    profileTheme = chaveDoTema(ativo.theme);
    profileKind = ativo.kind;
    prefsDeCategoria = lerPreferenciasDeCategoria(ativo.categorias);
    cartaoComLimite = comLimite;
    if (ativo.kind === "EMPRESA" && !doPar) {
      const hoje = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      ferramentasDoMei = await ferramentasDoMeiDoPerfil(ctx.userId, ativo.id, hoje);
    }
    if (ativo.kind === "CASAL") {
      const casal = lerConfigCasal(ativo.casal);
      // Com o par dentro (login do par), o lançamento ganha o "Só meu" que esconde de verdade.
      const comPar = comParNoCasal;
      nomesDoCasal = { A: casal.nomeA, B: casal.nomeB, comPar };
    }
    // O TEMA do perfil ativo redefine a paleta do app inteiro — fundo, cartão, tinta e
    // destaque. Como tudo já pinta com var(--color-*), a tela toda muda junto sem nenhum
    // componente saber que existe tema. Trocar de perfil troca a cara do app.
    cssDoTema = profileThemeCss(ativo.theme);
    // `after` roda DEPOIS que a resposta já foi enviada. Isto aqui é métrica de engajamento,
    // não conteúdo da página — com `await`, uma vez a cada 15 minutos a pessoa esperava uma
    // escrita no banco antes de a tela aparecer. Não dá pra só soltar a promessa sem esperar:
    // em serverless a função congela ao responder e o trabalho solto morre pela metade.
    after(() => touchLastSeen(user.id, user.lastSeenAt));
  }

  // A saudação já sai na voz do tema: "Oi, Dani ✨" no Girly, "Bom dia. Vamos fazer o que
  // precisa ser feito?" no Disciplina, nenhuma no Game (ele abre no ranking).
  const voz = vozDoTema(profileTheme, profileKind);
  const greeting = voz.saudacao(periodoDoDia(now.getHours()), firstName);
  // Sem a data por extenso embaixo da saudação (06/10/2026): a régua dos dias do Foco já marca
  // hoje. Fica só a frase do tema, quando ele tem uma.
  const dateLabel = voz.subSaudacao(mesLabel);
  // O modo (claro/escuro) que vale: o do tema, quando ele tem um só; o da pessoa, no Padrão.
  const modo = modoEfetivo(profileTheme, theme);
  const podeEscolherModo = temaDeixaEscolherModo(profileTheme);

  return (
    <>
      <ThemeSync theme={preferenciaDeModo(theme) === "auto" ? "auto" : modo === "claro" ? "light" : "dark"} />
      <MoneyProvider currency={currency} ocultos={await valoresOcultos()}>
      {cssDoTema && <style dangerouslySetInnerHTML={{ __html: cssDoTema }} />}
      {/* As cores das duas pessoas do Nós dois, por tema, com a letra em AA (login do par). */}
      {cssDoTema && <style dangerouslySetInnerHTML={{ __html: coresDoCasalCss(profileTheme) }} />}
      {/* O favicon na variante Aurora do tema (o React leva o <link> para o <head>). */}
      {cssDoTema && <link rel="icon" type="image/svg+xml" href={`${temaDoPerfil(profileTheme).logo}/favicon.svg`} />}
      <AppShell
        perfis={perfis}
        isAdmin={session?.user.role === "ADMIN"}
        isPremium={isPremium}
        comMoneyReset={comMoneyReset}
        userEmail={session?.user.email ?? undefined}
        greeting={greeting}
        dateLabel={dateLabel}
        theme={modo === "claro" ? "light" : "dark"}
        openFinance={isPluggyConfigured()}
        profileTheme={profileTheme}
        profileKind={profileKind}
        prefsDeCategoria={prefsDeCategoria}
        nomesDoCasal={nomesDoCasal}
        cartaoComLimite={cartaoComLimite}
        casa={casa}
        tutorialDoCasalVisto={tutorialDoCasalVisto}
        avisoDaMigracao={avisoDaMigracao}
        podeEscolherModo={podeEscolherModo}
        nomeDaConta={nomeDaConta}
        novidades={novidades}
        fotoDaConta={fotoDaConta}
        modoPar={modoPar}
        ferramentasDoMei={ferramentasDoMei}
      >
        {/* Trocar de perfil só revalida a página, e o React guarda o estado dos formulários que
            re-renderizam: o orçamento continuava com os números do perfil anterior e o "Salvar"
            gravava no perfil novo. A chave do perfil ativo remonta a tela inteira na troca. */}
        <Fragment key={perfilAtivoId}>{children}</Fragment>
      </AppShell>
      </MoneyProvider>
    </>
  );
}
