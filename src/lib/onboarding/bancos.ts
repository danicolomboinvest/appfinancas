/**
 * O passo a passo de baixar o extrato e a fatura, banco por banco (pedido da dona, 11/10/2026).
 *
 * Regra: só entra caminho tirado da central de ajuda OFICIAL do banco (domínio dele), com a fonte
 * e a data da leitura. Onde não achei fonte oficial confiável, fica o caminho genérico e o banco
 * aparece em `semFonteOficial` (lista interna para conferir de novo). Nenhum menu foi inventado.
 * Os apps mudam de menu sem aviso: revisar a cada 3 meses.
 *
 * `leMelhor` vem dos leitores que já existem no app (src/lib/import/statement-parser.ts,
 * LEITORES_PDF): banco com leitor próprio de PDF lê melhor em PDF; os outros, pelo arquivo
 * estruturado que o banco exporta (OFX, CSV ou Excel), que o leitor genérico lê bem.
 */

export type Caminho = {
  /** Os três toques, como aparecem no app: [botão ou menu, explicação curta]. */
  passos: [string, string][];
  /** Em que formato sai, como a ajuda oficial diz. Nulo quando a ajuda não diz. */
  formatos: string | null;
  /** Um recado curto do próprio caminho (chega por e-mail, só fatura fechada...). */
  nota?: string;
};

export type FonteOficial = { url: string; titulo: string; lidaEm: string };

export type PassoAPassoDoBanco = {
  extrato: Caminho | null;
  fatura: Caminho | null;
  /** O formato que o SPI lê melhor deste banco. */
  leMelhor: string;
  fontes: FonteOficial[];
};

const LIDA = "11/10/2026";

/**
 * O genérico, para quando não há fonte oficial e para "Meu banco não está aqui": nada de menu
 * inventado, só o que todo app de banco tem (texto da dona, 14/10/2026).
 */
export const CAMINHO_GENERICO: Caminho = {
  passos: [
    ["Extrato ou Fatura", "Procure no app"],
    ["Exportar", "Escolha o mês"],
    ["PDF ou CSV", "Salve no celular"],
  ],
  formatos: null,
  nota: "No app do seu banco, procure Extrato ou Fatura › Exportar › PDF ou CSV.",
};

export const PASSO_A_PASSO: Record<string, PassoAPassoDoBanco> = {
  nubank: {
    extrato: { passos: [["Conta", "Toque no saldo"], ["Pedir extrato", "Escolha o mês"], ["Exportar extrato", "Chega no e-mail"]], formatos: "PDF ou OFX", nota: "O arquivo chega no seu e-mail." },
    fatura: null,
    leMelhor: "PDF",
    fontes: [
      { url: "https://blog.nubank.com.br/extrato-bancario/", titulo: "Extrato bancário: entenda as informações do documento (Blog Nubank)", lidaEm: LIDA },
      { url: "https://comunidade.nubank.com.br/novidades/post/exporte-extratos-diretamente-de-sua-conta-nubank-pelo-app-rbRYnw8qndyPd2S", titulo: "Exporte extratos diretamente de sua conta Nubank pelo app (NuCommunity)", lidaEm: LIDA },
    ],
  },
  itau: {
    extrato: { passos: [["Acessar extrato", "Na tela inicial"], ["Seta para baixo", "No extrato"], ["Gerar extrato", "Escolha o período"]], formatos: null },
    fatura: { passos: [["Cartões", "Em produtos"], ["Acessar fatura", "Abra a fatura"], ["Baixar fatura", "Salve no celular"]], formatos: null },
    leMelhor: "PDF",
    fontes: [
      { url: "https://www.itau.com.br/atendimento-itau/para-voce/conta-corrente/como-consultar-o-meu-extrato-itau-e-o-que-significam-as-siglas-do-extrato", titulo: "Como consultar o meu extrato Itaú (cópia do Web Archive de 11/03/2026; a página saiu do ar)", lidaEm: LIDA },
      { url: "https://www.itau.com.br/cartoes/servicos/fatura-digital", titulo: "Consultar Fatura, Itaú", lidaEm: LIDA },
    ],
  },
  inter: {
    extrato: { passos: [["Saldo", "Na conta"], ["Seta para baixo", "No alto, à direita"], ["Enviar por e-mail", "Chega no e-mail"]], formatos: "PDF, CSV ou OFX" },
    fatura: { passos: [["Cartões", "No Super App"], ["Fatura", "No topo, escolha o mês"], ["Exportar fatura", "Só fatura fechada"]], formatos: "PDF" },
    leMelhor: "PDF",
    fontes: [
      { url: "https://ajuda.inter.co/conta-digital-pessoa-fisica-e-mei/como-acessar-o-extrato-da-conta-digital-pf-kids-ou-you", titulo: "Como acessar o extrato da Conta Digital PF, Kids ou You?", lidaEm: LIDA },
      { url: "https://ajuda.inter.co/cartao/como-emitir-a-segunda-via-da-fatura-do-cartao-de-credito/", titulo: "Como emitir a segunda via da fatura do cartão de crédito?", lidaEm: LIDA },
    ],
  },
  bb: {
    extrato: null,
    fatura: { passos: [["Cartão", "No menu"], ["Consultar fatura", "Abra a fatura"], ["Receber por e-mail", "Chega no e-mail"]], formatos: null },
    leMelhor: "PDF",
    fontes: [{ url: "https://www.bb.com.br/site/fatura-digital/", titulo: "Fatura Digital, Portal BB", lidaEm: LIDA }],
  },
  caixa: {
    extrato: null,
    fatura: { passos: [["Faturas", "No app Cartões CAIXA"], ["Mês da fatura", "Fatura fechada"], ["Fatura em PDF", "Abra ou compartilhe"]], formatos: "PDF", nota: "A fatura fica no app Cartões CAIXA, separado do app CAIXA." },
    leMelhor: "PDF",
    fontes: [{ url: "https://www.caixa.gov.br/Downloads/Cartilha_App_Cartoes_Caixa/cartilha-app-cartoes-caixa.pdf", titulo: "Cartilha App Cartões CAIXA (p. 35 e 37)", lidaEm: LIDA }],
  },
  bradesco: {
    extrato: null,
    fatura: { passos: [["Cartões", "No app Bradesco"], ["Fatura do cartão", "Abra a fatura"], ["Ver em PDF", "E compartilhe"]], formatos: "PDF" },
    leMelhor: "PDF",
    fontes: [{ url: "https://banco.bradesco/html/principal/cartoes/servicoseseguros/2-via-da-fatura/", titulo: "2ª via da fatura, Banco Bradesco", lidaEm: LIDA }],
  },
  santander: {
    extrato: null,
    fatura: { passos: [["Cartões", "Na barra de baixo"], ["Pagar ou ver fatura", "Escolha a fatura"], ["Gerar PDF", "Salve a fatura"]], formatos: "PDF" },
    leMelhor: "PDF",
    fontes: [{ url: "https://www.santander.com.br/blog/entenda-sua-fatura-digital", titulo: "Entenda sua fatura digital Santander (Blog Santander)", lidaEm: LIDA }],
  },
  wise: {
    extrato: { passos: [["Saldo", "Abra a moeda"], ["Três pontinhos", "No alto, à direita"], ["Extratos e relatórios", "Tipo e período"]], formatos: "PDF, CSV ou Excel", nota: "Até 365 dias por extrato." },
    fatura: null,
    leMelhor: "CSV",
    fontes: [{ url: "https://wise.com/br/help/articles/2736049", titulo: "Como posso baixar um extrato? (Wise)", lidaEm: LIDA }],
  },
  binance: {
    extrato: { passos: [["Ativos", "Abra a carteira"], ["Histórico", "Meus trades"], ["Download", "Período e exportar"]], formatos: "CSV" },
    fatura: null,
    leMelhor: "CSV",
    fontes: [{ url: "https://www.binance.com/pt-BR/support/faq/detail/990afa0a0a9341f78e7a9298a9575163", titulo: "Como gerar o histórico de transações? (Binance)", lidaEm: LIDA }],
  },
  mercadobitcoin: {
    extrato: { passos: [["Conta", "Veja no app"], ["Extrato", "No site, no computador"], ["Ícone de baixar", "Ao lado do ano"]], formatos: null, nota: "No app dá só para ver. Para baixar, use o site do Mercado Bitcoin." },
    fatura: null,
    leMelhor: "CSV",
    fontes: [{ url: "https://central.ajuda.mercadobitcoin.com.br/servicedesk/customer/portal/22/article/489521310", titulo: "Extrato (Central de ajuda Mercado Bitcoin)", lidaEm: LIDA }],
  },
  xp: {
    extrato: null,
    fatura: { passos: [["Banco", "Aba do app"], ["Mostrar mais", "Em Meus cartões"], ["Acessar fatura", "Veja a fatura"]], formatos: "PDF", nota: "O PDF da fatura também chega por e-mail. A senha são os 5 primeiros dígitos do CPF." },
    leMelhor: "PDF",
    fontes: [
      { url: "https://atendimento.xpi.com.br/artigo/4478", titulo: "Como o cliente acessa os gráficos de gastos da fatura no app? (XP)", lidaEm: LIDA },
      { url: "https://atendimento.xpi.com.br/artigo/3047", titulo: "Como e quando é feito o envio de fatura em PDF? (XP)", lidaEm: LIDA },
    ],
  },
  btg: {
    extrato: { passos: [["Menu", "Embaixo, à direita"], ["Conta", "Abra a conta"], ["Exportar extrato", "Escolha o período"]], formatos: "PDF ou Excel" },
    fatura: { passos: [["Menu", "Embaixo, à direita"], ["Cartão", "Toque no mês"], ["Baixar fatura", "Só fatura fechada"]], formatos: "PDF" },
    leMelhor: "Excel",
    fontes: [
      { url: "https://banking.btgpactual.com/ajuda/contacorrente/extrato", titulo: "Ajuda: Extrato (BTG Pactual Banking)", lidaEm: LIDA },
      { url: "https://banking.btgpactual.com/ajuda/cartao/fatura", titulo: "Ajuda: Fatura (BTG Pactual Banking)", lidaEm: LIDA },
    ],
  },
  mp: {
    extrato: { passos: [["Ir ao extrato", "Abaixo do saldo"], ["Consultar transações", "No Extrato"], ["Gerar extrato da conta", "Nos três pontinhos"]], formatos: "PDF, Excel ou CSV" },
    fatura: null,
    leMelhor: "CSV",
    fontes: [{ url: "https://www.mercadopago.com.br/blog/como-obter-extrato-mercado-pago", titulo: "Como obter um extrato do Mercado Pago? (Blog Mercado Pago)", lidaEm: LIDA }],
  },
  c6: {
    extrato: { passos: [["Ver extrato", "Na tela inicial"], ["Exportar extrato", "Escolha o período"], ["Gerar extrato", "Chega no e-mail"]], formatos: "PDF", nota: "O PDF chega no e-mail com senha." },
    fatura: { passos: [["Cartões", "Aba do cartão"], ["Acessar fatura", "Escolha a fatura"], ["Baixar fatura", "Em PDF"]], formatos: "PDF", nota: "Só fatura fechada. O PDF vem com senha." },
    leMelhor: "PDF",
    fontes: [
      { url: "https://ajuda.c6bank.com.br/s/article/Como-exportar-o-extrato", titulo: "Como exportar o extrato? (Ajuda C6 Bank; página fechada para leitura direta, lida pelo resumo do buscador)", lidaEm: LIDA },
      { url: "https://ajuda.c6bank.com.br/s/article/Como-consultar-as-faturas-no-app-C6-Bank", titulo: "Como consultar as faturas no app C6 Bank (Ajuda C6 Bank)", lidaEm: LIDA },
    ],
  },
  picpay: {
    extrato: { passos: [["Ver extrato", "Na tela inicial"], ["Baixar extrato", "Em Serviços"], ["Gerar novo extrato", "Escolha o período"]], formatos: "PDF ou CSV", nota: "Também chega no seu e-mail em até 30 minutos." },
    fatura: null,
    leMelhor: "PDF",
    fontes: [{ url: "https://meajuda.picpay.com/hc/pt-br/articles/4408499088525-Como-eu-baixo-o-meu-extrato-da-conta-PicPay-em-PDF", titulo: "Como baixar o extrato em PDF? (Me ajuda PicPay)", lidaEm: LIDA }],
  },
  pagbank: {
    extrato: { passos: [["Extratos", "No rodapé"], ["Três pontinhos", "No alto"], ["Exportar extrato", "Período e formato"]], formatos: "PDF, Excel, CSV ou OFX" },
    fatura: { passos: [["Cartões", "Escolha o cartão"], ["Ver fatura", "Toque no cartão"], ["Enviar fatura por e-mail", "Chega no e-mail"]], formatos: null },
    leMelhor: "OFX",
    fontes: [
      { url: "https://faq.pagbank.com.br/duvida/como-fazer-o-download-do-extrato-da-conta/1714", titulo: "Como fazer o download do extrato da conta? (FAQ PagBank)", lidaEm: LIDA },
      { url: "https://faq.pagbank.com.br/duvida/como-ver-e-pagar-a-fatura-do-cartao/649", titulo: "Como ver e pagar a fatura do cartão? (FAQ PagBank)", lidaEm: LIDA },
    ],
  },
  original: {
    extrato: { passos: [["Ver extrato", "No app do PicPay"], ["Baixar extrato", "Em Serviços"], ["Gerar novo extrato", "Escolha o período"]], formatos: "PDF ou CSV", nota: "A conta pessoa física do Original agora é PicPay: use o app do PicPay." },
    fatura: null,
    leMelhor: "PDF",
    fontes: [
      { url: "https://www.original.com.br/", titulo: "Banco Original: pessoa física agora é PicPay", lidaEm: LIDA },
      { url: "https://meajuda.picpay.com/hc/pt-br/articles/4408499088525-Como-eu-baixo-o-meu-extrato-da-conta-PicPay-em-PDF", titulo: "Como baixar o extrato em PDF? (Me ajuda PicPay)", lidaEm: LIDA },
    ],
  },
  sicredi: { extrato: null, fatura: null, leMelhor: "PDF", fontes: [] },
  sicoob: { extrato: null, fatura: null, leMelhor: "OFX", fontes: [] },
  eqi: { extrato: null, fatura: null, leMelhor: "PDF", fontes: [] },
  agora: { extrato: null, fatura: null, leMelhor: "PDF", fontes: [] },
};

/** O caminho que a tela mostra: o oficial, ou o genérico quando não há fonte. */
export function caminhoDoExtrato(chave: string): Caminho {
  return PASSO_A_PASSO[chave]?.extrato ?? CAMINHO_GENERICO;
}

export function caminhoDaFatura(chave: string): Caminho | null {
  return PASSO_A_PASSO[chave]?.fatura ?? null;
}

export function leMelhor(chave: string): string {
  return PASSO_A_PASSO[chave]?.leMelhor ?? "PDF";
}

/** Lista interna: bancos cujo EXTRATO ficou no caminho genérico (sem fonte oficial). */
export function semFonteOficial(chaves: string[]): string[] {
  return chaves.filter((k) => !PASSO_A_PASSO[k]?.extrato);
}
