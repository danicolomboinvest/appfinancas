/**
 * O manual do SPI Finance: as regras que o app segue e que ninguém descobre sozinha (extrato ×
 * fatura, o pagamento da fatura, o que não duplica, o que só vale depois do Salvar…).
 *
 * Uma fonte só pra dois lugares: a página /guia (com os nomes das abas do tema da pessoa) e o
 * PDF (scripts/gerar-manual-pdf.tsx, com os nomes do tema Padrão). Mudou uma regra no app?
 * Muda aqui e gera o PDF de novo.
 *
 * Os nomes que mudam de tema pra tema vão entre chaves: {foco}, {mensal}, {orcamento},
 * {metas}, {carteira} e {guardar} (o tipo de lançamento de dinheiro guardado).
 * Sem jargão de investidor: o Girly não diz "aporte", "patrimônio", "rentabilidade".
 */

export type IconeDoManual =
  | "rocket"
  | "file"
  | "cards"
  | "copy"
  | "check"
  | "undo"
  | "plus"
  | "wallet"
  | "target"
  | "piggy"
  | "bag"
  | "users"
  | "alert";

export type BlocoDoManual =
  | { tipo: "passos"; itens: { titulo: string; texto: string }[] }
  | { tipo: "comparacao"; colunas: { titulo: string; subtitulo: string; itens: string[] }[] }
  | { tipo: "regras"; itens: { texto: string; atencao?: boolean }[] }
  | { tipo: "dica"; texto: string; alerta?: boolean };

export type SecaoDoManual = {
  id: string;
  icone: IconeDoManual;
  titulo: string;
  resumo: string;
  blocos: BlocoDoManual[];
  /** Some no perfil Empresa (o "Posso comprar?" não existe lá). */
  soPessoa?: boolean;
};

export const SECOES_DO_MANUAL: SecaoDoManual[] = [
  {
    id: "comecar",
    icone: "rocket",
    titulo: "Comece por aqui",
    resumo: "Três passos, e o app passa a trabalhar pra você.",
    blocos: [
      {
        tipo: "passos",
        itens: [
          { titulo: "Monte o seu {orcamento}", texto: "Quanto entra por mês, quanto você quer guardar e como dividir o resto. No fim, toque em Salvar." },
          { titulo: "Traga os seus gastos", texto: "Suba o extrato do banco e a fatura do cartão no botão +, em Importar arquivo. Ou digite um por um." },
          { titulo: "Olhe o {foco} toda semana", texto: "São 5 minutos: quanto ainda dá pra gastar e o que precisa da sua atenção." },
        ],
      },
    ],
  },
  {
    id: "extrato-ou-fatura",
    icone: "file",
    titulo: "Extrato ou fatura?",
    resumo: "Antes de subir um arquivo, o app pergunta o que ele é. Escolher certo muda tudo.",
    blocos: [
      {
        tipo: "comparacao",
        colunas: [
          {
            titulo: "Extrato",
            subtitulo: "a conta do banco",
            itens: [
              "Tudo que entrou e saiu da conta",
              "Entrada vira renda, saída vira gasto",
              "Cada lançamento cai no mês da própria data",
              "Aplicação e caixinha viram dinheiro guardado sozinhas",
              "Transferência pra você mesma e resgate: o app pergunta",
            ],
          },
          {
            titulo: "Fatura",
            subtitulo: "o cartão de crédito",
            itens: [
              "Todas as compras do cartão",
              "Toda compra vira gasto",
              "Crédito na fatura vira estorno e abate o gasto",
              "Tudo cai no mês que você escolher em \"De qual mês é esta fatura?\"",
              "\"Parcela 3 de 10\" já cria as próximas nos meses seguintes",
            ],
          },
        ],
      },
      { tipo: "dica", alerta: true, texto: "Fatura subida como extrato faz as compras virarem renda. Se o arquivo parecer do outro tipo, o app avisa antes: leia e escolha com calma." },
    ],
  },
  {
    id: "extrato-e-fatura",
    icone: "cards",
    titulo: "Posso subir o extrato e a fatura do mesmo mês?",
    resumo: "Pode, e é o jeito mais completo. Só tem um cuidado: o pagamento da fatura.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "No extrato aparece \"Pagamento da fatura\". Se a fatura também está no app, esse pagamento não pode contar: as compras já estão lá, uma por uma." },
          { texto: "Fatura subida antes do extrato: o pagamento fica de fora sozinho. Se precisar, toque em \"Contar mesmo assim\"." },
          { texto: "Fatura subida depois do extrato: no fim, o app mostra o pagamento e pergunta. Toque em Remover." },
          { texto: "Não usa fatura? Aí o pagamento conta como gasto, e está certo assim." },
        ],
      },
      { tipo: "dica", texto: "Na dúvida, suba sempre os dois: o extrato mostra o dinheiro da conta, e a fatura mostra onde o cartão foi usado." },
    ],
  },
  {
    id: "sem-duplicar",
    icone: "copy",
    titulo: "Subir de novo não duplica",
    resumo: "Pode subir o extrato toda semana e depois o do mês inteiro.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "O mesmo arquivo duas vezes: o que já está no app é pulado." },
          { texto: "Extrato da semana e depois o do mês (até em formatos diferentes): o app confere data e valor e não repete." },
          { texto: "Algo que você digitou e também veio no extrato (mesmo valor, até 3 dias de diferença): o app pergunta se é o mesmo." },
          { texto: "Linhas iguais dentro do mesmo arquivo aparecem em \"Repetidos no arquivo\", com o botão \"Deixar só 1\"." },
        ],
      },
    ],
  },
  {
    id: "revisao",
    icone: "check",
    titulo: "A tela de revisão",
    resumo: "Antes de importar, o app mostra tudo que leu. É aqui que você acerta os detalhes.",
    blocos: [
      {
        tipo: "passos",
        itens: [
          { titulo: "Confira o perfil e o mês", texto: "O perfil aparece no topo do app. Na fatura, confira \"De qual mês é esta fatura?\"." },
          { titulo: "Dê categoria aos gastos novos", texto: "O app pergunta só o que não reconheceu. Gasto pulado sem categoria não é importado." },
          { titulo: "Responda as dúvidas", texto: "Transferência pra você mesma e resgate: o botão Importar só libera depois." },
          { titulo: "Importe", texto: "O que você categorizou hoje, o app acerta sozinho na próxima vez." },
        ],
      },
      {
        tipo: "regras",
        itens: [
          { texto: "Arquivos aceitos: PDF, Excel, CSV e OFX, até 4 MB." },
          { texto: "PDF com senha: quase sempre é o CPF, só números. A senha não fica salva." },
          { texto: "PDF escaneado, foto ou \"imprimir pelo celular\" não funciona. Baixe o PDF pelo app ou site do banco, ou exporte em Excel.", atencao: true },
        ],
      },
    ],
  },
  {
    id: "desfazer",
    icone: "undo",
    titulo: "Errou? Dá pra desfazer",
    resumo: "Nada é definitivo.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "Importação errada: em {mensal}, abra \"Histórico de importações\" e toque em Desfazer. Sai tudo que aquele arquivo criou, até as parcelas futuras." },
          { texto: "Para desfazer, você precisa estar no mesmo perfil em que importou." },
          { texto: "Categoria errada: toque no lançamento e em Editar. Nos importados, o app aprende com a correção." },
        ],
      },
    ],
  },
  {
    id: "lancar",
    icone: "plus",
    titulo: "Lançar à mão (o botão +)",
    resumo: "Pra dinheiro vivo, Pix que não veio no extrato ou o que você quiser registrar na hora.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "Três tipos: Renda, Gasto e \"{guardar}\" (dinheiro que você guardou)." },
          { texto: "A data decide o mês: um gasto com data de agosto vai pra agosto, mesmo lançado em setembro." },
          { texto: "Conta fixa (aluguel, academia): marque \"Repetir todo mês\" e ela é criada até dezembro." },
          { texto: "Pra mudar ou apagar uma conta fixa, o app pergunta: \"Só este mês\" ou \"Este e os próximos meses\". Os meses que já passaram não mudam." },
        ],
      },
    ],
  },
  {
    id: "orcamento",
    icone: "wallet",
    titulo: "{orcamento}: o plano do seu mês",
    resumo: "É ele que diz se o mês está indo bem.",
    blocos: [
      {
        tipo: "passos",
        itens: [
          { titulo: "Quanto entra", texto: "A sua renda do mês." },
          { titulo: "Quanto guardar", texto: "Primeiro você se paga. Os atalhos ajudam a escolher." },
          { titulo: "Dividir o resto", texto: "Entre as categorias. \"Sugerir pra mim\" faz uma primeira divisão." },
        ],
      },
      { tipo: "dica", alerta: true, texto: "Só vale depois de tocar em Salvar. Vale do mês atual em diante; os meses que já passaram ficam como estavam." },
    ],
  },
  {
    id: "foco",
    icone: "target",
    titulo: "{foco}: quanto ainda dá pra gastar",
    resumo: "A primeira tela do app. Mostra o mês de agora.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "\"Livre pra gastar\" é o {orcamento} do mês menos tudo que já saiu, com ou sem categoria." },
          { texto: "No ritmo semanal, o app mostra quanto dá pra gastar nesta semana. No mensal, até o fim do mês." },
          { texto: "Até 3 avisos por vez. \"Ver o que fazer\" resolve ali mesmo: pôr um teto, subir o plano ou marcar como pontual." },
          { texto: "\"Não gastar mais nada\" vira um combinado, e o app mostra se algo entrou depois." },
          { texto: "Mais de 7 dias sem lançar gasto? O número pode estar alto demais: suba o extrato.", atencao: true },
        ],
      },
    ],
  },
  {
    id: "guardar",
    icone: "piggy",
    titulo: "Dinheiro guardado",
    resumo: "Guardar é um lançamento como qualquer outro.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "Lance como \"{guardar}\", ou suba o extrato: aplicação e caixinha entram sozinhas." },
          { texto: "Depois, em {carteira}, diga em quais investimentos o dinheiro entrou. Até lá ele fica \"esperando destino\"." },
          { texto: "Meta: o progresso é o maior entre o que você digitou em \"Já guardado\" e o que o app enxerga. Os dois não somam." },
          { texto: "Reserva de emergência: o \"Já tenho\" é digitado. No fechamento do mês, \"Mandar a sobra pra reserva\" faz isso por você." },
        ],
      },
    ],
  },
  {
    id: "posso-comprar",
    icone: "bag",
    titulo: "Posso comprar?",
    resumo: "Antes de uma compra, pergunte pros seus números.",
    soPessoa: true,
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "O app responde se cabe no mês, se é melhor parcelar ou pagar à vista, e se atrasa alguma meta." },
          { texto: "A regra dos 90%: gastos e parcelas somados até 90% da renda. Os outros 10% são pra você." },
          { texto: "Parcelado com juros acima do que o dinheiro renderia: aviso amarelo, com quanto você paga a mais." },
          { texto: "\"Vou comprar\" não lança o gasto. Quando comprar, lance ou suba o extrato.", atencao: true },
          { texto: "\"Decidir amanhã\": o app te lembra no dia seguinte." },
        ],
      },
    ],
  },
  {
    id: "perfis",
    icone: "users",
    titulo: "Perfis: dinheiro separado",
    resumo: "Pessoal, Casal, Empresa: cada perfil tem os próprios lançamentos, {orcamento} e {metas}.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "Antes de subir um arquivo, olhe o perfil no topo do app. Importar no perfil errado é o erro que mais dá trabalho.", atencao: true },
          { texto: "Uma linha de outro perfil (a compra da empresa no cartão pessoal)? Na revisão, toque em \"→ nome do perfil\"." },
        ],
      },
    ],
  },
  {
    id: "erros-comuns",
    icone: "alert",
    titulo: "Os 6 erros mais comuns",
    resumo: "Se algum número pareceu estranho, quase sempre é um destes.",
    blocos: [
      {
        tipo: "regras",
        itens: [
          { texto: "Subir a fatura como extrato: as compras viram renda.", atencao: true },
          { texto: "Não conferir o mês da fatura: a fatura de agosto cai em setembro.", atencao: true },
          { texto: "Pular a categoria na revisão: o gasto não entra.", atencao: true },
          { texto: "Mexer no {orcamento} e não tocar em Salvar.", atencao: true },
          { texto: "Manter o \"Pagamento da fatura\" junto com a fatura: o gasto conta duas vezes.", atencao: true },
          { texto: "Guardar dinheiro e não dizer onde ele entrou na {carteira}.", atencao: true },
        ],
      },
    ],
  },
];

export type NomesDoTema = { foco: string; mensal: string; orcamento: string; metas: string; carteira: string; guardar: string };

/** Os nomes do tema Padrão: é o que o PDF usa (ele é o mesmo pra todo mundo). */
export const NOMES_PADRAO: NomesDoTema = { foco: "Foco", mensal: "Mensal", orcamento: "Orçamento", metas: "Metas", carteira: "Carteira", guardar: "Aporte" };

export function comNomes(texto: string, nomes: NomesDoTema): string {
  return texto.replace(/\{(foco|mensal|orcamento|metas|carteira|guardar)\}/g, (_, k: keyof NomesDoTema) => nomes[k]);
}
