import type { CurrencyCode } from "@/lib/money";
import type { Titulos } from "@/lib/profiles/voice";
import { assunto, criarBlocos, escaparHtml, maiuscula, type Blocos, type Cartao, type Tom } from "@/lib/email/blocos";

/**
 * Os e-mails do SPI Finance na direção B, "Aurora" (proposta de 11/10/2026, aprovada pela dona
 * para todos): o herói com o degradê e o logo do tema dela, o número no meio, e cartões
 * empilhados embaixo. Os blocos e as regras de e-mail (tabela, estilo inline, escuro) moram em
 * blocos.ts; aqui só o que cada e-mail diz e em que ordem.
 *
 * As frases da voz de cada tema continuam vindo do catálogo (lib/profiles/textos/email.ts e
 * vozes/*). Os e-mails de conta (senha, confirmação, acesso, código) não mudaram de texto, só
 * de roupa.
 */

export { escaparHtml };

export type EmailPronto = { subject: string; html: string };

/** Tema e moeda que todo e-mail aceita. Sem tema, o Padrão; sem moeda, real. */
type Aparencia = { tema?: string | null; moeda?: CurrencyCode };

/** Primeiro nome já escapado, pronto pra saudação (as frases de voz dos temas não escapam). */
export function primeiroNome(nome: string | null): string | undefined {
  const primeiro = nome?.trim().split(" ")[0];
  return primeiro ? escaparHtml(primeiro) : undefined;
}

const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/* ======================================================================================
   E-mails de conta (moldura nova, texto de sempre)
   ====================================================================================== */

/**
 * O e-mail simples na moldura nova: o herói com o logo e um título curto, e um cartão com os
 * parágrafos, o botão e as notas pequenas. É a roupa dos e-mails que não têm número.
 */
export function emailSimples(params: {
  b: Blocos;
  subject: string;
  preheader: string;
  /** Linha pequena acima do título, no herói (a saudação, quase sempre). */
  saudacao?: string;
  tituloDoHeroi: string;
  /** HTML extra no herói, embaixo do título (o código da compra). */
  noHeroi?: string;
  paragrafos: string[];
  botao?: { href: string; rotulo: string };
  notas?: string[];
  /** HTML depois das notas (a assinatura). */
  fim?: string;
  rodape?: string;
  preferenciasUrl?: string;
}): EmailPronto {
  const { b } = params;
  const topo = `${params.saudacao ? `${b.texto(params.saudacao, "text-align:center;margin-bottom:6px;")}` : ""}${b.titulo(params.tituloDoHeroi, 28, "text-align:center;")}${params.noHeroi ?? ""}`;
  const corpo =
    params.paragrafos.map((p) => b.texto(p, "margin-bottom:16px;")).join("") +
    (params.botao ? `${b.espaco(8)}${b.botao(params.botao.href, params.botao.rotulo, { cheio: true })}${b.espaco(20)}` : "") +
    (params.notas ?? []).map((n) => b.pequeno(n, "margin-bottom:8px;")).join("") +
    (params.fim ?? "");
  const subject = assunto(params.subject);
  return {
    subject,
    html: b.moldura({
      titulo: escaparHtml(subject),
      preheader: escaparHtml(params.preheader),
      cartoes: [b.heroi(topo) + b.pad(corpo, "28px 28px 24px")],
      rodape: params.rodape ?? "Se você não reconhece este e-mail, pode ignorá-lo com segurança.",
      preferenciasUrl: params.preferenciasUrl,
    }),
  };
}

/** E-mail de recuperação de senha. */
export function passwordResetEmail(params: { name: string | null; resetUrl: string } & Aparencia): EmailPronto {
  // Só o primeiro nome: o nome é digitado por quem se cadastra, e uma frase inteira ("pague em
  // golpe.com") viraria link no Gmail de quem recebe.
  const nomeCurto = primeiroNome(params.name);
  return emailSimples({
    b: criarBlocos(params.tema, params.moeda),
    subject: "Redefinir sua senha · SPI Finance",
    preheader: "O link vale por 1 hora e só pode ser usado uma vez.",
    saudacao: nomeCurto ? `Oi, ${nomeCurto}!` : "Oi!",
    tituloDoHeroi: "Crie uma senha nova",
    paragrafos: ["Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma senha nova:"],
    botao: { href: params.resetUrl, rotulo: "Criar nova senha" },
    notas: ["Este link vale por 1 hora e só pode ser usado uma vez.", "Se você não pediu isso, ignore este e-mail, sua senha continua a mesma."],
  });
}

/**
 * E-mail de "acesso liberado": a pessoa comprou (ou a Dani liberou na mão) mas ainda não tem
 * conta. O convite é pra ela se cadastrar usando ESTE e-mail (é ele que está na allowlist;
 * com outro e-mail o cadastro é bloqueado).
 */
export function accessGrantedEmail(params: { email: string; registerUrl: string } & Aparencia): EmailPronto {
  return emailSimples({
    b: criarBlocos(params.tema, params.moeda),
    subject: "Seu acesso ao SPI Finance está liberado",
    preheader: "Falta só criar sua conta para começar.",
    saudacao: "Oi!",
    tituloDoHeroi: "Seu acesso está liberado",
    paragrafos: ["Seu acesso ao <b>SPI Finance</b> foi liberado. Falta só criar sua conta para começar a organizar suas finanças:"],
    botao: { href: params.registerUrl, rotulo: "Criar minha conta" },
    notas: [`Importante: cadastre-se usando exatamente este e-mail (<b>${escaparHtml(params.email)}</b>), é ele que está autorizado.`],
  });
}

/**
 * O código para juntar a compra à conta (07/10/2026): quem comprou com um e-mail e criou a conta
 * com outro digita o e-mail da compra na tela "sem acesso" e recebe este código nele. Vai para o
 * e-mail da COMPRA: é ali que se prova que a compra é dela.
 */
export function codigoDaCompraEmail(params: { codigo: string; emailDaConta: string } & Aparencia): EmailPronto {
  const b = criarBlocos(params.tema, params.moeda);
  const codigo = escaparHtml(params.codigo);
  return emailSimples({
    b,
    subject: `${params.codigo} é o seu código · SPI Finance`,
    preheader: "Vale por 20 minutos.",
    saudacao: "Oi!",
    tituloDoHeroi: "Seu código",
    noHeroi: `${b.espaco(10)}<div class="c-ink num-40" style="color:${b.cores.claro.ink};font-size:40px;line-height:48px;font-weight:300;letter-spacing:8px;text-align:center;font-variant-numeric:tabular-nums;">${codigo}</div>`,
    paragrafos: [`Este é o código para usar a sua compra do SPI Finance na conta <b>${escaparHtml(params.emailDaConta)}</b>.`],
    notas: ["Vale por 20 minutos. Depois disso, você entra no app com este e-mail.", "Se não foi você, ignore este e-mail: sem o código, nada muda."],
  });
}

/** E-mail de "conta criada" (a Dani criou a conta na mão no admin). */
export function welcomeEmail(params: { name: string | null; appUrl: string } & Aparencia): EmailPronto {
  const nomeCurto = primeiroNome(params.name);
  return emailSimples({
    b: criarBlocos(params.tema, params.moeda),
    subject: "Sua conta no SPI Finance está pronta",
    preheader: "Primeiro passo: registre um gasto ou renda do dia.",
    saudacao: nomeCurto ? `Boas-vindas, ${nomeCurto}!` : "Boas-vindas!",
    tituloDoHeroi: "Sua conta está pronta",
    paragrafos: ["Que bom ter você aqui. O SPI Finance junta seus gastos, orçamento, metas e investimentos num lugar só, para você decidir com clareza."],
    botao: { href: params.appUrl, rotulo: "Abrir o SPI Finance" },
    notas: ["Primeiro passo: registre um gasto ou renda do dia. O resto flui a partir daí."],
  });
}

/**
 * "Confirme seu e-mail": vai no cadastro (e no "Reenviar" da tela de confirmação). Substitui o
 * boas-vindas do autocadastro: a conta só abre depois do clique, então um "sua conta está
 * pronta" antes disso seria mentira.
 */
export function confirmEmailEmail(params: { name: string | null; confirmUrl: string } & Aparencia): EmailPronto {
  const primeiro = primeiroNome(params.name);
  return emailSimples({
    b: criarBlocos(params.tema, params.moeda),
    subject: "Confirme seu e-mail · SPI Finance",
    preheader: "Falta um passo para abrir sua conta.",
    saudacao: primeiro ? `Oi, ${primeiro}!` : "Oi!",
    tituloDoHeroi: "Confirme seu e-mail",
    paragrafos: ["Falta um passo para abrir sua conta no SPI Finance: confirmar que este e-mail é seu. É só tocar no botão:"],
    botao: { href: params.confirmUrl, rotulo: "Confirmar meu e-mail" },
    notas: ["Este link vale por 7 dias. Se ele vencer, entre no app e peça outro.", "Se você não criou uma conta, ignore este e-mail: sem a confirmação, ninguém entra com ele."],
  });
}

/* ======================================================================================
   Resumo do mês e convite para começar
   ====================================================================================== */

/**
 * Resumo do mês: enviado no começo de cada mês pra quem teve movimento no mês anterior.
 *
 * O herói diz a palavra (Sobrou, Empatou, Faltou) e o número da regra única do app (sobrou =
 * entrou − gastou − guardou, sempre sem sinal), com a comparação com o mês anterior na voz do
 * tema. Embaixo: as três parcelas que fecham a conta, Entrou e Gastou dos últimos meses, as
 * categorias que mais pesaram contra o plano, as metas e o botão do fechamento.
 */
export function monthlyRecapEmail(
  params: {
    name: string | null;
    /** "setembro de 2026" */
    monthLabel: string;
    /** "setembro", para o assunto. Sem ele, sai do monthLabel. */
    mesNome?: string;
    income: number;
    expense: number;
    /** Aportes do mês: tiram dinheiro do bolso igual aos gastos, e entram na conta do saldo. */
    investment: number;
    balance: number;
    /** Variação do gasto vs. mês anterior (0,17 = 17% a mais); null quando não há base. */
    expenseDelta: number | null;
    topCategory: { label: string; value: number } | null;
    /** Entrou e gastou dos meses até o do resumo (o último é ele). Menos de 2, o gráfico não sai. */
    meses?: { rotulo: string; entrou: number; gastou: number }[];
    /** As categorias que mais pesaram, com o plano de cada (0 = sem plano). `chave` é a categoria-mãe. */
    categorias?: { chave: string | null; nome: string; gasto: number; plano: number }[];
    /** Até duas metas, com o progresso. */
    metas?: { nome: string; guardado: number; alvo: number }[];
    currency: CurrencyCode;
    appUrl: string;
    preferencesUrl: string;
    /** A voz do tema do perfil do resumo: cada frase sai no jeito de falar do tema dela. */
    t: Titulos;
    /**
     * Nome do perfil dos números, só pra quem tem mais de um: "entrou R$ 12 mil" sem dizer se é
     * o Pessoal ou a Empresa deixa ela sem saber de onde veio a conta.
     */
    perfil?: string;
  } & Pick<Aparencia, "tema">,
): EmailPronto {
  const { t } = params;
  const b = criarBlocos(params.tema, params.currency);
  const perfil = params.perfil?.trim();
  const mesNome = params.mesNome ?? params.monthLabel.split(" de ")[0];

  // Sobrou, empatou ou faltou: a palavra muda, o valor vai sempre sem sinal (nunca "−R$").
  const estado = params.balance > 0 ? { palavra: "Sobrou", cor: "success" as Tom } : params.balance === 0 ? { palavra: "Empatou", cor: "ink" as Tom } : { palavra: "Faltou", cor: "danger" as Tom };

  // A comparação, na voz do tema: "sobrou R$ 2.378" não diz se foi um bom mês; "e você gastou
  // 12% menos que no mês passado" diz.
  const linhaDaVoz =
    params.expenseDelta === null
      ? t.emailRecapPrimeiroMes
      : Math.abs(params.expenseDelta) < 0.08
        ? t.emailRecapGastosIguais
        : params.expenseDelta < 0
          ? t.emailRecapGastosMenos(b.destaque(`${Math.round(Math.abs(params.expenseDelta) * 100)}% menos`, "success"))
          : t.emailRecapGastosMais(b.destaque(`${Math.round(params.expenseDelta * 100)}% acima`, "danger"));

  const rotuloDoMes = `${perfil ? `Perfil ${escaparHtml(perfil)} &nbsp;·&nbsp; ` : ""}${escaparHtml(maiuscula(params.monthLabel))}`;
  const topo = `${b.eyebrow(rotuloDoMes, true)}${b.espaco(10)}<div${b.sx({ c: estado.cor }, "font-size:20px;line-height:24px;font-weight:600;text-align:center;")}>${estado.palavra}</div><div style="line-height:72px;text-align:center;">${b.valor(params.balance, 64)}</div><div${b.sx({ c: "ink" }, "font-size:15px;line-height:22px;text-align:center;")}>${linhaDaVoz}</div>`;

  // Entrou, Gastou e Guardou sempre aparecem: são as três parcelas da conta do valor grande, e
  // quem lê precisa conseguir fechá-la.
  const numeros = b.tresNumeros([
    { rotulo: t.entrou, valor: params.income, cor: "success" },
    { rotulo: t.gastou, valor: params.expense, cor: "ink" },
    { rotulo: t.aportou, valor: params.investment, cor: "accent" },
  ]);

  const cartoes: Cartao[] = [b.heroi(topo) + b.pad(numeros, "16px 24px 24px")];

  const meses = params.meses ?? [];
  if (meses.length >= 2) {
    cartoes.push(b.pad(`${b.eyebrow(`Entrou e gastou, últimos ${meses.length} meses`)}${b.espaco(18)}${b.grafico(meses)}`));
  }

  const categorias = params.categorias ?? (params.topCategory ? [{ chave: null, nome: params.topCategory.label, gasto: params.topCategory.value, plano: 0 }] : []);
  if (categorias.length > 0) {
    const titulo = params.categorias ? "Onde mais pesou" : t.emailMaiorGasto;
    cartoes.push(b.pad(`${b.eyebrow(escaparHtml(titulo))}${b.espaco(16)}${categorias.map((c) => b.linhaCategoria({ ...c, nome: escaparHtml(c.nome) })).join("")}`, "26px 28px 8px"));
  }

  const metas = params.metas ?? [];
  if (metas.length > 0) {
    cartoes.push(b.pad(`${b.eyebrow("Suas metas")}${b.espaco(16)}${metas.map((m) => b.linhaMeta({ ...m, nome: escaparHtml(m.nome) })).join("")}`, "26px 28px 8px"));
  }

  cartoes.push(b.pad(b.botao(params.appUrl, t.emailRecapBotao, { cheio: true })));

  const valorTexto = b.Rtexto(params.balance);
  const subject = assunto(`${estado.palavra} ${estado.palavra === "Empatou" ? "" : `${valorTexto} `}em ${mesNome}${perfil ? ` · ${perfil}` : ""}`);
  return {
    subject,
    html: b.moldura({
      titulo: escaparHtml(subject),
      preheader: `${t.entrou} ${b.Rtexto(params.income)}, ${t.gastou.toLowerCase()} ${b.Rtexto(params.expense)}, ${t.aportou.toLowerCase()} ${b.Rtexto(params.investment)}.`,
      cartoes,
      rodape: t.emailRecapRodape,
      preferenciasUrl: params.preferencesUrl,
    }),
  };
}

/**
 * Convite pra começar: vai no mesmo dia 1º, pra quem NÃO teve movimento no mês. É o e-mail
 * que fala com a maior parte da base: gente que criou conta e nunca voltou.
 *
 * Tom é o que decide se isso ajuda ou irrita. Nada de "você não fez", "você está atrasada",
 * contador de dias perdidos ou culpa: o pedido é de UM gasto, porque a barreira real não é
 * preguiça, é a tarefa parecer grande. Uma ação, um clique, sem cobrança.
 */
export function monthlyNudgeEmail(
  params: {
    name: string | null;
    /** Mês que está começando, ex.: "outubro". */
    newMonthLabel: string;
    appUrl: string;
    preferencesUrl: string;
    /** A voz do tema do perfil ativo da pessoa: cada frase sai no jeito de falar do tema dela. */
    t: Titulos;
  } & Aparencia,
): EmailPronto {
  const { t } = params;
  const b = criarBlocos(params.tema, params.moeda);
  const mes = maiuscula(params.newMonthLabel);
  const topo = `${b.texto(t.emailSaudacao(primeiroNome(params.name)), "text-align:center;margin-bottom:6px;")}${b.titulo(`${mes} começou`, 30, "text-align:center;")}${b.espaco(10)}<div${b.sx({ c: "ink" }, "font-size:16px;line-height:24px;text-align:center;")}>${t.emailConviteIntro2}</div>`;
  const passos = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;"><tr>${[
    ["1", "Você fala"],
    ["2", "Ele entra no mês"],
    ["3", "O app mostra o livre"],
  ]
    .map(([n, txt]) => `<td width="33%" valign="top" align="center" style="padding:0 4px;"><div${b.sx({ c: "accent" }, "font-size:22px;line-height:28px;font-weight:300;")}>${n}</div><div${b.sx({ c: "muted" }, "font-size:12px;line-height:16px;")}>${txt}</div></td>`)
    .join("")}</tr></table>`;
  const fim = `${b.caixaDeFala("Toque no + e fale:", "“mercado, duzentos e quarenta reais”")}${passos}${b.espaco(24)}${b.botao(params.appUrl, t.emailConviteBotao, { cheio: true })}${b.espaco(12)}${b.pequeno("Falando ou digitando, leva dez segundos.", "text-align:center;")}`;
  const subject = assunto(`${mes} começou. Um gasto, só um.`);
  return {
    subject,
    html: b.moldura({
      titulo: escaparHtml(subject),
      preheader: "Anote um gasto de hoje e o app monta o resto.",
      cartoes: [b.heroi(topo, true), b.pad(fim, "26px 28px 28px")],
      rodape: "Você recebe no máximo três convites. Pode desligar quando quiser.",
      preferenciasUrl: params.preferencesUrl,
    }),
  };
}

/* ======================================================================================
   Avisos do meio do mês (orçamento, cartão, metas)
   ====================================================================================== */

/**
 * O que o e-mail precisa para desenhar o aviso. Sem `dados`, o aviso sai como título e texto
 * (o jeito de antes), embaixo do principal.
 */
export type DadosDoAviso =
  | {
      tipo: "passou";
      /** Categoria-mãe ("SAUDE") para o ícone e a cor. */
      categoriaKey: string;
      categoria: string;
      gasto: number;
      plano: number;
      /** Quanto passou, já arredondado para cima (quantoPassou): R$ 66,40 vira R$ 67. */
      passou: number;
      mesNome: string;
      /** Dias que faltam, contando hoje. */
      diasRestantes: number;
      /** A sugestão de onde tirar (planoDeCobrir). */
      tirar?: { de: string; sobraDepois: number; principal: boolean } | null;
      /** Usar o livre do mês: de quanto para quanto, e o novo por dia. */
      livre?: { antes: number; depois: number; porDia: number } | null;
    }
  | { tipo: "perto"; categoriaKey: string; categoria: string; gasto: number; plano: number; mesNome: string; diasRestantes: number }
  | { tipo: "cartao"; gasto: number; limite: number; mesNome: string }
  | { tipo: "meta-atras"; nome: string; guardado: number; alvo: number; porMes: number };

export type AvisoParaEmail = { title: string; body: string; url: string; dados?: DadosDoAviso };

const PRIORIDADE: Record<string, number> = { passou: 0, cartao: 1, perto: 2, "meta-atras": 3 };

/** O assunto de um aviso: a frase curta de cada tipo. Nome digitado pela pessoa vai em texto puro. */
function assuntoDoAviso(a: AvisoParaEmail, b: Blocos): string {
  const d = a.dados;
  if (d?.tipo === "passou") return `${d.categoria} passou ${b.Rtexto(d.passou)}`;
  if (d?.tipo === "perto") return `${d.categoria} está perto do plano`;
  return a.title;
}

function heroiDoAviso(a: AvisoParaEmail, b: Blocos): { topo: string; embaixo: string; fim: string } {
  const d = a.dados;
  const centro = "text-align:center;";
  const manchete = (html: string) => `<div${b.sx({ c: "ink" }, `font-size:22px;line-height:28px;font-weight:600;${centro}`)}>${html}</div>`;
  const numero = (v: number, cor: Tom = "ink") => `<div style="line-height:64px;${centro}">${b.valor(v, 56, cor)}</div>`;
  const abrir = `${b.espaco(10)}${b.pequeno("Os botões só abrem o app. Nada muda sem você confirmar lá.", centro)}`;

  if (d?.tipo === "passou") {
    const tom = b.tomDaCategoria(d.categoriaKey);
    const passouPct = d.plano > 0 ? Math.round((d.passou / d.plano) * 100) : 0;
    const topo = `${b.icone(tom.icone, "surface", 48, true)}${b.espaco(14)}${b.eyebrow(`Orçamento de ${d.mesNome}`, true)}${b.espaco(8)}${manchete(`${escaparHtml(d.categoria)} <span${b.sx({ c: "danger" })}>passou</span>`)}${numero(d.passou, "danger")}`;
    const embaixo = `${b.barra(100, tom.cor, { alt: 14, passou: passouPct })}${b.legenda(`${b.R(d.gasto)} gastos`, `plano ${b.R(d.plano)}`)}`;
    const opcaoTirar = d.tirar
      ? b.caixa(
          `<div${b.sx({ c: "ink" }, "font-size:15px;line-height:20px;font-weight:600;")}>Tirar de ${escaparHtml(d.tirar.de)} · sobra ${b.R(d.tirar.sobraDepois)}</div><div${b.sx({ c: "muted" }, "font-size:13px;line-height:18px;padding:2px 0 12px;")}>Só neste mês. O total do plano não muda.</div>${b.botao(a.url, `Cobrir com ${escaparHtml(d.tirar.de)}`, { cheio: true, secundario: !d.tirar.principal })}`,
        )
      : "";
    const opcaoLivre = d.livre
      ? b.caixa(
          `<div${b.sx({ c: "ink" }, "font-size:15px;line-height:20px;font-weight:600;")}>Usar o livre do mês</div><div${b.sx({ c: "muted" }, "font-size:13px;line-height:18px;padding:2px 0 12px;")}>O livre vai de ${b.R(d.livre.antes)} para ${b.R(d.livre.depois)}. Fica ${b.R(d.livre.porDia)} por dia.</div>${b.botao(a.url, "Usar o livre", { cheio: true, secundario: Boolean(d.tirar?.principal) })}`,
        )
      : "";
    const opcoes = (d.tirar?.principal ? [opcaoTirar, opcaoLivre] : [opcaoLivre, opcaoTirar]).filter(Boolean).join(b.espaco(10));
    const dias = d.diasRestantes === 1 ? "Falta 1 dia" : `Ainda faltam ${d.diasRestantes} dias`;
    const fim = `${b.suave(`${dias} de ${d.mesNome}. Dá para ajustar em um toque:`)}${b.espaco(16)}${opcoes || b.botao(a.url, "Ver no app", { cheio: true })}${abrir}`;
    return { topo, embaixo, fim };
  }

  if (d?.tipo === "perto") {
    const tom = b.tomDaCategoria(d.categoriaKey);
    const sobra = Math.max(0, d.plano - d.gasto);
    const pct = d.plano > 0 ? Math.round((d.gasto / d.plano) * 100) : 0;
    const porDia = sobra / Math.max(1, d.diasRestantes);
    const topo = `${b.icone(tom.icone, "surface", 48, true)}${b.espaco(14)}${b.eyebrow(`Orçamento de ${d.mesNome}`, true)}${b.espaco(8)}${manchete(`${escaparHtml(d.categoria)} está perto do plano`)}${b.espaco(6)}${b.suave("Ainda sobram", centro)}${numero(sobra)}`;
    const embaixo = `${b.barra(pct, tom.cor, { alt: 14 })}${b.legenda(`${b.R(d.gasto)} gastos, ${pct}%`, `plano ${b.R(d.plano)}`)}`;
    const dias = d.diasRestantes === 1 ? "Falta 1 dia" : `Faltam ${d.diasRestantes} dias`;
    const fim = `${b.suave(`${dias}. Dá <b>${b.R(porDia)} por dia</b> até o fim do mês.`)}${b.espaco(20)}${b.botao(a.url, `Ver ${escaparHtml(d.categoria)}`, { cheio: true })}`;
    return { topo, embaixo, fim };
  }

  if (d?.tipo === "cartao") {
    const passou = d.gasto > d.limite;
    const pct = d.limite > 0 ? (d.gasto / d.limite) * 100 : 0;
    const topo = `${b.icone("cartao", "surface", 48, true)}${b.espaco(14)}${b.eyebrow(`Cartão de ${d.mesNome}`, true)}${b.espaco(8)}${manchete(escaparHtml(a.title))}${b.espaco(6)}${b.suave(passou ? "Passou" : "Ainda faltam", centro)}${numero(passou ? d.gasto - d.limite : d.limite - d.gasto, passou ? "danger" : "ink")}`;
    const embaixo = `${b.barra(passou ? 100 : pct, "accent", { alt: 14, passou: passou && d.limite > 0 ? Math.round(((d.gasto - d.limite) / d.limite) * 100) : 0 })}${b.legenda(`${b.R(d.gasto)} no cartão`, `limite ${b.R(d.limite)}`)}`;
    const fim = `${b.suave(escaparHtml(a.body))}${b.espaco(20)}${b.botao(a.url, "Ver o cartão", { cheio: true })}`;
    return { topo, embaixo, fim };
  }

  if (d?.tipo === "meta-atras") {
    const pct = d.alvo > 0 ? (d.guardado / d.alvo) * 100 : 0;
    const topo = `${b.icone("meta", "surface", 48, true)}${b.espaco(14)}${b.eyebrow("Metas", true)}${b.espaco(8)}${manchete(escaparHtml(a.title))}${b.espaco(6)}${b.suave(d.porMes > 0 ? "Para voltar ao ritmo, este mês" : "Vale rever o prazo ou o valor", centro)}${d.porMes > 0 ? numero(d.porMes) : ""}`;
    const embaixo = `${b.barra(pct, "accent", { alt: 14 })}${b.legenda(`${Math.round(pct)}%`, `${b.R(d.guardado)} de ${b.R(d.alvo)}`)}`;
    const fim = `${b.botao(a.url, "Ver a meta", { cheio: true })}`;
    return { topo, embaixo, fim };
  }

  const topo = `${b.icone("conta", "surface", 48, true)}${b.espaco(14)}${manchete(escaparHtml(a.title))}`;
  return { topo, embaixo: b.suave(escaparHtml(a.body), centro), fim: b.botao(a.url, "Ver no app", { cheio: true }) };
}

/**
 * Avisos do meio do mês pra quem não ligou os avisos no celular: um e-mail por dia. O mais
 * importante vira o herói (passou do plano, depois cartão, perto do limite e meta atrasada); os
 * outros entram embaixo, em lista. "Passou", nunca "estourou".
 */
export function alertEmail(
  params: {
    name: string | null;
    alerts: AvisoParaEmail[];
    preferencesUrl: string;
  } & Aparencia,
): EmailPronto {
  const b = criarBlocos(params.tema, params.moeda);
  const ordenados = [...params.alerts].sort((x, y) => (PRIORIDADE[x.dados?.tipo ?? ""] ?? 9) - (PRIORIDADE[y.dados?.tipo ?? ""] ?? 9));
  const [principal, ...outros] = ordenados;
  const h = heroiDoAviso(principal, b);
  const cartoes: Cartao[] = [b.heroi(h.topo) + b.pad(h.embaixo, "22px 28px 26px"), b.pad(h.fim, "24px 28px 28px")];

  if (outros.length > 0) {
    const lista = outros
      .map(
        (a) =>
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;"><tr><td valign="top"><div${b.sx({ c: "ink" }, "font-size:15px;line-height:20px;font-weight:600;")}>${escaparHtml(assuntoDoAviso(a, b))}</div><div${b.sx({ c: "muted" }, "font-size:13px;line-height:18px;padding-top:2px;")}>${escaparHtml(a.body)}</div></td><td width="64" align="right" valign="top">${b.link(a.url, "Abrir", "accent")}</td></tr></table>`,
      )
      .join("");
    cartoes.push(b.pad(`${b.eyebrow("Também hoje")}${b.espaco(14)}${lista}`, "24px 28px 12px"));
  }

  const primeiro = assuntoDoAviso(principal, b);
  const subject = assunto(outros.length > 0 ? `${primeiro} e mais ${outros.length}` : primeiro);
  return {
    subject,
    html: b.moldura({
      titulo: escaparHtml(subject),
      preheader: escaparHtml(principal.body),
      cartoes,
      rodape: "Prefere receber isso no celular, como mensagem? Ligue os avisos em Notificações. Ou desative por lá.",
      preferenciasUrl: params.preferencesUrl,
    }),
  };
}

/**
 * "Você chegou lá" (novo, 11/10/2026): a meta bateu o alvo. Sai uma vez por meta (chave
 * goal-done:<id> no NotificationLog), pelo cron de alertas. É o e-mail que ela vai querer mostrar.
 */
export function metaAtingidaEmail(
  params: {
    name: string | null;
    meta: string;
    alvo: number;
    /** Meses entre a criação da meta e hoje (pelo menos 1). */
    meses: number;
    /** Média guardada por mês nesse tempo. */
    mediaPorMes: number;
    url: string;
    preferencesUrl: string;
  } & Aparencia,
): EmailPronto {
  const b = criarBlocos(params.tema, params.moeda);
  const girly = b.tema === "girly";
  const meta = escaparHtml(params.meta);
  const meses = Math.max(1, Math.round(params.meses));
  const tempo = meses === 1 ? "1 mês" : `${meses} meses`;
  const linha = girly ? `Foram ${tempo} guardando ${b.R(params.mediaPorMes)} por mês. Que orgulho de você` : `Em ${tempo}, guardando ${b.R(params.mediaPorMes)} por mês. Ela é sua.`;
  const topo = `${b.icone("trofeu", "surface", 48, true)}${b.espaco(14)}${b.eyebrow("Meta concluída", true)}${b.espaco(8)}${b.titulo(girly ? "Amiga, você chegou lá" : "Você chegou lá", 24, "text-align:center;")}${b.espaco(4)}${b.suave(meta, "text-align:center;")}<div style="line-height:72px;text-align:center;">${b.valor(params.alvo, 64)}</div>`;
  const embaixo = `${b.barra(100, "accent", { alt: 14 })}${b.legenda("100%", `${b.R(params.alvo)} de ${b.R(params.alvo)}`)}`;
  const fim = `${b.suave(linha)}${b.espaco(20)}${b.botao(params.url, "Ver a meta", { cheio: true })}`;
  const subject = assunto(`${params.meta}: você chegou lá`);
  return {
    subject,
    html: b.moldura({
      titulo: escaparHtml(subject),
      preheader: `${b.Rtexto(params.alvo)} guardados. 100% da meta.`,
      cartoes: [b.heroi(topo) + b.pad(embaixo, "22px 28px 26px"), b.pad(fim, "24px 28px 28px")],
      rodape: "Você recebe este aviso quando uma meta é concluída.",
      preferenciasUrl: params.preferencesUrl,
    }),
  };
}

/* ======================================================================================
   Contas a vencer
   ====================================================================================== */

/**
 * Lembrete das contas a pagar (05/10/2026): as que vencem amanhã e hoje, num e-mail só, na voz do
 * tema do perfil. A primeira vira o herói (quadradinho do calendário, nome e valor); as outras
 * entram em lista. O nome da conta foi a pessoa que digitou: escapado.
 */
export function contasEmail(
  params: {
    name: string | null;
    t: Pick<Titulos, "contasEmailAssunto" | "contasEmailIntro" | "contasEmailBotao" | "contasEmailRodape"> & Partial<Pick<Titulos, "contasLembreteCorpo">>;
    /** `quando` ("dia" ou "vespera") deixa a lista embaixo curta: "Internet · vence hoje". */
    contas: { nome: string; titulo: string; corpo: string; valor?: number | null; vencimento?: Date; quando?: "dia" | "vespera" }[];
    url: string;
  } & Aparencia,
): EmailPronto {
  const b = criarBlocos(params.tema, params.moeda);
  const [principal, ...outras] = params.contas;
  // A frase do tema sem o valor ("Quando pagar, marque no app."), que já está grande no herói.
  const semValor = (() => {
    const frase = params.t.contasLembreteCorpo?.("§");
    return frase?.startsWith("§. ") ? frase.slice(3) : null;
  })();
  const dia = (d: Date | undefined, tam: number, centro = false) => (d ? b.calendario(d.getUTCDate(), MESES_CURTOS[d.getUTCMonth()], tam, centro) : b.icone("conta", "accentTint", tam, centro));
  const temValor = principal.valor != null;
  const topo = `${dia(principal.vencimento, 56, true)}${b.espaco(16)}<div${b.sx({ c: "ink" }, "font-size:22px;line-height:28px;font-weight:600;text-align:center;")}>${escaparHtml(principal.titulo)}</div>${temValor ? `<div style="line-height:64px;text-align:center;">${b.valor(principal.valor!, 56)}</div>` : b.espaco(8)}${b.suave(escaparHtml(temValor && semValor ? semValor : principal.corpo), "text-align:center;")}`;
  const lista = outras
    .map(
      (c) =>
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px;"><tr><td width="56" valign="middle">${dia(c.vencimento, 44)}</td><td valign="middle" style="padding-left:12px;"><div${b.sx({ c: "ink" }, "font-size:15px;line-height:20px;font-weight:600;")}>${escaparHtml(c.quando ? c.nome : c.titulo)}</div><div${b.sx({ c: "muted" }, "font-size:13px;line-height:18px;")}>${c.quando ? (c.quando === "dia" ? "vence hoje" : "vence amanhã") : escaparHtml(c.corpo)}</div></td><td align="right" valign="middle"${b.sx({ c: "ink" }, "font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap;")}>${c.valor != null ? b.R(c.valor) : ""}</td></tr></table>`,
    )
    .join("");
  const fim = `${outras.length > 0 ? `${b.eyebrow("Também vencendo")}${b.espaco(14)}${lista}${b.espaco(10)}` : ""}${b.botao(params.url, params.t.contasEmailBotao, { cheio: true })}`;
  const subject = assunto(outras.length > 0 ? `${principal.titulo} e mais ${outras.length}` : principal.titulo);
  return {
    subject,
    html: b.moldura({
      titulo: escaparHtml(subject),
      preheader: escaparHtml(params.t.contasEmailIntro),
      cartoes: [b.heroi(topo, true), b.pad(fim, "24px 28px 28px")],
      rodape: params.t.contasEmailRodape,
    }),
  };
}

