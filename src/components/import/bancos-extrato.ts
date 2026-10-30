/**
 * "Como tiro o extrato do meu banco?", banco por banco.
 *
 * É instrução, não voz: o caminho no app do banco é o mesmo em qualquer tema (como o passo a
 * passo do microfone no Safari). Por isso fica aqui, fixo, e só o título e o aviso passam pela
 * voz do tema.
 *
 * Conferido em set/2026 nas páginas de ajuda dos bancos e em tutoriais recentes. Os apps mudam
 * de menu sem aviso: onde o caminho não é certo, o texto diz o que PROCURAR ("Exportar",
 * "Compartilhar") em vez de prometer um nome de botão. Mercado Pago em PDF ainda não tem leitor
 * no app, por isso lá a indicação é Excel ou CSV.
 */
export type ComoBaixar = { banco: string; extrato: string; fatura?: string; dica?: string };

export const BANCOS_EXTRATO: ComoBaixar[] = [
  {
    banco: "Nubank",
    extrato: "No app, toque em Conta › Pedir extrato, escolha o período e toque em Exportar extrato. Ele chega no seu e-mail (dá para escolher PDF, OFX ou CSV).",
    fatura: "Cartão de crédito › escolha a fatura fechada › Enviar fatura por e-mail. A fatura também chega sozinha no e-mail todo mês.",
  },
  {
    banco: "Itaú",
    extrato: "No app, abra o extrato e procure a opção de salvar ou compartilhar em PDF. Se não aparecer, pelo site no computador: Conta corrente › Extrato por período › Salvar em PDF.",
    fatura: "Em Cartões, abra a fatura e procure a opção de baixar ou ver em PDF.",
  },
  {
    banco: "Inter",
    extrato: "No app ou no site, abra o Extrato, escolha o período e toque em Exportar (PDF, OFX ou CSV).",
    fatura: "Em Cartões › Faturas, abra a fatura e procure a opção de baixar o PDF.",
  },
  {
    banco: "Banco do Brasil",
    extrato: "No app, abra o Extrato da conta, escolha o mês e toque nos três pontinhos ou no ícone de PDF › Salvar ou compartilhar.",
    fatura: "Em Cartões, abra a fatura e procure a opção de salvar ou compartilhar em PDF.",
  },
  {
    banco: "Caixa",
    extrato: "No app, Minha conta › Extrato por período, escolha as datas › Continuar, e toque no botão de compartilhar lá em cima para salvar o PDF.",
    dica: "Se aparecer só a opção de imagem, não serve: baixe pelo site da Caixa no computador.",
  },
  {
    banco: "Bradesco",
    extrato: "No app, toque em Ver extrato ao lado do saldo, escolha o período e use Compartilhar extrato para salvar o PDF.",
    fatura: "Na fatura do cartão, toque em Ver em PDF › Compartilhar e salve no celular.",
  },
  {
    banco: "Santander",
    extrato: "No app, abra o Extrato da conta, escolha o período e procure a opção de gerar, baixar ou compartilhar em PDF.",
    fatura: "Em Cartões, abra a fatura e procure a opção de baixar o PDF.",
  },
  {
    banco: "Mercado Pago",
    extrato: "No app, toque em Ir ao extrato › Consultar transações › três pontinhos › Gerar extrato da conta. Escolha o período e o formato Excel (.xlsx) ou CSV.",
    dica: "O PDF do Mercado Pago eu ainda não leio bem: prefira Excel ou CSV.",
  },
];

/**
 * Quem ganha em euro (e outras moedas de fora) usa banco de lá. Mesmo cuidado do resto do arquivo:
 * onde o menu muda de nome, o texto diz o que PROCURAR.
 */
export const BANCOS_EXTRATO_EURO: ComoBaixar[] = [
  {
    banco: "Wise",
    extrato: "No app, abra o saldo em euro, toque nos três pontinhos e procure Extratos e relatórios (Statements). Escolha o período e baixe em PDF ou CSV.",
    dica: "Os dois servem; o CSV costuma ser o mais completo.",
  },
  {
    banco: "Revolut",
    extrato: "No app, abra a conta em euro, toque em Mais (os três pontinhos) e procure Extrato (Statement). Escolha o período e baixe em PDF, Excel ou CSV.",
  },
  {
    banco: "N26",
    extrato: "No app, procure Extratos (Statements) na sua conta e baixe o PDF do mês. Pelo site também dá para exportar as transações em CSV.",
  },
  {
    banco: "bunq",
    extrato: "No app, abra a conta, procure o botão de exportar (Export) e escolha CSV ou PDF, com o período que quiser.",
  },
  {
    banco: "ING",
    extrato: "No app ou no site, abra a conta e procure Download de transações (ou Extrato). Escolha o período e baixe em CSV ou PDF.",
  },
  {
    banco: "Millennium bcp",
    extrato: "No site do banco, em Consultas › Movimentos, escolha o período e procure Exportar para Excel ou PDF.",
  },
  {
    banco: "Caixa Geral (CGD)",
    extrato: "No site, em Contas › Movimentos, escolha o período e procure Exportar (Excel, CSV ou PDF).",
  },
  {
    banco: "Santander",
    extrato: "No site ou app, abra os movimentos da conta, escolha o período e procure Descarregar ou Exportar (PDF, Excel ou CSV).",
  },
];
