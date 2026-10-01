/**
 * Saídas e entradas do extrato que NÃO são gasto nem renda: dinheiro dela indo pra ela mesma.
 *
 * O extrato só sabe "saiu" ou "entrou". Sem separar isso, a Visão mensal somava a aplicação na
 * caixinha e o pagamento da fatura como gasto: quem gastou R$ 7.000, pagou a fatura de R$ 4.000
 * pelo banco e guardou R$ 2.000 aparecia com "gastou R$ 13.000".
 *
 * - Aplicação (RDB, CDB, caixinha, Tesouro…): é guardar, vira aporte sozinha.
 * - Resgate: dinheiro voltando da aplicação. Não é renda; a tela pergunta.
 * - Transferência pra conta dela mesma (mesma titularidade, ou o próprio nome): a tela pergunta
 *   se foi gasto, se foi guardar, ou se só mudou de conta.
 * - Pagamento de fatura: fica de fora quando ela importa a fatura (as compras já estão lá, uma a
 *   uma); se ela não importa, continua sendo o gasto do cartão.
 */

const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Dinheiro reservado <nome da reserva>": é como o Mercado Pago chama guardar na caixinha. */
const APLICACAO = /\b(aplicacao|aplic|caixinha|rdb|cdb|lci|lca|tesouro|poupanca|investimento|guardar dinheiro|cofrinho|dinheiro reservado)\b/;
/** As palavras que só dizem "guardei" (o verbo ou o lugar), sem ser nome de produto. */
const APLICACAO_VERBO = /\b(aplicacao|aplic|caixinha|guardar dinheiro|cofrinho|dinheiro reservado)\b/;
/** "Dinheiro retirado <nome da reserva>": a volta da caixinha no Mercado Pago (21 linhas num extrato
 * de agosto entravam como renda). */
const RESGATE_PALAVRA = /\b(resgate|resg|retirada (da|de) caixinha|retirada do cofrinho|resgatad[oa]|dinheiro retirado)\b/;
/**
 * Onde o dinheiro guardado mora. "poupanc" e "poup": o extrato corta ("CRÉD.TRANSF.POUPANÇ",
 * "JUROS POUP AUT").
 */
const PRODUTO = "(poupanc\\w*|poup|caixinhas?|cofrinhos?|cdb|rdb|rdc|tesouro|lci|lca|aplicac\\w*|aplic|investimentos?)";
/**
 * Resgate escrito de outro jeito (30/09/2026): cliente fez uma "retirada" da poupança, o Banco do
 * Brasil escreveu "Transferido da poupança <nome>", e a linha entrou como renda. Cada banco
 * escreve de um jeito, então vale o SENTIDO: o dinheiro vem DA poupança/caixinha/CDB/Tesouro.
 * - "retirada/saque/resgate (da) poupança": sair do produto é sempre resgate;
 * - "transferido/transferência/TED/Pix/crédito DA poupança";
 * - "poupança p/ conta": do produto pra conta corrente;
 * - "créd. transf. poupanç": o crédito que chega na conta.
 * Nunca o contrário ("transferência PARA poupança", "DÉB.TRANSF.POUPANÇA" é aplicação) nem saque
 * comum no caixa eletrônico ("SAQUE CASH", "saque dinheiro ATM" não falam de produto nenhum).
 */
const RESGATE_DE_PRODUTO = new RegExp(
  [
    `\\b(retirada|retir|saque|resgate)\\s+(d[aeo]s?\\s+)?(conta\\s+)?${PRODUTO}`,
    `\\b(transferid[oa]|transferencia|transf|tr|ted|pix|cred|credito)\\s+(d[aeo]s?)\\s+(conta\\s+)?${PRODUTO}`,
    `\\b${PRODUTO}\\s+(p|para|pra)\\s+(a\\s+)?(conta|cc|c c|corrente)\\b`,
    `\\b(cred|credito)\\s+(transf\\w*|tr)\\s+${PRODUTO}`,
  ].join("|"),
);
/** Pontuação vira espaço: "CRÉD.TRANSF.POUPANÇ" e "p/ conta" passam a ser palavras separadas. */
const semPontuacao = (s: string) => s.replace(/[./\\*\-_:]+/g, " ").replace(/\s+/g, " ");
const ehResgateEscrito = (d: string) => RESGATE_PALAVRA.test(d) || RESGATE_DE_PRODUTO.test(semPontuacao(d));
/**
 * Só numa ENTRADA: produto sem direção ("Transf poupança", "Débito poupança"). Chegando dinheiro na
 * conta, só pode ter vindo de lá. Numa saída é o oposto (aplicação), por isso fica fora da regra
 * que a aplicação usa.
 */
const ENTRADA_DE_PRODUTO = new RegExp(`\\b(transf\\w*|transferencia|tr|debito|deb)\\s+(\\w+\\s+)?${PRODUTO}`);
const PARA_O_PRODUTO = new RegExp(`\\b(para|p|pra)\\s+(a\\s+|o\\s+)?${PRODUTO}`);
/** Juros e rendimento da poupança ("JUROS POUP AUT", "REMUNER BASICA POUP"): é ganho, não resgate. */
const RENDIMENTO = /\b(juros|remuner\w*|rendimentos?|rend)\b/;
const CONTA_PROPRIA = /\b(mesma titularidade|entre contas|conta propria|transferencia propria|contas proprias)\b/;
/** Siglas de produto que também são nome de loja ("LCA Modas", "CDB Calçados"). */
const SIGLA_QUE_E_LOJA = /\b(rdb|cdb|lci|lca|tesouro)\b/g;

/**
 * "Aplicação de cílios", "aplicação de botox", "caixinha de som": serviço e produto que usam as
 * mesmas palavras da aplicação. O público do app é majoritariamente feminino, e esse gasto de
 * verdade virava aporte sozinho (saía do gasto do mês e da média da Reserva). Tira esses trechos
 * antes de procurar as palavras de aplicação.
 * - "aplicação de X": só é investimento quando X é do mundo do dinheiro ("de renda fixa", "de
 *   recursos", "de CDB"); "de cílios" é serviço. Só o "de": "aplicação no/na/em" é o lugar
 *   ("na caixinha", "no Tesouro"), e aí é aplicação mesmo.
 * - "caixinha de X": a caixinha do banco tem o nome que ela quiser ("Caixinha Viagem"), então a
 *   regra é o contrário: só sai o que é claramente objeto.
 */
const APLICACAO_QUE_E_SERVICO =
  /\baplic(acao|\.)?\s+d[eoa]s?\s+(?!(renda|recursos?|valor(es)?|saldo|dinheiro|r\$|cdb|rdb|lci|lca|lc|cri|cra|fundos?|poupanca|tesouro|investimentos?|titulos?|cdi|liquidez|caixinha|cofrinho|previdencia|acoes|debentures?|reserva)\b)[a-z]\S*/g;
const CAIXINHA_QUE_E_OBJETO =
  /\bcaixinhas?\s+(d[eoa]s?\s+)?(som|musica|papelao|presente|joias?|remedios?|mdf|madeira|acrilico|bombons?|doces?|chocolates?|costura|ferramentas?|oculos|bluetooth|jbl)\b/g;

/** A descrição sem acento e sem os "falsos amigos" da aplicação (ver acima). */
export function descricaoSemFalsaAplicacao(descricao: string | null | undefined): string {
  return semAcento(descricao ?? "").replace(APLICACAO_QUE_E_SERVICO, " ").replace(CAIXINHA_QUE_E_OBJETO, " ");
}

export function pareceAplicacao(descricao: string | null | undefined): boolean {
  const d = descricaoSemFalsaAplicacao(descricao);
  if (ehResgateEscrito(d)) return false;
  // "LCA", "LCI", "CDB" e "Tesouro" também são nome de loja: o Pix pra "LCA Modas" virava aporte
  // e saía do gasto do mês sem perguntar. Num Pix, essas siglas sozinhas não bastam; o resto
  // continua valendo ("Transferência para poupança", "TED Tesouro Direto" são aplicação).
  if (/\bpix\b/.test(d) && !APLICACAO_VERBO.test(d)) return APLICACAO.test(d.replace(SIGLA_QUE_E_LOJA, " "));
  return APLICACAO.test(d);
}

/**
 * Entrada que parece dinheiro voltando do que ela guardou. Só é chamada com ENTRADAS (a leitura do
 * extrato e a revisão dos antigos perguntam só pra renda): por isso aceita "Transf poupança" sem
 * direção, que numa saída seria aplicação.
 */
export function pareceResgate(descricao: string | null | undefined): boolean {
  const d = semAcento(descricao ?? "");
  const limpa = semPontuacao(d);
  if (RENDIMENTO.test(limpa)) return false;
  if (ehResgateEscrito(d)) return true;
  return ENTRADA_DE_PRODUTO.test(limpa) && !PARA_O_PRODUTO.test(limpa);
}

/**
 * Pagamento da fatura do CARTÃO. É a ÚNICA regra do app pra isso: a leitura do extrato (fica de
 * fora pra quem importa a fatura), a importação da fatura (oferece remover o pagamento já
 * lançado), a revisão dos antigos e o "não é gasto" do planejamento usam esta. Eram duas listas
 * diferentes, e uma aceitava "PGTO FATURA" e a outra não: a mesma linha ficava de fora num lugar
 * e contava em dobro no outro.
 *
 * Os bancos escrevem de vários jeitos: "Pagamento de fatura", "PGTO/PAGTO FATURA", "Pag fatura",
 * "Pagto cartão crédito" (Banco do Brasil, sem a palavra "fatura"), "PAGAMENTO CARTAO". E quem
 * lança à mão escreve como fala: "Fatura Nubank".
 *
 * Conta de consumo também chega como "fatura" ("Pagamento de fatura CLARO", "fatura da luz"): é
 * gasto de verdade. Com o cartão importado, ela ficava de fora sozinha e a conta do celular sumia
 * do mês. A operadora ou o serviço na descrição sempre ganha.
 */
const PAGAR = /\b(pagamento|pagamentos|pagto|pgto|pag|pg)\b/;
const FATURA = /\bfaturas?\b/;
/** "Pagto cartão crédito", "PAGAMENTO DO CARTAO": o verbo colado no cartão (não "pagamento COM cartão"). */
const PAGAR_CARTAO = /\b(pagamento|pagto|pgto|pag|pg)\.?\s+(d[eoa]\s+)?cartao\b(?!\s+(de\s+)?debito)/;
/** Banco ou bandeira: "Fatura Nubank" é o cartão; "Fatura" sozinha com outro nome pode ser boleto de fornecedor. */
const EMISSOR_DE_CARTAO =
  /\b(cartao|credito|nubank|nu|itau|itaucard|bradesco|bradescard|santander|inter|c6|bb|ourocard|caixa|visa|master|mastercard|elo|amex|hipercard|credicard|xp|btg|neon|next|picpay|mercado pago|pan|sicredi|sicoob|original|digio|porto|will|pagbank|pagseguro|banrisul|brb)\b/;
const CONTA_DE_CONSUMO =
  /\b(claro|vivo|tim|oi|net|sky|nextel|algar|telefone|telefonia|celular|operadora|internet|banda larga|luz|energia|eletrica|enel|cemig|copel|celesc|coelba|cpfl|light|equatorial|neoenergia|elektro|energisa|agua|saneamento|sabesp|cedae|copasa|sanepar|embasa|caesb|compesa|gas|comgas|naturgy|condominio|aluguel|escola|faculdade|mensalidade|unimed|amil)\b/;

export function parecePagamentoDeFatura(descricao: string | null | undefined): boolean {
  // "via internet banking", "PAG FATURA VIA INTERNET": é o canal do pagamento, não a conta de
  // internet. E numa linha que fala de cartão/crédito/emissor, "internet" é sempre o canal.
  let d = semAcento(descricao ?? "")
    .replace(/\b(internet|mobile) ?banking\b/g, " ")
    .replace(/\b(via|pelo|pela)\s+(internet|app|aplicativo|celular)\b/g, " ");
  if (/\b(cartao|credito)\b/.test(d) || EMISSOR_DE_CARTAO.test(d)) d = d.replace(/\binternet\b/g, " ");
  if (CONTA_DE_CONSUMO.test(d)) return false;
  if (PAGAR_CARTAO.test(d)) return true;
  return FATURA.test(d) && (PAGAR.test(d) || EMISSOR_DE_CARTAO.test(d));
}

/**
 * Transferência pra ela mesma: a descrição diz ("mesma titularidade"), ou traz o NOME dela (o
 * primeiro e o último nome, pra "Pix enviado - Daniela Colombo" não bater com outra Daniela).
 */
export function pareceContaPropria(descricao: string | null | undefined, nomeDaPessoa: string | null | undefined): boolean {
  const d = semAcento(descricao ?? "");
  if (CONTA_PROPRIA.test(d)) return true;
  // Só as letras do nome: ele vem do perfil (texto livre) e entra num RegExp. Um ")" ou "***"
  // no nome derrubava a leitura do extrato inteiro e a revisão dos antigos.
  const partes = semAcento(nomeDaPessoa ?? "").replace(/[^a-z\s]/g, " ").split(/\s+/).filter((p) => p.length >= 3);
  if (partes.length < 2) return false;
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return /\b(pix|ted|doc|transf|transferencia)\b/.test(d) && new RegExp(`\\b${primeiro}\\b`).test(d) && new RegExp(`\\b${ultimo}\\b`).test(d);
}
