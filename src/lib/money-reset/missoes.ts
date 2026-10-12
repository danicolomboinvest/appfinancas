/**
 * Money Reset, versão A+B (12/10/2026, aprovada pela Dani em money-reset-proposta.html): um mapa
 * de 21 marcos em 3 semanas (Enxergar, Organizar, Manter). Cada marco é uma missão feita numa tela
 * que o SPI já tem; a única nova é a 13, "Suas dívidas na mesa". O conteúdo continua sendo o da aula
 * "Organização financeira" da Dani.
 *
 * `antigos`: de que dia da versão de 05/10 cada marco veio. É por ele que quem já estava no meio
 * continua de onde parou (ver progresso.ts, `marcosFeitos`).
 *
 * O texto é o do Padrão. Os nomes de tela que mudam de tema (Metas/Sonhos, Orçamento/Combinado)
 * vêm como marcas ({Metas}, {orcamento}...) e são trocados por `naVoz`. Sem emoji: cada marco tem
 * um ícone próprio (`icone`, desenhado em components/money-reset/IconeDoMarco.tsx). Puro.
 */

export type Confere = "auto" | "manual";

/**
 * Para onde o botão da missão leva. "guia" liga o passo a passo com foco iluminado nas telas de
 * verdade; "tela" faz a missão ali mesmo (o retrato, o Raio-X, o motivo, a regra do cartão...).
 */
export type Destino = "guia" | "tela";

export type IconeDoMarco =
  | "extrato"
  | "cartao"
  | "raiox"
  | "fixas"
  | "escapa"
  | "voz"
  | "motivo"
  | "orcamento"
  | "guardar"
  | "reserva"
  | "sonho"
  | "divisao"
  | "dividas"
  | "regra"
  | "semana"
  | "espera"
  | "semgasto"
  | "ritual"
  | "alvo"
  | "comparar"
  | "fim";

export type Marco = {
  n: number;
  semana: 1 | 2 | 3;
  icone: IconeDoMarco;
  min: number;
  t: string;
  /** Uma linha, embaixo do título no cartão "agora" do mapa. */
  sub: string;
  /** Os dias da versão de 05/10 que viraram este marco (vazio = missão nova). */
  antigos: number[];
  destino: Destino;
  btn: string;
  confere: Confere;
  /** "Precisa de ajuda?": o caminho de toques, fechado por padrão. */
  passos: string[];
  travou: string | null;
  /** O que o app passa a fazer, no "O que já mudou no seu SPI" depois do marco. Sempre verdade. */
  mudou: string[];
  aula: string;
};

export const TOTAL_DE_MARCOS = 21;

export const SEMANAS = [
  {
    n: 1 as const,
    nome: "Enxergar",
    historia: "O mês que sumiu",
    resumo: "Para onde vai o seu dinheiro",
  },
  {
    n: 2 as const,
    nome: "Organizar",
    historia: "Um destino pra cada real",
    resumo: "Um destino para cada real",
  },
  {
    n: 3 as const,
    nome: "Manter",
    historia: "O mês que fechou",
    resumo: "Um jeito simples de repetir",
  },
];

export const MARCOS: Marco[] = [
  // ===== Semana 1 · Enxergar =====
  { n: 1, semana: 1, icone: "extrato", min: 10, t: "Traga seus gastos", sub: "eu te mostro seu retrato na hora", antigos: [1, 3], destino: "tela",
    btn: "Trazer meu extrato", confere: "manual", aula: "Custo de vida",
    passos: ["Toque em + {Registrar} › {Importar}", "Escolha {Extrato} e o arquivo dos últimos 3 meses", "Revise só o que o app não reconheceu", "Volte aqui e veja o seu retrato"],
    travou: "Muitos gastos para revisar? Dá para importar agora e escolher as categorias depois.",
    mudou: ["Seu extrato está no app", "O seu retrato ficou pronto"] },
  { n: 2, semana: 1, icone: "cartao", min: 5, t: "A fatura do cartão", sub: "as parcelas entram sozinhas", antigos: [2], destino: "tela",
    btn: "Trazer minha fatura", confere: "auto", aula: "Débito ou crédito?",
    passos: ["Toque em + {Registrar} › {Importar}", "Escolha {Fatura}, o arquivo e o mês", "Revise o que o app não reconheceu", "Toque em Importar"],
    travou: "Escolheu Extrato sem querer? O app avisa antes, porque fatura lida como extrato vira renda.",
    mudou: ["As parcelas dos próximos meses já estão no app", "O pagamento da fatura não conta duas vezes"] },
  { n: 3, semana: 1, icone: "raiox", min: 5, t: "Os pequenos que viram grandes", sub: "o que se repete no seu extrato", antigos: [4], destino: "tela",
    btn: "Ver o que eu achei", confere: "manual", aula: "Diagnosticar os gastos",
    passos: ["Para cada cobrança, escolha: manter, metade ou cortar", "Cancele de verdade o que marcou para cortar"],
    travou: "No mês seguinte o app pergunta se cancelou mesmo.",
    mudou: ["O Raio-X guardou o que você decidiu", "No mês que vem eu pergunto se cancelou mesmo"] },
  { n: 4, semana: 1, icone: "fixas", min: 5, t: "O que já tem dono", sub: "as contas fixas e 1 para negociar", antigos: [5], destino: "tela",
    btn: "Confirmar", confere: "manual", aula: "Reduzir despesas fixas",
    passos: ["Confira a lista: o que não é fixo, toque em Não é fixa", "Escolha 1 conta para negociar", "Ligue ou abra o chat da empresa"],
    travou: "Conta paga em dinheiro ou por outra pessoa? Anote em Contas a pagar.",
    mudou: ["Suas contas fixas ficaram somadas", "A conta para negociar ficou anotada"] },
  { n: 5, semana: 1, icone: "escapa", min: 3, t: "Onde o dinheiro escapa", sub: "um teto na categoria que mais passa", antigos: [6], destino: "tela",
    btn: "Pôr o teto", confere: "manual", aula: "Alimentação inteligente",
    passos: ["Veja a categoria que mais passa da régua", "Ponha um teto nela até o fim do mês", "Escolha 1 dica para esta semana"],
    travou: null,
    mudou: ["O teto vale até o fim do mês", "O {Foco} avisa quando chegar perto"] },
  { n: 6, semana: 1, icone: "voz", min: 2, t: "O que não passa pelo extrato", sub: "lançar falando, em 10 segundos", antigos: [16], destino: "guia",
    btn: "{GravarAudio}", confere: "auto", aula: "Disciplina: método simples",
    passos: ["Toque em + {Registrar} › {GravarAudio}", "Fale: \"pão, 12 reais, dinheiro\"", "Confira e salve"],
    travou: "O app pediu o microfone? Toque em Permitir. É uma vez só.",
    mudou: ["O gasto em dinheiro entrou no seu mês"] },
  { n: 7, semana: 1, icone: "motivo", min: 3, t: "Seu motivo", sub: "o resumo da semana e o porquê", antigos: [7], destino: "tela",
    btn: "Salvar meu motivo", confere: "manual", aula: "Disciplina: motivo claro",
    passos: ["Veja o resumo da semana", "Escreva o seu motivo", "Ele volta no fim do mapa"],
    travou: "Sem ideia? \"Quero dormir em paz\" já é um ótimo motivo.",
    mudou: ["Seu motivo está guardado", "Ele aparece de novo no fim do mapa"] },

  // ===== Semana 2 · Organizar =====
  { n: 8, semana: 2, icone: "orcamento", min: 10, t: "Monte o seu {orcamento}", sub: "a divisão da aula, na sua renda", antigos: [10], destino: "guia",
    btn: "Montar o {orcamento}", confere: "auto", aula: "Distribuição do orçamento",
    passos: ["{Orcamento}", "Toque em {Sugerir}", "Ajuste o que não combina com a sua vida", "Salvar"],
    travou: "A moradia passa dos 30%? Normal em cidade grande. Tire de outra categoria, nunca da liberdade.",
    mudou: ["Cada categoria ganhou um valor", "O {Foco} compara o mês com o plano"] },
  { n: 9, semana: 2, icone: "guardar", min: 5, t: "Guardar primeiro", sub: "a transferência automática no banco", antigos: [11], destino: "tela",
    btn: "Fiz a transferência automática", confere: "manual", aula: "Distribuição do orçamento",
    passos: ["Confira quanto guardar por mês", "No app do banco, programe a transferência para o dia do salário", "Volte e toque em Fiz"],
    travou: "18% não cabe agora? Comece com 5%. O hábito vale mais que o valor.",
    mudou: ["O guardar sai antes de qualquer gasto"] },
  { n: 10, semana: 2, icone: "reserva", min: 3, t: "Sua reserva", sub: "o alvo pelos seus 3 meses", antigos: [9], destino: "guia",
    btn: "Definir a reserva", confere: "auto", aula: "Fundo de segurança",
    passos: ["{Metas} › Reserva", "Confira o alvo que o app sugere", "Diga quanto já tem e salve"],
    travou: "Não tem nada guardado? Ponha zero. A reserva começa com o guardar primeiro.",
    mudou: ["A reserva tem um alvo", "O que você guardar entra nela primeiro"] },
  { n: 11, semana: 2, icone: "sonho", min: 5, t: "Seu sonho com preço", sub: "o que é, quanto custa e para quando", antigos: [8], destino: "guia",
    btn: "Criar meu sonho", confere: "auto", aula: "Planejamento de vida",
    passos: ["{Metas} › {NovaMeta}", "O que é, quanto custa e para quando", "Pesou? Mude a data, não desista do sonho"],
    travou: "Não sabe quanto custa? Ponha um valor aproximado e ajuste depois.",
    mudou: ["O sonho tem preço e data", "O app calcula quanto guardar por mês"] },
  { n: 12, semana: 2, icone: "divisao", min: 2, t: "Pra onde vai o guardado", sub: "reserva primeiro, depois o sonho", antigos: [12], destino: "tela",
    btn: "Confirmar", confere: "manual", aula: "Distribuição do orçamento",
    passos: ["Veja a divisão que o app sugere", "Ajuste a data de um sonho se não couber", "Confirme"],
    travou: null,
    mudou: ["O guardado de cada mês tem destino"] },
  { n: 13, semana: 2, icone: "dividas", min: 5, t: "Suas dívidas na mesa", sub: "tudo num lugar só, sem susto", antigos: [], destino: "tela",
    btn: "Tudo na mesa", confere: "manual", aula: "Dívidas",
    passos: ["Cadastre cada dívida em Dívidas", "Veja o selo de cada uma", "O app mostra quando você fica livre"],
    travou: "Não sabe a taxa? Toque em Não sei: o app usa a do tipo de dívida.",
    mudou: ["As dívidas ficam num lugar só", "O app mostra a data em que você fica livre"] },
  { n: 14, semana: 2, icone: "regra", min: 3, t: "A regra do cartão", sub: "a próxima fatura e a sua regra", antigos: [13], destino: "tela",
    btn: "Salvar minha regra", confere: "manual", aula: "Débito ou crédito?",
    passos: ["Veja a próxima fatura: ela cabe inteira?", "Escolha a sua regra do cartão"],
    travou: "A fatura não cabe? Não pague o mínimo: fale com o banco antes do vencimento.",
    mudou: ["Sua regra do cartão está guardada", "Ela volta no fim do mapa"] },

  // ===== Semana 3 · Manter =====
  { n: 15, semana: 3, icone: "semana", min: 3, t: "Seu livre da semana", sub: "quanto dá para gastar até domingo", antigos: [14], destino: "tela",
    btn: "Acompanhar toda semana", confere: "manual", aula: "Como fazer o planejamento",
    passos: ["Veja o livre para gastar por semana", "Escolha acompanhar toda semana"],
    travou: null,
    mudou: ["O {Foco} mostra o livre da semana"] },
  { n: 16, semana: 3, icone: "espera", min: 3, t: "A regra das 24 horas", sub: "uma compra, decidida com calma", antigos: [15], destino: "guia",
    btn: "Abrir {PossoComprar}", confere: "auto", aula: "Consumo consciente",
    passos: ["Toque em + {Registrar} › {PossoComprar}", "O que é, quanto custa e como paga", "Sem mentir pra mim", "Se for impulso: {DecidirAmanha}"],
    travou: "Nenhuma compra em vista? Use uma que quase fez no último mês.",
    mudou: ["A compra ficou decidida, sem impulso"] },
  { n: 17, semana: 3, icone: "semgasto", min: 1, t: "Um dia sem gasto à toa", sub: "o app confere no dia seguinte", antigos: [17], destino: "tela",
    btn: "Topo o desafio", confere: "auto", aula: "Consumo consciente",
    passos: ["Amanhã, só o essencial: mercado, transporte, contas", "Lance o que gastar ou suba o extrato depois"],
    travou: "Escorregou? A missão espera e você tenta de novo no outro dia.",
    mudou: ["Um dia inteiro só com o essencial"] },
  { n: 18, semana: 3, icone: "ritual", min: 5, t: "O ritual de 5 minutos", sub: "uma vez por semana, no {Foco}", antigos: [18], destino: "guia",
    btn: "Fazer o ritual", confere: "auto", aula: "Disciplina: hábito",
    passos: ["{Foco} › Seus 5 minutos para o dinheiro", "Passe pelos cartões", "Tome a decisão que o ritual pede"],
    travou: null,
    mudou: ["O ritual da semana está feito"] },
  { n: 19, semana: 3, icone: "alvo", min: 10, t: "Um sonho que funciona", sub: "os 9 passos da aula", antigos: [19], destino: "tela",
    btn: "Salvar", confere: "manual", aula: "Definindo metas que funcionam",
    passos: ["Responda os 9 passos, um por tela", "Uma frase curta basta", "Salve"],
    travou: "Travou num passo? Uma frase curta basta. Melhor feito que perfeito.",
    mudou: ["Os 9 passos do seu sonho estão guardados"] },
  { n: 20, semana: 3, icone: "comparar", min: 5, t: "A semana contra o plano", sub: "o que aconteceu de verdade", antigos: [20], destino: "tela",
    btn: "Entendi", confere: "manual", aula: "Realizado × planejado",
    passos: ["Suba o extrato mais recente (se você não lança tudo na mão)", "Veja a semana contra a sua média"],
    travou: "Lançou tudo à mão ou por voz? Nem precisa subir: o app já tem a semana.",
    mudou: ["A semana ficou comparada com a sua média"] },
  { n: 21, semana: 3, icone: "fim", min: 5, t: "Feche o mês", sub: "o seu plano e o seu cartão", antigos: [21], destino: "tela",
    btn: "Concluir o Money Reset", confere: "manual", aula: "Disciplina: recompensa",
    passos: ["Veja o seu plano", "Escolha uma recompensa pequena, que caiba nele", "Se quiser, compartilhe o cartão"],
    travou: null,
    mudou: ["O seu plano está pronto e mora no app"] },
];

export function marco(n: number): Marco | undefined {
  return MARCOS.find((m) => m.n === n);
}

/** Dia da versão de 05/10 → marco novo (o dia 3, o retrato, entra no marco 1). */
export const MARCO_DO_DIA_ANTIGO: Readonly<Record<number, number>> = Object.fromEntries(MARCOS.flatMap((m) => m.antigos.map((d) => [d, m.n])));

/** Os 9 passos para estruturar a meta, da aula "Definindo metas que funcionam". */
export const PASSOS_DO_SONHO = [
  { t: "Sonho positivo", q: "O que você quer? (o que quer, não o que quer evitar)", ex: "Viajar para o México em agosto de 2027" },
  { t: "Evidência de sucesso", q: "Como vai saber que chegou lá?", ex: "9.600 guardados até julho de 2027" },
  { t: "Específico e realista", q: "Cabe na sua vida de hoje?", ex: "Sim: 960 por mês cabe no que eu guardo" },
  { t: "Recursos", q: "O que você precisa para chegar lá?", ex: "Transferência automática no dia do salário" },
  { t: "Ecologia", q: "Isso é bom para você e para quem está perto?", ex: "Sim, é a viagem da família" },
  { t: "Recompensa emocional", q: "O que te move?", ex: "Orgulho de fazer do jeito certo" },
  { t: "Controle", q: "Depende de você?", ex: "Sim, depende do meu guardar" },
  { t: "Identidade", q: "Você quer de verdade? Quem você vai ser?", ex: "Alguém que cuida bem do próprio dinheiro" },
  { t: "Plano de ação", q: "Qual é a rotina?", ex: "Segunda revisar os gastos, sábado os limites" },
];

export const REGRAS_DO_CARTAO = [
  { chave: "orcamento", t: "Cartão só para o que está no {orcamento}", sub: "Fatura sempre inteira, nunca o mínimo" },
  { chave: "debito", t: "Débito no dia a dia", sub: "Cartão só para as contas fixas" },
  { chave: "sem_juros", t: "Parcelar só sem juros", sub: "E só o que dura mais que as parcelas" },
] as const;

export const DICAS_DA_SEMANA = [
  { chave: "cardapio", t: "Cardápio da semana", sub: "No domingo, e mercado só com o necessário" },
  { chave: "lista", t: "Lista no mercado", sub: "Só compra o que está na lista" },
  { chave: "marmita", t: "Marmita 3 vezes", sub: "Leva de casa 3 dias da semana" },
] as const;

/** Motivos de um toque (missão 7): a pessoa pode escrever o dela. Sem gênero. */
export const MOTIVOS_PRONTOS = ["Quero dormir em paz", "Quero sair das dívidas", "Quero viajar sem culpa", "Quero ter uma reserva"] as const;

/**
 * Os nomes de tela e de botão NO TEMA DA PESSOA (revisão da Dani, 05/10: "faça coisas que façam
 * sentido"). O "+" é "Registrar" no Padrão; "Gravar áudio" muda de nome no Girly. O guia e o passo
 * a passo dizem o nome que está NA TELA, lido da própria voz do tema, sem os emojis e sem o
 * "(PDF, Excel...)".
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
