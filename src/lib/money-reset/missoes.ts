/**
 * Money Reset (05/10/2026): 21 dias, 21 missões, tiradas da aula "Organização financeira" da
 * Dani. O conteúdo é o do protótipo aprovado por ela (v6): cada dia é uma ação ou decisão NOVA,
 * nada que o mesmo fluxo do app já faz sozinho.
 *
 * O texto é o do Padrão. Os nomes de tela que mudam de tema (Metas/Sonhos, Orçamento/Combinado)
 * vêm como marcas ({Metas}, {orcamento}...) e são trocados por `naVoz`. Puro, sem banco.
 */

export type Confere = "auto" | "manual";

/**
 * Para onde o botão da missão leva. "guia" liga o passo a passo com foco iluminado nas telas de
 * verdade; "tela" abre a tela da própria missão (o retrato, o motivo, a regra do cartão...).
 */
export type Destino = { tipo: "guia" } | { tipo: "tela" };

export type Missao = {
  d: number;
  semana: 1 | 2 | 3;
  ic: string;
  min: number;
  t: string;
  por: string;
  precisa: string | null;
  sozinho: string;
  passos: string[];
  toques: string[];
  travou: string | null;
  btn: string;
  confere: Confere;
  aula: string;
  destino: Destino;
};

export const SEMANAS = [
  { n: 1 as const, nome: "Enxergar", sub: "Para onde vai o seu dinheiro" },
  { n: 2 as const, nome: "Organizar", sub: "Um destino para cada real" },
  { n: 3 as const, nome: "Manter", sub: "Método simples e hábito" },
];

const guia: Destino = { tipo: "guia" };
const tela: Destino = { tipo: "tela" };

export const MISSOES: Missao[] = [
  { d: 1, semana: 1, ic: "📄", min: 10, t: "Traga seus gastos", por: "Não importa quanto você ganha, e sim como você gasta. Primeiro a gente olha.",
    precisa: "O extrato da conta dos últimos 3 meses (PDF, Excel, CSV ou OFX).",
    sozinho: "Lê o arquivo, separa renda de gasto, põe categoria no que reconhece e guarda cada escolha sua para a próxima vez.",
    passos: ["Toque em + {Registrar} › {Importar}", "Escolha {Extrato} e o arquivo", "Revise só o que o app não reconheceu", "Toque em Importar"],
    toques: ["+ {Registrar}", "{Importar}", "{Extrato}", "{EscolherArquivo}", "Importar"],
    travou: "Não sabe baixar? Toque em \"Como tiro o extrato do meu banco?\". Muitos gastos para revisar? Dá para importar agora e escolher as categorias depois.",
    btn: "Importar extrato", confere: "auto", aula: "Custo de vida", destino: guia },
  { d: 2, semana: 1, ic: "💳", min: 5, t: "A fatura do cartão", por: "No débito a gente sente a perda. No crédito, a dor fica para depois, e por isso se gasta mais.",
    precisa: "A última fatura fechada de cada cartão (o PDF do e-mail).",
    sozinho: "Lança as parcelas dos próximos meses e tira o pagamento da fatura do extrato, para não contar duas vezes.",
    passos: ["Toque em + {Registrar} › {Importar}", "Escolha {Fatura}, o arquivo e o mês", "Revise o que o app não reconheceu", "Toque em Importar"],
    toques: ["+ {Registrar}", "{Importar}", "{Fatura}", "Arquivo", "Importar"],
    travou: "Escolheu Extrato sem querer? O app avisa antes, porque fatura lida como extrato vira renda.",
    btn: "Importar fatura", confere: "auto", aula: "Débito ou crédito?", destino: guia },
  { d: 3, semana: 1, ic: "🪞", min: 3, t: "Seu retrato", por: "O ideal é gastar no máximo 90% do que entra. O resto é o seu futuro.",
    precisa: null,
    sozinho: "Calcula a média dos 3 meses, a renda que veio no extrato e quanto da renda já sai.",
    passos: ["O retrato já vem pronto", "Entrou algo fora da conta (VR, VA, dinheiro)? Toque em Adicionar", "Veja onde você está na régua dos 90%"],
    toques: ["Missão do dia", "Conferir a renda", "Régua dos 90%"],
    travou: null, btn: "Ver meu retrato", confere: "auto", aula: "Controle de gastos", destino: tela },
  { d: 4, semana: 1, ic: "🔍", min: 5, t: "Os pequenos que viram grandes", por: "Um streaming de 59,90 por mês vira 718,80 no ano. Quase ninguém faz essa conta.",
    precisa: null,
    sozinho: "Acha o que se repete nos 3 meses e soma quanto custa no ano.",
    passos: ["{Foco} › {RaioX}", "Para cada item, escolha: manter, cancelar ou cortar pela metade", "Cancele hoje, de verdade, o que marcou para cancelar"],
    toques: ["{Foco}", "{RaioX}", "Uma escolha por item"],
    travou: "No mês seguinte o app pergunta se cancelou mesmo.",
    btn: "Abrir o Raio-X", confere: "auto", aula: "Diagnosticar os gastos", destino: guia },
  { d: 5, semana: 1, ic: "📌", min: 5, t: "O que já tem dono no mês", por: "Reduzir custos não é abrir mão de conforto. Comece pelo que chega todo mês sem você decidir.",
    precisa: null,
    sozinho: "Monta a lista do que sai todo mês: contas fixas, assinaturas e parcelas.",
    passos: ["Confira a lista: o que não é fixo, toque em Não é fixa", "Escolha 1 conta para negociar (internet, celular, tarifa do banco)", "Ligue ou abra o chat da empresa"],
    toques: ["Missão do dia", "Não é fixa", "Negociar 1 conta"],
    travou: "Conta paga em dinheiro ou por outra pessoa? Anote em Contas a pagar.",
    btn: "Ver o que sai todo mês", confere: "auto", aula: "Reduzir despesas fixas", destino: tela },
  { d: 6, semana: 1, ic: "🍔", min: 3, t: "Onde o dinheiro escapa", por: "Delivery e fast food são o gasto supérfluo da dieta financeira. Cardápio da semana e lista no mercado resolvem boa parte.",
    precisa: null,
    sozinho: "Compara cada categoria sua com a distribuição da aula e mostra a que mais passa.",
    passos: ["Veja a categoria que mais passa da régua", "Ponha um teto nela até o fim do mês", "Escolha 1 dica da aula para esta semana"],
    toques: ["Missão do dia", "A que mais passa", "Teto até o fim do mês"],
    travou: null, btn: "Ver onde escapa", confere: "auto", aula: "Alimentação inteligente", destino: tela },
  { d: 7, semana: 1, ic: "💭", min: 3, t: "Seu motivo", por: "Disciplina começa com um motivo claro. É ele que segura nos dias difíceis.",
    precisa: null,
    sozinho: "Junta tudo o que você descobriu na semana numa tela só.",
    passos: ["Veja o resumo da semana", "Escreva o seu motivo: por que você quer colocar o dinheiro no lugar?", "Ele volta para você nos dias em que der vontade de desistir"],
    toques: ["Resumo da semana", "Escrever o motivo"],
    travou: "Sem ideia? \"Quero dormir tranquila\" já é um ótimo motivo.",
    btn: "Escrever meu motivo", confere: "auto", aula: "Disciplina: motivo claro", destino: tela },
  { d: 8, semana: 2, ic: "✈️", min: 5, t: "Seus sonhos com preço", por: "{Metas} são a ponte entre onde você está e onde quer chegar.",
    precisa: "O sonho que você separou no Dia 0.",
    sozinho: "Calcula quanto guardar por mês e diz se é de curto, médio ou longo prazo.",
    passos: ["{Metas} › {NovaMeta}", "O que é, quanto custa e para quando", "Pesou? Mude a data, não desista do sonho"],
    toques: ["{Metas}", "{NovaMeta}", "Preço e data", "Salvar"],
    travou: "Não sabe quanto custa? Ponha um valor aproximado e ajuste depois.",
    btn: "Criar meu sonho", confere: "auto", aula: "Planejamento de vida", destino: guia },
  { d: 9, semana: 2, ic: "🛟", min: 3, t: "Sua reserva", por: "A reserva é o colchão para os meses ruins: 6 meses do seu custo de vida.",
    precisa: null,
    sozinho: "Sugere o alvo pela média dos seus 3 meses.",
    passos: ["{Metas} › Reserva", "Confira o alvo que o app sugere (autônoma: de 6 a 12 meses)", "Diga quanto já tem e salve"],
    toques: ["{Metas}", "Reserva", "Confere o alvo", "Salvar"],
    travou: "Não tem nada guardado? Ponha zero. A reserva começa no dia 11.",
    btn: "Definir a reserva", confere: "auto", aula: "Fundo de segurança", destino: guia },
  { d: 10, semana: 2, ic: "🧮", min: 10, t: "A distribuição do {orcamento}", por: "O {orcamento} não é uma prisão. Ele é um plano de liberdade.",
    precisa: null,
    sozinho: "Sugere a divisão da aula em reais, na sua renda, com o que você gastou de verdade do lado.",
    passos: ["{Orcamento}", "Toque em {Sugerir}", "Ajuste o que não combina com a sua vida", "Salvar"],
    toques: ["{Orcamento}", "{Sugerir}", "Ajustar", "Salvar"],
    travou: "A moradia passa dos 30%? Normal em cidade grande. Tire de outra categoria, nunca da liberdade.",
    btn: "Montar o {orcamento}", confere: "auto", aula: "Distribuição do orçamento", destino: guia },
  { d: 11, semana: 2, ic: "🐷", min: 5, t: "Guardar primeiro", por: "Se precisar cortar, corte o desnecessário, mas nunca deixe de investir no seu futuro.",
    precisa: "O app do seu banco.",
    sozinho: "Já traz o valor do {orcamento}: 10% liberdade + 8% sonhos.",
    passos: ["Confira quanto guardar por mês", "No app do banco, programe a transferência automática para o dia do salário", "Volte e toque em Fiz"],
    toques: ["Quanto guardar", "App do banco", "Transferência automática", "Fiz"],
    travou: "18% não cabe agora? Comece com 5%. O hábito vale mais que o valor.",
    btn: "Programar o guardar", confere: "manual", aula: "Distribuição do orçamento", destino: tela },
  { d: 12, semana: 2, ic: "🧭", min: 2, t: "Para onde vai o guardado", por: "Reserva primeiro, depois os sonhos pela ordem do prazo.",
    precisa: null,
    sozinho: "Divide o que você guarda: reserva primeiro, depois os sonhos.",
    passos: ["Veja a divisão que o app sugere", "Ajuste a data de um sonho se não couber", "Confirme"],
    toques: ["Missão do dia", "Divisão do guardado", "Confirmar"],
    travou: null, btn: "Ver a divisão", confere: "auto", aula: "Distribuição do orçamento", destino: tela },
  { d: 13, semana: 2, ic: "⚖️", min: 3, t: "Débito ou crédito?", por: "Juros do cartão passam de 400% ao ano. Parcelado sem juros só vale se o dinheiro ficar rendendo.",
    precisa: null,
    sozinho: "Mostra quanto da sua próxima fatura já está comprometido com parcelas.",
    passos: ["Veja a próxima fatura: ela cabe inteira?", "Escolha a sua regra do cartão", "Ela volta no seu plano, no dia 21"],
    toques: ["Próxima fatura", "Sua regra do cartão"],
    travou: "A fatura não cabe? Não pague o mínimo: fale com o banco antes do vencimento.",
    btn: "Escolher minha regra", confere: "auto", aula: "Débito ou crédito?", destino: tela },
  { d: 14, semana: 2, ic: "🗺️", min: 3, t: "Seu plano da semana", por: "Agora o dinheiro tem destino antes de chegar.",
    precisa: null,
    sozinho: "Calcula o livre para gastar por semana com o seu {orcamento}.",
    passos: ["Veja o livre para gastar por semana", "Escolha acompanhar toda semana", "O Foco passa a mostrar o livre da semana"],
    toques: ["Resumo da semana", "Acompanhar toda semana"],
    travou: null, btn: "Ver meu plano", confere: "auto", aula: "Como fazer o planejamento", destino: tela },
  { d: 15, semana: 3, ic: "⏳", min: 3, t: "A regra das 24 horas", por: "Antes de comprar, espere um dia e veja se ainda quer ou precisa.",
    precisa: "Uma compra que você está pensando em fazer.",
    sozinho: "Faz a conta com o seu mês e os seus sonhos.",
    passos: ["Toque em + {Registrar} › {PossoComprar}", "O que é, quanto custa e como paga", "Seja sincera", "Se for impulso: {DecidirAmanha}"],
    toques: ["+ {Registrar}", "{PossoComprar}", "Seja sincera", "Decidir"],
    travou: "Nenhuma compra em vista? Use uma que quase fez no último mês.",
    btn: "Abrir {PossoComprar}", confere: "auto", aula: "Consumo consciente", destino: guia },
  { d: 16, semana: 3, ic: "🎙️", min: 2, t: "O que não passa pelo extrato", por: "Método simples é o que você consegue repetir.",
    precisa: null,
    sozinho: "Entende a frase e já põe valor e categoria.",
    passos: ["Toque em + {Registrar} › {GravarAudio}", "Fale: \"pão, 12 reais, dinheiro\"", "Confira e salve"],
    toques: ["+ {Registrar}", "{GravarAudio}", "Falar", "Salvar"],
    travou: "O app pediu o microfone? Toque em Permitir. É uma vez só.",
    btn: "{GravarAudio}", confere: "auto", aula: "Disciplina: método simples", destino: guia },
  { d: 17, semana: 3, ic: "🚫", min: 1, t: "Um dia sem gasto à toa", por: "Só compre em promoção se já precisava antes do desconto.",
    precisa: null,
    sozinho: "No dia seguinte, confere se teve gasto de lazer ou compras.",
    passos: ["Amanhã, só o essencial: mercado, transporte, contas", "Lance o que gastar ou suba o extrato depois"],
    toques: ["Amanhã só o essencial", "O app confere"],
    travou: "Escorregou? A missão espera e você tenta de novo no outro dia.",
    btn: "Topo o desafio", confere: "auto", aula: "Consumo consciente", destino: tela },
  { d: 18, semana: 3, ic: "☕", min: 5, t: "O ritual de 5 minutos", por: "Segunda, revisar os gastos. Sábado, revisar os limites. É o hábito que segura o plano.",
    precisa: null,
    sozinho: "Monta os cartões da semana com os seus números.",
    passos: ["{Foco} › Seus 5 minutos para o dinheiro", "Passe pelos cartões", "Tome a decisão que o ritual pede"],
    toques: ["{Foco}", "Seus 5 minutos", "Cartões", "1 decisão"],
    travou: null, btn: "Fazer o ritual", confere: "auto", aula: "Disciplina: hábito", destino: guia },
  { d: 19, semana: 3, ic: "🎯", min: 10, t: "Um sonho que funciona", por: "Comece pequeno. Foque em quem você quer se tornar, não só no resultado.",
    precisa: "O sonho do dia 8.",
    sozinho: "Guarda as respostas no Money Reset, para você reler quando precisar.",
    passos: ["Responda os 9 passos da aula, um por tela", "Uma frase curta basta", "Salve"],
    toques: ["Seu sonho", "9 passos", "Salvar"],
    travou: "Travou num passo? Uma frase curta basta. Melhor feito que perfeito.",
    btn: "Responder os 9 passos", confere: "auto", aula: "Definindo metas que funcionam", destino: tela },
  { d: 20, semana: 3, ic: "📊", min: 5, t: "A primeira semana do plano", por: "É a hora do raio-x: o que aconteceu de verdade contra o que você planejou.",
    precisa: "O extrato e a fatura mais recentes.",
    sozinho: "Compara a semana com a sua média e com o livre da semana.",
    passos: ["Suba o extrato mais recente (se você não lança tudo na mão)", "Veja a semana contra a sua média"],
    toques: ["+ {Registrar}", "Importar", "A semana × a média"],
    travou: "Lançou tudo à mão ou por voz? Nem precisa subir: o app já tem a semana.",
    btn: "Ver a minha semana", confere: "auto", aula: "Realizado × planejado", destino: tela },
  { d: 21, semana: 3, ic: "🏁", min: 5, t: "Seu plano", por: "Recompense-se pelo progresso. Você chegou até aqui.",
    precisa: null,
    sozinho: "Junta tudo num plano só, com os seus números.",
    passos: ["Abra o seu plano", "Escolha uma recompensa pequena, que caiba nele", "Se quiser, compartilhe"],
    toques: ["Seu plano", "Recompensa", "Compartilhar"],
    travou: null, btn: "Ver meu plano", confere: "manual", aula: "Disciplina: recompensa", destino: tela },
];

export function missao(d: number): Missao | undefined {
  return MISSOES.find((m) => m.d === d);
}

/**
 * Dia 0: só o que ela precisa ter em mãos nos primeiros dias (revisão da Dani, 05/10: a primeira
 * tela não pode dar sensação de "perdida"). VR, VA e contas pagas fora da conta aparecem na hora
 * certa, nos dias 3 e 5, e não aqui.
 */
export const DIA_ZERO_ITENS = [
  { ic: "📄", t: "O extrato da conta dos últimos 3 meses", sub: "Para o dia 1" },
  { ic: "💳", t: "A última fatura do cartão", sub: "Para o dia 2" },
  { ic: "✈️", t: "Um sonho, com preço", sub: "Para o dia 8" },
];

/** Os 9 passos para estruturar a meta, da aula "Definindo metas que funcionam". */
export const PASSOS_DO_SONHO = [
  { t: "Sonho positivo", q: "O que você quer? (o que quer, não o que quer evitar)", ex: "Viajar para o México em agosto de 2027" },
  { t: "Evidência de sucesso", q: "Como vai saber que chegou lá?", ex: "9.600 guardados até julho de 2027" },
  { t: "Específico e realista", q: "Cabe na sua vida de hoje?", ex: "Sim: 960 por mês cabe no que eu guardo" },
  { t: "Recursos", q: "O que você precisa para chegar lá?", ex: "Transferência automática no dia do salário" },
  { t: "Ecologia", q: "Isso é bom para você e para quem está perto?", ex: "Sim, é a viagem da família" },
  { t: "Recompensa emocional", q: "O que te move?", ex: "Orgulho de fazer do jeito certo" },
  { t: "Controle", q: "Depende de você?", ex: "Sim, depende do meu guardar" },
  { t: "Identidade", q: "Você quer de verdade? Quem você vai ser?", ex: "Uma pessoa organizada com dinheiro" },
  { t: "Plano de ação", q: "Qual é a rotina?", ex: "Segunda revisar os gastos, sábado os limites" },
];

export const REGRAS_DO_CARTAO = [
  { chave: "orcamento", ic: "✅", t: "Cartão só para o que está no {orcamento}", sub: "Fatura sempre inteira, nunca o mínimo" },
  { chave: "debito", ic: "💵", t: "Débito no dia a dia", sub: "Cartão só para as contas fixas" },
  { chave: "sem_juros", ic: "🧾", t: "Parcelar só sem juros", sub: "E só o que dura mais que as parcelas" },
] as const;

export const DICAS_DA_SEMANA = [
  { chave: "cardapio", ic: "📅", t: "Cardápio da semana", sub: "No domingo, e mercado só com o necessário" },
  { chave: "lista", ic: "📝", t: "Lista no mercado", sub: "Só compra o que está na lista" },
  { chave: "marmita", ic: "🍱", t: "Marmita 3 vezes", sub: "Leva de casa 3 dias da semana" },
] as const;

/**
 * Os nomes de tela e de botão NO TEMA DA PESSOA (revisão da Dani, 05/10: "faça coisas que façam
 * sentido"). O "+" é "Registrar" no Padrão, "Anotar" no Girly, "Confessar" no Sem filtro; "Gravar
 * áudio" é "Me contar por voz" no Girly. O guia e o passo a passo dizem o nome que está NA TELA,
 * lido da própria voz do tema, sem os emojis e sem o "(PDF, Excel...)".
 */
export type Vocabulario = {
  Foco: string;
  Metas: string;
  NovaMeta: string;
  Orcamento: string;
  orcamento: string;
  Registrar: string;
  Importar: string;
  Extrato: string;
  Fatura: string;
  EscolherArquivo: string;
  GravarAudio: string;
  Sugerir: string;
  RaioX: string;
  PossoComprar: string;
  DecidirAmanha: string;
};

type VozMinima = {
  nav: { metas: string; foco?: string; flowTabs: [string, string, string] };
  titulos: Record<"formMetaNova" | "registrar" | "impImportarArquivo" | "impTipoExtrato" | "impTipoFatura" | "impEscolherExtrato" | "impGravarAudio" | "formOrcSugerir" | "raioxTitulo" | "compraTitulo" | "compraAmanha", string>;
};

/** "Mandar o extrato ou a fatura (PDF, Excel, CSV, OFX) 📄" vira "Mandar o extrato ou a fatura". */
export function limparRotulo(s: string): string {
  return s
    .replace(/\(.*?\)/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[→›]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function vocabularioDaVoz(voz: VozMinima): Vocabulario {
  const t = voz.titulos;
  const orcamento = limparRotulo(voz.nav.flowTabs[2]);
  return {
    Foco: limparRotulo(voz.nav.foco ?? "Foco"),
    Metas: limparRotulo(voz.nav.metas),
    NovaMeta: limparRotulo(t.formMetaNova),
    Orcamento: orcamento,
    orcamento: orcamento.toLowerCase(),
    Registrar: limparRotulo(t.registrar),
    Importar: limparRotulo(t.impImportarArquivo),
    Extrato: limparRotulo(t.impTipoExtrato),
    Fatura: limparRotulo(t.impTipoFatura),
    EscolherArquivo: limparRotulo(t.impEscolherExtrato),
    GravarAudio: limparRotulo(t.impGravarAudio),
    Sugerir: limparRotulo(t.formOrcSugerir),
    RaioX: limparRotulo(t.raioxTitulo),
    PossoComprar: limparRotulo(t.compraTitulo),
    DecidirAmanha: limparRotulo(t.compraAmanha),
  };
}

/** Troca as marcas ({Metas}, {Registrar}, {orcamento}...) pelos nomes do tema. */
export function naVoz(texto: string, v: Vocabulario): string {
  return texto.replace(/\{(\w+)\}/g, (marca, k: string) => (k in v ? v[k as keyof Vocabulario] : marca));
}
