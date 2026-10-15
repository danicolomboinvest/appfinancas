"use server";

import { MSG_CONTA_DE_CONSUMO, pareceContaDeConsumo } from "@/lib/import/conta-de-consumo";
import { ehCasal } from "@/lib/profiles/casal";
import { ehPessoa } from "@/lib/casal/acerto";
import { revalidatePath } from "next/cache";
import { agendarCacaDoDinheiroPerdido } from "@/lib/dinheiro-perdido/agendar";
import { agendarContasDoHistorico } from "@/lib/contas/agendar-contas";
import { agendarAvisoDoCartao } from "@/lib/cartao/agendar";
import { descricaoComparavel, installmentDescription, mesmaParcela, parseInstallment } from "@/lib/entries/recurrence";
import { countMoneyLines, detectInvoiceTotal, looksLikeCardInvoice, MOTIVO_SINAIS_FATURA, periodoSemMovimento, sinaisDesmentemExtrato, type DocKind } from "@/lib/import/detect";
import { MOTIVO_MOVIMENTACAO_B3, profileDocument } from "@/lib/import/profile";
import { veioDeImagem } from "@/lib/import/ocr-marca";
import { checarPlausibilidade, type Suspeita } from "@/lib/import/plausibility";
import { isPartialRead, MARCA_CONFERIDO, MARCA_NAO_FECHOU, mensagemImplausivel, recordImportDiagnostic, safeHeader } from "@/lib/repositories/import-diagnostic.repo";
import { conferirLeitura, leituraIncompleta, type Conferencia } from "@/lib/import/conferencia";
import { storeFailedImportFile } from "@/lib/repositories/import-file.repo";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { MSG_TROCOU_DE_PERFIL, trocouDePerfil } from "@/lib/profiles/perfil-da-tela";
import { prisma } from "@/lib/db/prisma";
import { PREFIXO_COMPRA_APAGADA, PREFIXO_NAO_PARCELA, projecaoRecusada } from "@/lib/contas/parcelas-do-mes";
import { formatMoney } from "@/lib/money";
import { createMonthlyEntry } from "@/lib/repositories/monthly-entry.repo";
import {
  createImportBatch,
  deleteEmptyImportBatch,
  deleteImportBatchWithEntries,
} from "@/lib/repositories/import-batch.repo";
import { garantirCuidadoPessoal, listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listProfiles } from "@/lib/repositories/profile.repo";
import { regrasDePerfil } from "@/lib/repositories/mover-perfil.repo";
import { categoriaNoDestino, destinoPelaRegra } from "@/lib/perfis/mover-lancamentos";
import { descricoesOriginais } from "@/lib/repositories/decisao.repo";
import { aplicarNosOutrosMeses, listTransactionRules, upsertTransactionRule } from "@/lib/repositories/transaction-rule.repo";
import { parseStatementComLeitor, type ParsedTransaction } from "@/lib/import/statement-parser";
import { isFaturaSummaryLine, comprasDaFaturaSaoPositivas, pareceCreditoDePagamento } from "@/lib/import/fatura-lines";
import { extractUploadFromForm, UploadReadError, PasswordRequiredError } from "@/lib/import/extract-text";
import { pdfTextQuality } from "@/lib/import/pdf-quality";
import { type LearnedRule } from "@/lib/import/classify";
import { chaveDoComerciante, chaveUtil, ehLojaDeTudo } from "@/lib/import/comerciante";
import { categoriaDaLinha, type ConfiancaDaCategoria, type MotivoDaCategoria } from "@/lib/import/motor";
import { pareceEstorno } from "@/lib/import/estorno";
import { pareceAplicacao, pareceContaPropria, parecePagamentoDeFatura, pareceResgate } from "@/lib/import/dinheiro-proprio";
import { casarPorDataEValor, type ExistenteSolto } from "@/lib/import/duplicata-solta";
import { casarComLancadosAMao, semNomeUtil, type LinhaDoArquivo } from "@/lib/import/parecido-manual";
import { lidasEmDobro } from "@/lib/import/repetidos";
import { conversaoDaCompra, moedaDeForaValida, type CompraParaPreencher, type MoedaDeFora } from "@/lib/import/moeda-de-fora";
import { bancoDoPrint, comprasDosPrints, juntarPrints, lerPrint, semValorEmReal, type CompraDoPrint, type CompraSemValorEmReal, type PrintLido } from "@/lib/import/print-fatura";
import { casarComFaturaAberta } from "@/lib/import/fatura-aberta";
import { UPLOAD_MAX_BYTES } from "@/lib/import/limites";
import { nomeNaTela } from "@/lib/import/nome-na-tela";
import {
  ajustarAnoDaCompra,
  chaveDoMes,
  contextoDaFatura,
  diaDaParcela,
  lerDatasDaFatura,
  mesDaCompra,
  mesDaData,
  mesesDaMesmaFaturaAntiga,
  mesesDasCompras,
  pagamentoDoCartao,
  pagamentosDaFatura,
  pagamentoTemFatura,
  somarMeses,
  type ContextoDaFatura,
  type Destino,
} from "@/lib/import/mes-da-compra";

const PARENT_CATEGORY_VALUES: ParentCategory[] = [
  "MORADIA",
  "ALIMENTACAO",
  "TRANSPORTE",
  "SAUDE",
  "LAZER",
  "EDUCACAO",
  "IMPOSTOS",
  "OUTROS",
];

/** O tipo do lançamento. O parser só decide entre Renda e Gasto pelo sinal — Aporte é sempre
 * escolha manual na revisão (um Pix pra você mesma cai como gasto/renda pelo sinal, e só você
 * sabe que era pra investimento). */
export type EntryType = "INCOME" | "EXPENSE" | "INVESTMENT_CONTRIBUTION";

export type ReviewItem = {
  /** Chave estável no cliente (índice na lista original). */
  key: number;
  /** Por que o motor pôs (ou não) a categoria, e se ela entra sozinha ("alta") ou vira pergunta (lib/import/motor.ts). */
  motivo?: MotivoDaCategoria;
  confianca?: ConfiancaDaCategoria;
  date: string;
  description: string;
  /** Sempre positivo aqui; o sinal virou `category`. */
  amount: number;
  category: EntryType;
  /** A categoria que o banco escreveu na linha ("Investimentos" no extrato do BTG), quando há. */
  categoriaDoBanco?: string;
  parentCategory: ParentCategory | null;
  /** Categoria personalizada escolhida/criada na revisão (alternativa às 7 categorias-mãe fixas). */
  customCategoryId: string | null;
  subcategory: string | null;
  /** true = classificado automaticamente; false = precisa de revisão manual (categoria vazia). */
  autoClassified: boolean;
  /** Compra parcelada ("03/10" na fatura): as parcelas seguintes entram sozinhas nos meses seguintes. */
  installment: { current: number; total: number; confident: boolean } | null;
  /** Perfil de destino escolhido na revisão (compra da Empresa que caiu no cartão Pessoal, por
   * exemplo). `null` = o perfil ativo de sempre, o padrão pra toda a importação. */
  profileId: string | null;
  /**
   * Estorno: dinheiro de uma compra voltando ("ESTORNO", crédito na fatura). Não é renda: é gasto
   * que deixou de existir. Vai como gasto NEGATIVO na categoria da compra, e a compra e o estorno
   * se anulam em todas as somas.
   */
  estorno?: boolean;
  /** Parece com um lançamento que a pessoa já fez à mão (mesmo valor, data perto), ou com um de
   * outra importação (mesmo dia, valor e tipo, descrição diferente): a tela pergunta.
   * `importado` diz qual dos dois, pra tela não dizer "você lançou" do que veio de arquivo. */
  possivelDuplicata?: {
    descricao: string;
    data: string | null;
    importado?: boolean;
    /** Lançamento à mão: o id e o valor dele. Com "é o mesmo", ele fica com o valor e a data do extrato. */
    id?: string;
    valor?: number;
  } | null;
  /** Já está no app: um lançamento à mão quase certamente igual (lib/import/parecido-manual). Não
   * entra de novo; na gravação, o lançamento à mão fica com o dia e o valor do arquivo. */
  jaNoApp?: {
    descricao: string;
    data: string | null;
    id: string;
    valor: number;
    faturaAberta?: boolean;
    /** Veio de outro arquivo, com o mesmo dia, valor e nome: a gravação pula sozinha (é o mesmo arquivo de novo). */
    importado?: boolean;
    /** Parcela que já está no mês (ver marcarParcelasJaNoApp). Vai junto para a gravação, que a
     * reconhece e confirma a projeção da fatura anterior, mas não conta como compra nova. */
    parcela?: boolean;
  } | null;
  /** Fica de fora da importação (pagamento de fatura de quem importa a fatura, "só mudei de conta"). */
  ignorar?: boolean;
  /** Por que o app tratou a linha diferente ("Aplicação: entra como guardado"). */
  nota?: string | null;
  /** Dinheiro que pode ser dela mesma: a tela pergunta antes de importar. */
  duvida?: "conta_propria" | "resgate" | null;
  /** Resgate: dinheiro voltando do que ela guardou. Grava como guardado NEGATIVO (ver
   * lib/entries/resgate.ts) e a carteira pergunta de qual investimento saiu. */
  resgate?: boolean;
};

/** O que o app entendeu do arquivo, pra pessoa conferir antes de gravar. */
export type ParseStats = {
  /** O que o arquivo parece ser, pelo conteúdo/nome; "unknown" quando não dá pra saber. */
  detectedKind: DocKind;
  detectedReason: string;
  /** O que o app entendeu lendo o arquivo inteiro: "Extrato bancário · Nubank · 01/05 a 14/09/2026". */
  summary: string;
  /** Linhas do arquivo com cara de valor × lançamentos lidos. */
  moneyLines: number;
  parsed: number;
  /** Fatura: total impresso no arquivo, se achado, pra bater com a soma. */
  invoiceTotal: number | null;
  sumExpense: number;
  sumIncome: number;
  /** Sinais de que o app leu o arquivo errado. Vazio = nada estranho. */
  suspeitas: Suspeita[];
  /** A soma lida bateu com o total que o próprio documento imprime? (ver conferencia.ts) */
  conferencia: Conferencia;
  /** Faltou coisa de verdade na leitura — a MESMA régua do relatório diário e do arquivo guardado. */
  leituraIncompleta: boolean;
  /** Fatura: o vencimento impresso no arquivo ("YYYY-MM-DD"), pra tela já sugerir o mês em que
   * ela entra. null quando não é fatura ou o arquivo não diz (ver lib/import/vencimento.ts). */
  vencimento: string | null;
  /** Fatura: o fechamento impresso ("YYYY-MM-DD"), quando o arquivo escreve. */
  fechamento: string | null;
  /** O banco, quando o perfil do arquivo reconhece ("Nubank"). */
  banco: string | null;
  /** Fatura: os meses em que as compras caem ("YYYY-MM"), cada uma no mês em que foi feita. */
  mesesDasCompras: string[];
  /** Fatura: quantas compras (gastos que entram, sem estorno e sem o que fica de fora). */
  compras: number;
  /** Veio de prints da fatura ABERTA: parcial, "N compras até hoje" (ver lib/import/print-fatura). */
  faturaAberta?: boolean;
  /** Prints: compra em moeda estrangeira (US$ 19,00) que a tela não mostra em real. Só entra quando ela digita o valor em real na revisão. */
  semValorEmReal?: CompraParaPreencher[];
};

export type ParseStatementResult =
  | { ok: true; items: ReviewItem[]; customCategories: { id: string; name: string; icon?: string }[]; stats: ParseStats }
  | { ok: false; error: string; needsPassword?: boolean };

/** A conferência vai na mensagem do diagnóstico: é o que o relatório diário e o aviso de suporte
 * leem pra saber se faltou coisa (ver `leituraIncompletaDoRegistro`). */
function mensagemDaConferencia(conf: Conferencia, incompleta: boolean): string | null {
  // O documento importado é em real: o valor impresso nele vem em real, seja qual for a moeda da conta.
  const reais = (n: number) => formatMoney(n, "BRL");
  if (incompleta) {
    return conf.status === "nao-fechou"
      ? `${MARCA_NAO_FECHOU} li ${reais(conf.lido)}, o arquivo diz ${reais(conf.esperado)}`
      : null; // sem total pra conferir: a régua das linhas continua valendo pra esta linha
  }
  return conf.status === "fechou" ? `${MARCA_CONFERIDO} bateu com o total do arquivo (${reais(conf.esperado)})` : MARCA_CONFERIDO;
}

/** A falha em texto curto para o diagnóstico, venha como Error, texto ou objeto. */
function descreverFalha(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 160);
  if (typeof err === "string") return err.slice(0, 160) || "texto vazio";
  try {
    return (JSON.stringify(err) ?? String(err)).slice(0, 160);
  } catch {
    return String(err).slice(0, 160);
  }
}

/** O que a tela diz quando um print não deu: o mesmo para ilegível, cortado e sem nenhum valor. */
const MSG_PRINT_ILEGIVEL = "Não consegui ler este print. Tente com a tela mais clara ou sem zoom.";

export type PrintDaFaturaResult = { ok: true; print: PrintLido; banco: string | null } | { ok: false; error: string };

/**
 * UM print da fatura aberta (captura de tela da lista de compras do app do banco): OCR aqui no
 * servidor e a leitura da lista. Uma imagem por chamada, como a fila de vários arquivos: cada uma
 * leva poucos segundos e nenhuma chamada chega perto do limite de tempo da função. A tela junta
 * os prints e manda tudo de uma vez para `parseStatementAction` (origem "print").
 */
export async function lerPrintDaFaturaAction(formData: FormData): Promise<PrintDaFaturaResult> {
  const ctx = await getRequiredSession();
  const arquivo = formData.get("file");
  const envio = String(formData.get("envio") ?? "");
  const nome = arquivo instanceof File ? arquivo.name : null;
  const falhou = async (detalhe: string): Promise<PrintDaFaturaResult> => {
    await recordImportDiagnostic({ userId: ctx.userId, target: "fatura", stage: "parse", ok: false, fileName: nome, encoding: "imagem", kind: "print", message: `${MSG_PRINT_ILEGIVEL} [${detalhe}]`.slice(0, 500) });
    return { ok: false, error: MSG_PRINT_ILEGIVEL };
  };
  if (!(arquivo instanceof Blob) || arquivo.size === 0) return { ok: false, error: MSG_PRINT_ILEGIVEL };
  if (arquivo.size > UPLOAD_MAX_BYTES) return { ok: false, error: "Esse print é grande demais. Mande a captura de tela original, sem editar." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(envio)) return { ok: false, error: MSG_PRINT_ILEGIVEL };
  try {
    const { lerSegmentosDoPrint } = await import("@/lib/import/ocr-print");
    const { segmentos } = await lerSegmentosDoPrint(Buffer.from(await arquivo.arrayBuffer()));
    const print = lerPrint(segmentos, envio);
    if (print.linhas.length === 0) return await falhou(`nenhuma compra; ${segmentos.length} pedaços de texto`);
    return { ok: true, print, banco: bancoDoPrint(segmentos.map((x) => x.texto)) };
  } catch (err) {
    console.error("lerPrintDaFaturaAction: OCR falhou", err);
    // O leitor de imagem às vezes rejeita com texto ou objeto, não com Error: o diagnóstico guardava
    // só "exceção: erro" (18 vezes em 14/10/2026) e não dava para saber o que tinha quebrado.
    return await falhou(`exceção: ${descreverFalha(err)}`);
  }
}

/** Os prints que a tela juntou (JSON no formulário), conferidos: só o formato esperado passa. */
function printsDoFormulario(formData: FormData): { compras: CompraDoPrint[]; banco: string | null; semReal: CompraSemValorEmReal[]; total: number | null } | null {
  try {
    const envio = String(formData.get("envio") ?? "");
    const brutos = JSON.parse(String(formData.get("prints") ?? "null")) as unknown;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(envio) || !Array.isArray(brutos) || brutos.length === 0 || brutos.length > 12) return null;
    const prints: PrintLido[] = brutos.map((p) => {
      const linhas = Array.isArray(p?.linhas) ? p.linhas : [];
      return {
        cabecalhoNoFim: typeof p?.cabecalhoNoFim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.cabecalhoNoFim) ? p.cabecalhoNoFim : null,
        totalDaFatura: Number.isFinite(Number(p?.totalDaFatura)) && Number(p?.totalDaFatura) > 0 && Number(p?.totalDaFatura) < 1e8 ? Math.round(Number(p.totalDaFatura) * 100) / 100 : null,
        linhas: linhas.slice(0, 200).flatMap((l: Record<string, unknown>) => {
          const valor = Number(l?.valor);
          const nome = typeof l?.nome === "string" ? l.nome.slice(0, 120).trim() : "";
          // Compra em dólar sem o real na tela chega com valor 0 e o valor de fora em `estrangeira`.
          const est = l?.estrangeira as { moeda?: unknown; valor?: unknown } | null | undefined;
          const valorDeFora = Number(est?.valor);
          const estrangeira = est && Number.isFinite(valorDeFora) && valorDeFora > 0 && valorDeFora < 1e7
            ? { moeda: est.moeda === "USD" || est.moeda === "EUR" || est.moeda === "GBP" ? est.moeda : null, valor: Math.round(valorDeFora * 100) / 100 }
            : null;
          if (!nome || !Number.isFinite(valor) || valor < 0 || valor > 1e7 || (valor === 0 && !estrangeira)) return [];
          const parcela = l?.parcela as { atual?: unknown; total?: unknown } | null;
          const atual = Number(parcela?.atual);
          const total = Number(parcela?.total);
          return [{
            data: typeof l?.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : null,
            nome,
            valor: Math.round(valor * 100) / 100,
            sinal: l?.sinal === "-" || l?.sinal === "+" ? l.sinal : null,
            credito: l?.credito === true,
            parcela: Number.isInteger(atual) && Number.isInteger(total) && atual >= 1 && atual <= total && total <= 48 ? { atual, total } : null,
            categoriaDoBanco: typeof l?.categoriaDoBanco === "string" && l.categoriaDoBanco.length <= 40 ? l.categoriaDoBanco : null,
            estrangeira,
          }];
        }),
      };
    });
    const juntas = juntarPrints(prints);
    const compras = comprasDosPrints(juntas, envio);
    const semReal = semValorEmReal(juntas, envio);
    const total = prints.find((p) => p.totalDaFatura)?.totalDaFatura ?? null;
    const banco = typeof formData.get("banco") === "string" && String(formData.get("banco")).length <= 40 ? String(formData.get("banco")) || null : null;
    return compras.length > 0 || semReal.length > 0 ? { compras, banco, semReal, total } : null;
  } catch {
    return null;
  }
}

/** Lê o extrato (CSV/OFX/Excel/PDF), classifica cada transação e devolve a fila pra revisão.
 * O arquivo vem CRU num FormData ({ file, encoding }), string grande como argumento de
 * action estoura o limite de serialização do React (~1M chars). */
/**
 * Toda exceção inesperada da leitura vira resposta com mensagem e diagnóstico (12/10/2026). Antes
 * ela subia para a tela, que mostrava "Confira a internet" (a cliente em Israel ouvia que estava sem
 * internet), e nada ficava registrado no ImportDiagnostic.
 */
export async function parseStatementAction(formData: FormData): Promise<ParseStatementResult> {
  try {
    return await lerExtrato(formData);
  } catch (err) {
    const detalhe = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("parseStatementAction: exceção", err);
    try {
      const ctx = await getRequiredSession();
      const uploaded = formData.get("file");
      await recordImportDiagnostic({
        userId: ctx.userId,
        target: String(formData.get("docType") ?? "extrato"),
        stage: "parse",
        ok: false,
        fileName: uploaded instanceof File ? uploaded.name : null,
        encoding: String(formData.get("encoding") ?? "text"),
        message: `exceção: ${detalhe}`.slice(0, 500),
      });
    } catch {
      // o diagnóstico nunca vira o erro seguinte
    }
    return { ok: false, error: "Não consegui ler esse arquivo agora, e o problema foi do nosso lado. Já ficou registrado; tente de novo em alguns minutos ou mande o arquivo para o suporte." };
  }
}

async function lerExtrato(formData: FormData): Promise<ParseStatementResult> {
  const ctx = await getRequiredSession();
  // Prints da fatura aberta (lerPrintDaFaturaAction): já lidos e juntos pela tela, sempre fatura.
  const doPrint = String(formData.get("origem") ?? "") === "print";
  const encoding = doPrint ? "imagem" : String(formData.get("encoding") ?? "text");
  // "fatura" = fatura de cartão (tudo é gasto); "extrato" = extrato bancário (sinal manda).
  const docType = doPrint ? "fatura" : String(formData.get("docType") ?? "extrato");

  const uploaded = formData.get("file");
  const uploadedName = uploaded instanceof File ? uploaded.name : null;
  /** Toda saída em erro passa por aqui: é o que deixa rastro pra checagem diária. */
  const falha = async (message: string, extra: Partial<Parameters<typeof recordImportDiagnostic>[0]> = {}) => {
    const diagnosticId = await recordImportDiagnostic({
      userId: ctx.userId,
      target: docType,
      stage: "parse",
      ok: false,
      fileName: uploadedName,
      encoding,
      message,
      ...extra,
    });
    // Guarda o arquivo que não deu certo: sem ele, descobrir o formato de um banco novo depende
    // de a pessoa responder no WhatsApp, e quem desiste calado nunca responde.
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "falha" });
  };

  let text: string;
  let source: "auto" | "pdf";
  let dosPrints: ReturnType<typeof printsDoFormulario> = null;
  if (doPrint) {
    dosPrints = printsDoFormulario(formData);
    if (!dosPrints) {
      await falha(`${MSG_PRINT_ILEGIVEL} [prints sem compra]`, { kind: "print" });
      return { ok: false, error: MSG_PRINT_ILEGIVEL };
    }
    if (dosPrints.compras.length === 0) {
      const msg = "As compras desse print são em dólar e a tela não mostra o valor em real, então não gravei nada. Lance pelo PDF da fatura quando ela fechar, ou à mão com o valor em real.";
      await falha(`${msg} [só compra em moeda de fora]`, { kind: "print" });
      return { ok: false, error: msg };
    }
    // Um texto no formato de sempre (data, descrição, valor), só para o diagnóstico e as contas de
    // conferência; as compras em si vêm prontas dos prints.
    text = dosPrints.compras.map((c) => `${c.date.split("-").reverse().join("/")} ${c.description} ${c.amount.toFixed(2).replace(".", ",")}`).join("\n");
    source = "pdf";
  } else try {
    ({ text, source } = await extractUploadFromForm(formData));
  } catch (err) {
    if (err instanceof PasswordRequiredError) {
      // A senha errada continua no diagnóstico (é como se vê quem tenta 20 vezes e desiste).
      if (err.senhaErrada) await falha(err.message);
      return { ok: false, error: err.message, needsPassword: true };
    }
    if (err instanceof UploadReadError) {
      // A pessoa vê a frase limpa; o diagnóstico guarda também a causa técnica.
      await falha(err.detail ? `${err.message} [${err.detail}]` : err.message);
      return { ok: false, error: err.message };
    }
    console.error("parseStatementAction: leitura falhou", {
      name: uploadedName ?? "?",
      size: uploaded instanceof Blob ? uploaded.size : 0,
      encoding,
      err,
    });
    const msg = "Não consegui abrir esse arquivo. Tente exportar de novo em Excel (.xlsx), CSV ou OFX.";
    await falha(`${msg} [${err instanceof Error ? err.message.slice(0, 120) : "erro desconhecido"}]`);
    return { ok: false, error: msg };
  }

  // PDF escaneado/foto não tem texto extraível; PDF "impresso" pelo celular tem só os números.
  const quality = encoding === "pdf" ? pdfTextQuality(text) : "ok";
  if (quality === "empty") {
    const msg =
      "Não consegui ler este PDF, ele parece ser escaneado ou uma foto. Exporte o extrato em Excel (.xlsx), CSV ou OFX que aí funciona.";
    await falha(msg, { kind: "pdf-vazio" });
    return { ok: false, error: msg };
  }
  if (quality === "numbers-only") {
    const msg =
      "Esse PDF veio da impressão pelo celular: os números estão lá, mas as descrições viraram desenho. Exporte o extrato em Excel (.xlsx), CSV ou OFX pelo app do banco, ou baixe o PDF original pelo computador.";
    await falha(msg, { kind: "pdf-so-numeros" });
    return { ok: false, error: msg };
  }

  // Conta de luz, telefone ou água no lugar do extrato: virava linhas inventadas (lib/import/conta-de-consumo).
  if (!dosPrints && pareceContaDeConsumo(text)) {
    await falha(MSG_CONTA_DE_CONSUMO, { kind: "conta-de-consumo" });
    return { ok: false, error: MSG_CONTA_DE_CONSUMO };
  }

  // Lê o arquivo INTEIRO e monta o perfil (banco, período, o que tem dentro) antes de decidir.
  const fileMeta = formData.get("file");
  const fileName = fileMeta instanceof File ? fileMeta.name : null;
  const profile: ReturnType<typeof profileDocument> = dosPrints
    ? {
        institution: dosPrints.banco,
        period: null,
        positionRows: 0,
        movementRows: dosPrints.compras.length,
        hints: { position: 0, statement: 0, invoice: 1, irpf: 0, allocation: 0 },
        contents: [],
        kind: "invoice",
        summary: "Fatura aberta (prints)",
        reason: "prints da fatura aberta",
      }
    : profileDocument(text, fileName);
  if (profile.kind === "position" && !profile.contents.includes("movements")) {
    const msg = /extrato das caixinhas/i.test(profile.reason)
      ? `Li o arquivo inteiro: esse é o extrato das caixinhas, só aplicações, resgates e rendimentos dentro do banco. Ele não mostra o que entrou e saiu da conta, então não serve aqui. Para lançar o dia a dia, baixe o extrato da conta no app do banco.`
      : /extrato de cust[óo]dia/i.test(profile.reason)
      ? `Li o arquivo inteiro: esse é o extrato de custódia, o saldo de cada caixinha e fundo. Ele não traz entradas e saídas, então não serve aqui. Para lançar o dia a dia, baixe o extrato da conta (Conta › Extrato) no app do banco.`
      : profile.reason === MOTIVO_MOVIMENTACAO_B3
      ? `Li o arquivo inteiro: esse é o extrato de movimentação da B3, com as compras, vendas e rendimentos dos investimentos. Ele não traz as entradas e saídas da conta, então não serve aqui. Para lançar o dia a dia, baixe o extrato da conta no app do banco.`
      : `Li o arquivo inteiro: ${profile.summary}. É a posição dos investimentos, não entradas e saídas: suba em Carteira › Importar.`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, header: safeHeader(text) });
    return { ok: false, error: msg };
  }
  if (profile.kind === "irpf") {
    const msg = `Li o arquivo inteiro: ${profile.summary}. A declaração serve para pegar o preço médio dos ativos: use Carteira › Preço médio (IR).`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, header: safeHeader(text) });
    return { ok: false, error: msg };
  }

  // Vencimento e fechamento impressos: o ano das compras (a fatura só traz dia/mês) e o mês de
  // cada uma saem daqui, sem perguntar. O mês escolhido à mão ("Mudar") ainda manda no ano.
  // O vencimento também sai do nome do arquivo ("Nubank_2026-10-17.csv") e, a mais de 2 meses
  // no futuro, não é de fatura (vencimentoPlausivel).
  const datasLidas = lerDatasDaFatura(text, fileName);
  const datasDaFatura = { ...datasLidas, vencimento: vencimentoPlausivel(datasLidas.vencimento) };
  const faturaYear =
    Number(String(formData.get("faturaMonth") ?? "").slice(0, 4)) ||
    (datasDaFatura.vencimento ? Number(datasDaFatura.vencimento.slice(0, 4)) : undefined);
  const { txns: parsedRaw, leitor }: { txns: ParsedTransaction[]; leitor: string | null } = dosPrints
    ? { txns: dosPrints.compras.map((c) => ({ date: c.date, description: c.description, amount: c.amount, ...(c.categoriaDoBanco ? { categoriaDoBanco: c.categoriaDoBanco } : {}) })), leitor: "print" }
    : parseStatementComLeitor(text, source, faturaYear);
  // Fatura: linhas de RESUMO ("pagamento efetuado", "total de compras", "total de crédito
  // recebido") são agregados que a própria fatura já detalha em outras linhas — não são uma
  // compra a mais. Sem isso, o "pagamento de fatura" virava um gasto extra na revisão.
  const semResumo = docType === "fatura" ? parsedRaw.filter((txn) => !isFaturaSummaryLine(txn)) : parsedRaw;
  // Compras iguais no mesmo arquivo são reais (4 patinetes no mesmo dia) e entram todas, sem
  // pergunta. Só sai a mesma linha lida duas vezes por erro de leitura (lib/import/repetidos).
  // Prints: a sobreposição entre eles já saiu em juntarPrints; o resto repetido é compra de verdade.
  const emDobro = dosPrints ? new Set<number>() : lidasEmDobro(text, semResumo);
  const parsed = emDobro.size > 0 ? semResumo.filter((_, i) => !emDobro.has(i)) : semResumo;
  const moneyLines = countMoneyLines(text);
  if (parsed.length === 0) {
    // Diagnóstico pro suporte: só o perfil do arquivo. A primeira linha do extrato saía aqui sem
    // máscara (nome do titular, número da conta) e os logs da Vercel não são lugar disso (04/10/2026).
    console.error("parseStatementAction: zero lançamentos", { fileName, encoding, docType, kind: profile.kind, institution: profile.institution, moneyLines, chars: text.length });
    const msg = veioDeImagem(text)
      ? "Esse PDF é uma imagem (foto ou impressão da tela) e eu não consegui ler os valores com segurança: um número trocado viraria dinheiro errado no seu app, então não gravei nada. Baixe o extrato em outro formato (PDF original do banco, Excel, CSV ou OFX) e envie de novo."
      : periodoSemMovimento(text)
      ? `Esse arquivo não tem nenhum lançamento: o período escolhido no app do banco não teve movimentação. Baixe de novo escolhendo um período maior (o mês inteiro, por exemplo).`
      : moneyLines > 3
        ? `Li o arquivo inteiro (${profile.summary}) e vi ${moneyLines} linhas com valor, mas não consegui ler nenhuma como lançamento. Esse formato eu ainda não conheço: manda o arquivo para o suporte que a gente ensina o app.`
        : `Li o arquivo inteiro (${profile.summary}) e não encontrei transações. Se for um PDF escaneado/foto, exporte em Excel (.xlsx) ou CSV, costuma ler melhor.`;
    await falha(msg, { kind: profile.kind, institution: profile.institution, moneyLines, header: safeHeader(text) });
    return { ok: false, error: msg };
  }
  // Fatura subida como extrato (ou o contrário) é o erro mais caro: compra vira renda. O perfil
  // do arquivo inteiro e, na dúvida, os sinais dizem o que ele é; a tela avisa antes de gravar.
  let detectedKind: DocKind = profile.kind === "invoice" ? "fatura" : profile.kind === "statement" || profile.kind === "position" ? "extrato" : "unknown";
  // A FORMA dos dados vale mais que as palavras do arquivo. Extrato bancário tem entrada e
  // saída; quando todo lançamento vem com o mesmo sinal, é fatura de cartão quase sempre — e
  // fatura costuma trazer "extrato" escrito no cabeçalho, o que fazia o perfil dizer "statement"
  // e esta checagem nem rodar. Foi assim que duas pessoas lançaram a fatura inteira como RENDA:
  // R$ 5.528 de compras no MercadoLivre e na Apple viraram receita do mês, sem nenhum aviso.
  // Mas só desmente o perfil no lado caro (quase tudo entrada) e nunca a estrutura do arquivo:
  // o extrato com um salário e doze saídas também tem "quase tudo do mesmo sinal", e virar
  // fatura fazia do salário um estorno. O motivo passa a ser o dos sinais, não o do perfil —
  // senão a tela dizia "parece uma fatura (extrato do Nubank)".
  let detectedReason = profile.reason;
  const sinaisDizemFatura =
    detectedKind === "unknown" ? looksLikeCardInvoice(parsedRaw) : detectedKind === "extrato" && sinaisDesmentemExtrato(parsedRaw, profile.reason);
  if (sinaisDizemFatura) {
    detectedKind = "fatura";
    detectedReason = MOTIVO_SINAIS_FATURA;
  }

  const [rules, customCategories] = await Promise.all([listTransactionRules(ctx), listCustomCategories(ctx)]);
  const learned: LearnedRule[] = rules.map((r) => ({
    pattern: r.pattern,
    parentCategory: r.parentCategory,
    subcategory: r.subcategory ?? undefined,
    customCategoryId: r.customCategoryId ?? undefined,
  }));
  const personalizadas = new Set(customCategories.map((c) => c.id));

  const comprasSaoPositivas = docType !== "fatura" || comprasDaFaturaSaoPositivas(parsed);
  // Linhas que o dicionário reconheceu como roupa/beleza (Zara, Levi's, salão): vão pra categoria
  // "Cuidado pessoal" dela, criada abaixo se faltar (lib/import/cuidado-pessoal.ts).
  const deCuidadoPessoal = new Set<number>();
  const items: ReviewItem[] = parsed.map((txn, index) => {
    const isExpense = docType === "fatura" ? (comprasSaoPositivas ? txn.amount > 0 : txn.amount < 0) : txn.amount < 0;
    // Estorno: na fatura, todo crédito que não é linha de resumo é dinheiro de compra voltando
    // (antes virava RENDA e inflava o mês); no extrato, a entrada que diz que é estorno.
    const estorno = !isExpense && (docType === "fatura" || pareceEstorno(txn.description));
    // Categoriza saídas e estornos (o estorno desconta da categoria da compra). A ordem do motor
    // (12/10/2026) mora em lib/import/motor.ts: a regra DELA > a base comunitária (alta
    // confiança) > a categoria que o banco escreveu > o dicionário > a pergunta.
    const categorizar = isExpense || estorno;
    const resultado = categoriaDaLinha({
      descricao: txn.description,
      regras: learned,
      profileKind: ctx.profileKind,
      categoriaDoBanco: txn.categoriaDoBanco,
      gasto: isExpense,
      estorno,
      personalizadas,
    });
    // Estorno sem categoria reconhecida vai pra Outros (o motor já devolve assim).
    const classification = categorizar ? resultado.categoria : null;
    if (classification?.cuidadoPessoal && !classification.customCategoryId) deCuidadoPessoal.add(index);
    return {
      key: index,
      date: txn.date,
      description: txn.description,
      ...(txn.categoriaDoBanco ? { categoriaDoBanco: txn.categoriaDoBanco } : {}),
      amount: Math.abs(txn.amount),
      category: isExpense || estorno ? "EXPENSE" : "INCOME",
      // Estorno sem categoria reconhecida vai pra Outros: sem categoria ele seria pulado e a
      // compra ficaria contando sozinha.
      // A personalizada que ela ensinou ("Dani Invest") manda; a mãe fica de fora.
      parentCategory: classification?.customCategoryId ? null : (classification?.parentCategory ?? (estorno ? "OUTROS" : null)),
      customCategoryId: classification?.customCategoryId ?? null,
      subcategory: classification?.subcategory ?? null,
      autoClassified: classification !== null || estorno,
      motivo: categorizar ? resultado.motivo : undefined,
      confianca: categorizar ? resultado.confianca : undefined,
      estorno,
      installment: docType === "fatura" ? parseInstallment(txn.description) : null,
      profileId: null,
      // Crédito da fatura que fala em "pagamento" é o pagamento da fatura anterior escrito de
      // um jeito novo, não devolução de compra: como estorno, descontava a fatura anterior
      // inteira do mês. Fica de fora com o motivo à vista, e um toque traz de volta.
      ...(estorno && docType === "fatura" && pareceCreditoDePagamento(txn.description)
        ? { ignorar: true, nota: "Parece o pagamento da fatura anterior: fica de fora. Se foi devolução de compra, toque em Contar mesmo assim." }
        : {}),
    };
  });

  if (deCuidadoPessoal.size > 0) {
    // Empresa volta null: a linha fica na reserva do dicionário. Erro aqui não derruba a leitura.
    let cuidado: Awaited<ReturnType<typeof garantirCuidadoPessoal>> = null;
    try {
      cuidado = await garantirCuidadoPessoal(ctx, customCategories);
    } catch (err) {
      console.error("parseStatementAction: categoria Cuidado pessoal", err);
    }
    if (cuidado) {
      if (!customCategories.some((c) => c.id === cuidado.id)) customCategories.push({ ...cuidado, userId: ctx.userId, profileId: ctx.profileId, createdAt: new Date() });
      for (const item of items) {
        if (!deCuidadoPessoal.has(item.key)) continue;
        Object.assign(item, { customCategoryId: cuidado.id, parentCategory: null, subcategory: null });
      }
    }
  }

  const conferencia = conferirLeitura(text, docType, parsed);
  const stats: ParseStats = {
    detectedKind,
    detectedReason,
    summary: profile.summary,
    moneyLines,
    parsed: items.length,
    // Prints: o "Compras e despesas, Total" que o resumo da fatura mostra na tela (se estiver num dos prints).
    invoiceTotal: docType === "fatura" ? (dosPrints?.total ?? detectInvoiceTotal(text)) : null,
    sumExpense: items.filter((i) => i.category === "EXPENSE").reduce((s, i) => s + (i.estorno ? -i.amount : i.amount), 0),
    sumIncome: items.filter((i) => i.category === "INCOME").reduce((s, i) => s + i.amount, 0),
    suspeitas: checarPlausibilidade(parsed, detectedKind === "fatura" ? "fatura" : docType, conferencia.status === "fechou"),
    conferencia,
    leituraIncompleta: false,
    // Também quando ela escolheu "extrato" e o arquivo parece fatura: a frase "é fatura?" já
    // diz de quando são as compras.
    vencimento: null,
    fechamento: null,
    banco: profile.institution ?? null,
    mesesDasCompras: [],
    compras: 0,
    faturaAberta: doPrint,
    // A categoria sugerida pela mesma regra das outras linhas (a regra dela, a base, o dicionário).
    ...(dosPrints && dosPrints.semReal.length > 0
      ? {
          semValorEmReal: dosPrints.semReal.map((c): CompraParaPreencher => {
            const sugerida = categoriaDaLinha({ descricao: c.nome, regras: learned, profileKind: ctx.profileKind, gasto: true, estorno: false, personalizadas }).categoria;
            return { ...c, parentCategory: sugerida?.customCategoryId ? null : (sugerida?.parentCategory ?? null), customCategoryId: sugerida?.customCategoryId ?? null, subcategory: sugerida?.subcategory ?? null };
          }),
        }
      : {}),
  };
  if (docType === "fatura" || detectedKind === "fatura") {
    // A fatura só traz dia/mês: a compra de dezembro na fatura que vence em janeiro volta um ano.
    if (docType === "fatura") for (const item of items) item.date = ajustarAnoDaCompra(item.date, datasDaFatura.vencimento, datasDaFatura.fechamento);
    const linhas = docType === "fatura" ? items.filter((i) => i.category === "EXPENSE" && !i.estorno && !i.ignorar) : parsed.filter((t) => !isFaturaSummaryLine(t));
    const contexto = contextoDaFatura(datasDaFatura, parsed.map((t) => t.date));
    Object.assign(stats, {
      vencimento: datasDaFatura.vencimento,
      fechamento: datasDaFatura.fechamento,
      mesesDasCompras: mesesDasCompras(linhas.map((l) => ({ date: l.date, description: l.description })), contexto),
      compras: linhas.length,
    });
  }
  stats.leituraIncompleta = leituraIncompleta(stats.conferencia, leitor !== null, isPartialRead(moneyLines, items.length));
  if (docType !== "fatura") await separarDinheiroProprio(ctx, items);
  // Antes de tudo: a compra que já entrou pelo print da fatura aberta (quase certo, sem pergunta).
  if (docType === "fatura") await marcarJaNaFaturaAberta(ctx, items);
  await marcarPossiveisDuplicatas(ctx, items);
  // Fatura com a data da compra também tem a chave solta (dia + valor): a mesma compra que já
  // veio de outro arquivo pergunta "é o mesmo?". Parcela fica de fora: a data dela é a da compra
  // original, não a do mês em que conta.
  // "Sempre mandar para a Empresa": a compra do comerciante que ela já moveu chega marcada. Antes
  // da busca de repetidos, que olha no perfil de destino (a compra que já estava na Empresa
  // aparecia como compra nova, e a tela dizia "anotar 3" para gravar 2).
  await marcarDestinoPelaRegra(ctx, items);
  await marcarParecidosDeOutraImportacao(ctx, items);
  if (docType === "fatura") await marcarParcelasJaNoApp(ctx, items, contextoDaFatura(datasDaFatura, parsed.map((t) => t.date)));
  const diagnosticId = await recordImportDiagnostic({
    userId: ctx.userId,
    target: docType,
    stage: "parse",
    ok: true,
    fileName: uploadedName,
    encoding,
    kind: profile.kind,
    institution: profile.institution,
    moneyLines,
    parsed: items.length,
    header: safeHeader(text),
    // Leitura implausível entra na mensagem pra aparecer na checagem diária. Sem isso ela é uma
    // importação "ok" como outra qualquer, e foi assim que quatro extratos corrompidos passaram
    // semanas no banco sem ninguém ficar sabendo.
    message:
      stats.suspeitas.length > 0
        ? mensagemImplausivel(stats.suspeitas.map((x) => x.texto))
        : mensagemDaConferencia(stats.conferencia, stats.leituraIncompleta),
  });
  // Leu, mas achou muito menos do que o arquivo tinha: pra pessoa é "só veio um pedaço da
  // fatura". Guarda o arquivo também nesse caso — é o único jeito de conferir se o que ficou
  // de fora era transação de verdade ou só linha de resumo.
  if (stats.leituraIncompleta) {
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "parcial" });
  }
  // Leitura que saiu implausível guarda o arquivo pelo mesmo motivo: sem ele, não dá pra
  // descobrir qual coluna o app pegou errado. Foi exatamente o que faltou nos quatro casos que
  // já aconteceram — o número absurdo estava no banco e o arquivo, não.
  else if (stats.suspeitas.length > 0) {
    await storeFailedImportFile({ userId: ctx.userId, diagnosticId, file: uploaded, encoding, reason: "implausivel" });
  }
  return { ok: true, items, customCategories: customCategories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })), stats };
}

export type ConfirmedItem = {
  date: string;
  description: string;
  amount: number;
  category: EntryType;
  parentCategory: ParentCategory | null;
  /** Categoria personalizada (quando a pessoa escolheu/criou uma na revisão). */
  customCategoryId: string | null;
  subcategory: string | null;
  /** true quando o usuário definiu/ajustou a categoria na revisão, vira regra aprendida. */
  learn: boolean;
  installment?: { current: number; total: number; confident: boolean } | null;
  /** Perfil de destino escolhido na revisão; `null`/ausente = o perfil ativo de sempre. Validado
   * de novo no servidor (tem que ser um perfil do próprio usuário) antes de gravar. */
  profileId?: string | null;
  /** Estorno: grava como gasto negativo (ver ReviewItem.estorno). */
  estorno?: boolean;
  /** Resgate: grava como guardado negativo (ver ReviewItem.resgate). */
  resgate?: boolean;
  /** A compra que já entrou pelo print da fatura aberta (jaNoApp.faturaAberta): em vez de criar,
   * ela passa para este lote com o valor, o dia e o nome desta linha. Conferido de novo aqui. */
  adotar?: string | null;
  /** Compra em dólar/euro/libra do print da fatura: o valor de fora, guardado nos campos de outra
   * moeda do lançamento. `amount` é o valor em real que ela digitou. */
  moedaDeFora?: { moeda: MoedaDeFora; valor: number } | null;
};

/** Lançamento do extrato bancário que PODE ser o pagamento desta fatura — mostrado pra pessoa
 * decidir, nunca removido sozinho (fatura parcial não bate o valor exato, ver comentário em
 * findCardPaymentCandidates). */
export type CardPaymentCandidate = { id: string; description: string; amount: number; date: string | null };

export type ImportResult =
  | {
      ok: true;
      /** Tudo que entrou, inclusive as parcelas seguintes que a fatura projetou. */
      created: number;
      skipped: number;
      cardPaymentCandidates: CardPaymentCandidate[];
      /** Pagamentos da fatura que o extrato tinha gravado como gasto e saíram sozinhos com ela. */
      pagamentosTirados?: CardPaymentCandidate[];
      /** Quantas das `created` são parcelas dos próximos meses (14/10/2026): a tela dizia "7 compras"
       * na conferência e "8 lançamentos importados" no fim, e a diferença era a parcela 3/3 projetada. */
      parcelasFuturas?: number;
    }
  | { ok: false; error: string };

/** (ano, mês) do mês anterior/seguinte, sem depender de Date pra virada de ano (mês 1 → mês 12
 * do ano anterior, mês 12 → mês 1 do ano seguinte). */
function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = (month - 1 + delta + 1200) % 12; // +1200 garante positivo mesmo com delta negativo
  const yearShift = Math.floor((month - 1 + delta) / 12);
  return { year: year + yearShift, month: zeroBased + 1 };
}

/**
 * Quando a pessoa importa a FATURA detalhada, procura no extrato já lançado (mês anterior, o
 * próprio mês e o seguinte — a fatura pode ser paga antes ou depois do mês das compras) linhas
 * que PARECEM ser o pagamento da fatura (descrição), pra ela decidir se remove. Não remove
 * sozinho: fatura raramente é paga por inteiro (pagamento mínimo, parcelamento, juros de
 * atraso), então o valor quase nunca bate exato com o total das compras — a pessoa é quem sabe
 * se aquele lançamento do extrato é mesmo esta fatura.
 */
async function findCardPaymentCandidates(ctx: AuthContext, year: number, month: number): Promise<CardPaymentCandidate[]> {
  const months = [shiftMonth(year, month, -1), { year, month }, shiftMonth(year, month, 1)];
  // Só do perfil ativo: a fatura do Pessoal não pode listar o pagamento feito pela Empresa (e a
  // remoção, que é por perfil, falhava calada).
  const candidates = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", OR: months },
    select: { id: true, description: true, amount: true, entryDate: true },
    orderBy: { entryDate: "asc" },
  });
  // Valor negativo é estorno (gasto que voltou), nunca o pagamento saindo do extrato: o
  // "Pagamento da fatura" que uma fatura antiga deixou entrar como estorno aparecia aqui como
  // "− -R$ 2.800", e remover apagava o estorno em vez do pagamento.
  return candidates
    // A MESMA regra que deixa o pagamento de fora na leitura do extrato (ver dinheiro-proprio):
    // com duas, "PGTO FATURA" e o "Pagto cartão crédito" do BB passavam numa e não na outra, e a
    // fatura não oferecia remover o pagamento que o extrato já tinha lançado.
    .filter((c) => Number(c.amount) > 0 && parecePagamentoDeFatura(c.description))
    .map((c) => ({
      id: c.id,
      description: c.description ?? "Pagamento de fatura",
      amount: Number(c.amount),
      date: c.entryDate ? c.entryDate.toISOString().slice(0, 10) : null,
    }));
}

/** Remove UM lançamento candidato a "pagamento de fatura" do extrato, só depois que a pessoa
 * confirma que é mesmo esta fatura (nunca automático). */
export async function removeCardPaymentCandidateAction(id: string): Promise<{ ok: boolean }> {
  const ctx = await getRequiredSession();
  const result = await prisma.monthlyEntry.deleteMany({ where: { id, userId: ctx.userId, profileId: ctx.profileId } });
  revalidatePath("/mensal/[year]/[month]", "page");
  return { ok: result.count > 0 };
}

function yearMonthFromISO(date: string): { year: number; month: number } | null {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/** Descrição comparável: sem diferença de maiúscula/espaço nem de como o "N/T" da parcela foi
 * escrito ("PARC 04/06" do banco e "PARC 04/6" que versões antigas do app gravavam são a mesma). */
/**
 * "Sempre mandar para a Empresa" (12/10/2026): a linha de um comerciante que ela já moveu de
 * perfil (e pediu para lembrar) chega na revisão marcada para o perfil de destino, com a categoria
 * que faz sentido LÁ (ver categoriaNoDestino). Na revisão ela desmarca com um toque, como sempre.
 * A personalizada do destino não entra: a tela só mostra as fixas numa linha de outro perfil.
 */
async function marcarDestinoPelaRegra(ctx: AuthContext, items: ReviewItem[]): Promise<void> {
  try {
    const regras = await regrasDePerfil(ctx);
    if (regras.length === 0) return;
    const perfis = new Map((await listProfiles(ctx.userId)).filter((p) => p.id !== ctx.profileId).map((p) => [p.id, p]));
    const regrasDeCategoria = new Map<string, LearnedRule[]>();
    const regrasDoDestino = async (profileId: string) => {
      if (!regrasDeCategoria.has(profileId)) {
        const rs = await listTransactionRules({ ...ctx, profileId });
        // Só as de categoria padrão: a personalizada do destino não aparece nesta tela.
        regrasDeCategoria.set(profileId, rs.filter((r) => !r.customCategoryId).map((r) => ({ pattern: r.pattern, parentCategory: r.parentCategory, subcategory: r.subcategory ?? undefined })));
      }
      return regrasDeCategoria.get(profileId)!;
    };
    for (const item of items) {
      if (item.category !== "EXPENSE" || item.ignorar || item.profileId) continue;
      const destino = perfis.get(destinoPelaRegra(item.description, regras) ?? "");
      if (!destino) continue;
      const categoria = categoriaNoDestino({
        lancamento: { category: "EXPENSE", parentCategory: item.parentCategory, customCategoryId: item.customCategoryId, subcategory: item.subcategory, description: item.description, amount: item.estorno ? -item.amount : item.amount },
        origemKind: ctx.profileKind,
        destinoKind: destino.kind,
        nomeDaPersonalizada: null,
        personalizadasDoDestino: [],
        regrasDoDestino: await regrasDoDestino(destino.id),
      });
      const temCategoria = categoria.parentCategory !== null;
      Object.assign(item, {
        profileId: destino.id,
        parentCategory: categoria.parentCategory,
        customCategoryId: null,
        subcategory: categoria.subcategory,
        autoClassified: temCategoria,
        motivo: temCategoria ? "regra_sua" : "pergunta",
        confianca: temCategoria ? "alta" : "baixa",
        nota: item.nota ?? `Vai para ${destino.name}: você pediu para sempre mandar.`,
      });
    }
  } catch (err) {
    // Não marcar é o comportamento de antes: a leitura do arquivo nunca cai por causa disso.
    console.error("marcarDestinoPelaRegra falhou (a leitura segue)", err);
  }
}

/** Chave de duplicata: mesma data + valor + descrição = mesma transação do extrato. */
function dedupeKey(date: string | null, amount: number, description: string | null): string {
  return `${date ?? ""}|${amount.toFixed(2)}|${descricaoComparavel(description)}`;
}

/** Parcela de fatura com CERTEZA (ver parseInstallment): só essas têm a comparação por parcela. */
function parcelaCerta(description: string | null) {
  const p = parseInstallment(description);
  return p?.confident ? p : null;
}

/** Parcela de fatura já gravada (sem dia), com o lote que a criou e o mês em que caiu (ano*12+mês). */
type ParcelaExistente = { valor: number; id: string; loteId: string | null; mes: number; /** Gravada antes de a parcela ter dia (out/2026). */ semDia?: boolean };



const DIA_MS = 86_400_000;


/**
 * A fatura que cada pagamento paga já está no app? As compras de fatura dos meses em volta das
 * datas dos pagamentos (ver pagamentoTemFatura): antes era "importou alguma fatura nos últimos
 * 120 dias", e o pagamento de um cartão que ela nunca importou sumia do mês.
 */
async function comprasDeFaturaEmVolta(ctx: AuthContext, datasDosPagamentos: string[]) {
  const meses = new Map<string, { year: number; month: number }>();
  for (const data of datasDosPagamentos) {
    const m = mesDaData(data);
    if (!m) continue;
    for (const d of [-1, 0, 1]) {
      const v = somarMeses(m, d);
      meses.set(chaveDoMes(v), v);
    }
  }
  if (meses.size === 0) return [];
  const compras = await prisma.monthlyEntry.findMany({
    where: {
      userId: ctx.userId, profileId: ctx.profileId,
      category: "EXPENSE",
      importBatch: { is: { docType: "fatura" } },
      OR: [...meses.values()],
    },
    select: { year: true, month: true, entryDate: true, description: true, amount: true },
  });
  return compras.map((e) => ({
    year: e.year,
    month: e.month,
    entryDate: e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null,
    descricao: e.description,
    valor: Number(e.amount),
  }));
}

/**
 * Extrato gravado com a fatura JÁ no app: o pagamento dela fica de fora, como na leitura. A
 * leitura decide (separarDinheiroProprio), mas no lote de vários arquivos o extrato é lido antes
 * de a fatura do mesmo lote ser gravada, e o pagamento entrava como gasto (14/10/2026).
 */
async function pagamentosComFaturaNoApp(ctx: AuthContext, items: ConfirmedItem[]): Promise<Set<ConfirmedItem>> {
  const pagamentos = items.filter(
    (item) => !item.estorno && item.category === "EXPENSE" && (!item.profileId || item.profileId === ctx.profileId) && parecePagamentoDeFatura(item.description),
  );
  if (pagamentos.length === 0) return new Set();
  const lancamentosDeFatura = await comprasDeFaturaEmVolta(ctx, pagamentos.map((p) => p.date));
  return new Set(pagamentos.filter((p) => pagamentoTemFatura(p.date, lancamentosDeFatura)));
}

/**
 * Fatura gravada DEPOIS do extrato: o pagamento dela que o extrato gravou como gasto sai, pela
 * mesma regra (ver pagamentosDaFatura). Só o que veio de extrato: o lançado à mão continua sendo
 * oferecido para ela tirar (findCardPaymentCandidates).
 */
async function tirarPagamentosDaFatura(ctx: AuthContext, mesesDasCompras: { year: number; month: number }[]): Promise<CardPaymentCandidate[]> {
  // O pagamento vem no mês da compra ou no seguinte (até 30 dias depois dela).
  const meses = new Map<string, { year: number; month: number }>();
  for (const m of mesesDasCompras) {
    for (const d of [0, 1]) {
      const v = somarMeses(m, d);
      meses.set(chaveDoMes(v), v);
    }
  }
  if (meses.size === 0) return [];
  const doExtrato = (
    await prisma.monthlyEntry.findMany({
      where: {
        userId: ctx.userId, profileId: ctx.profileId,
        category: "EXPENSE",
        importBatch: { is: { docType: { not: "fatura" } } },
        entryDate: { not: null },
        OR: [...meses.values()],
      },
      select: { id: true, description: true, amount: true, entryDate: true },
    })
  ).filter((e) => Number(e.amount) > 0 && parecePagamentoDeFatura(e.description));
  if (doExtrato.length === 0) return [];
  const pagamentos = doExtrato.map((e) => ({ id: e.id, data: e.entryDate!.toISOString().slice(0, 10), valor: Number(e.amount) }));
  const daFatura = pagamentosDaFatura(pagamentos, await comprasDeFaturaEmVolta(ctx, pagamentos.map((p) => p.data)));
  if (daFatura.size === 0) return [];
  await prisma.monthlyEntry.deleteMany({ where: { id: { in: [...daFatura] }, userId: ctx.userId, profileId: ctx.profileId } });
  return pagamentos
    .filter((p) => daFatura.has(p.id))
    .map((p) => ({ id: p.id, description: doExtrato.find((e) => e.id === p.id)?.description ?? "Pagamento de fatura", amount: p.valor, date: p.data }));
}

/**
 * Extrato: separa o dinheiro dela indo pra ela mesma (ver lib/import/dinheiro-proprio). Aplicação
 * vira aporte sozinha e o resgate entra sozinho como resgate; pagamento de fatura fica de fora pra
 * quem importa a fatura; transferência pra conta própria vira pergunta na revisão.
 */
async function separarDinheiroProprio(ctx: AuthContext, items: ReviewItem[]) {
  const pagamentos = items.filter((item) => !item.estorno && item.category === "EXPENSE" && parecePagamentoDeFatura(item.description)).map((item) => item.date);
  const [usuario, lancamentosDeFatura] = await Promise.all([
    prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    comprasDeFaturaEmVolta(ctx, pagamentos),
  ]);
  for (const item of items) {
    if (item.estorno) continue;
    // A categoria que o banco escreveu conta como parte do texto: o extrato do BTG põe
    // "Investimentos" numa coluna à parte, e "Transferência enviada · Fulana" sozinha virava a
    // pergunta "só mudei de conta?" em vez de aplicação (e o mesmo aporte, já no app, voltava).
    const bancoDizInvestimento = !!item.categoriaDoBanco && /invest/i.test(item.categoriaDoBanco);
    const texto = bancoDizInvestimento ? `Investimentos ${item.description}` : item.description;
    if (item.category === "EXPENSE") {
      if (pareceAplicacao(texto)) {
        Object.assign(item, { category: "INVESTMENT_CONTRIBUTION", parentCategory: null, customCategoryId: null, subcategory: null, motivo: "investimento", confianca: "alta", nota: "Aplicação: entra como guardado, não como gasto." });
      } else if (parecePagamentoDeFatura(item.description)) {
        // Com a fatura no app, o pagamento é dinheiro mudando de conta: as compras já contam uma
        // a uma. Sem ela, é o gasto do cartão inteiro numa linha, já separado (não vira pergunta).
        Object.assign(item, pagamentoDoCartao(item.date, lancamentosDeFatura));
      } else if (pareceContaPropria(item.description, usuario?.name)) {
        item.duvida = "conta_propria";
      }
    } else if (item.category === "INCOME") {
      // Resgate (12/10/2026): entra sozinho como "só mudei de conta" (o guardado diminui), sem perguntar.
      if (pareceResgate(texto)) Object.assign(item, { category: "INVESTMENT_CONTRIBUTION", resgate: true, parentCategory: null, customCategoryId: null, subcategory: null, nota: "Resgate: desconta do que você guardou. Depois, na Carteira, diga de qual investimento saiu." });
      else if (pareceContaPropria(item.description, usuario?.name)) item.duvida = "conta_propria";
    }
  }
}

/**
 * Fatura (fechada ou mais prints): a compra que já entrou por um PRINT da fatura aberta vira
 * `jaNoApp` com `faturaAberta` (ver lib/import/fatura-aberta). Ela não entra de novo; na gravação,
 * a compra do print passa para este lote com o valor, o dia e o nome que chegaram agora.
 */
async function marcarJaNaFaturaAberta(ctx: AuthContext, items: ReviewItem[]) {
  const datas = items.map((i) => Date.parse(`${i.date}T12:00:00Z`)).filter((t) => Number.isFinite(t));
  if (datas.length === 0) return;
  const de = new Date(Math.min(...datas) - 40 * DIA_MS);
  const ate = new Date(Math.max(...datas) + 40 * DIA_MS);
  const meses: { year: number; month: number }[] = [];
  for (let d = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), 1)); d <= ate; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    meses.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  const doPrint = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, category: "EXPENSE", importBatch: { is: { faturaAberta: true } }, OR: meses },
    select: { id: true, amount: true, entryDate: true, year: true, month: true, description: true },
  });
  if (doPrint.length === 0) return;
  const casados = casarComFaturaAberta(
    items.flatMap((it) => (it.category === "EXPENSE" && !it.ignorar ? [{ key: it.key, date: it.date, description: it.description, valor: it.estorno ? -it.amount : it.amount }] : [])),
    doPrint.map((e) => ({ id: e.id, amount: Number(e.amount), entryDate: e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null, year: e.year, month: e.month, description: e.description })),
  );
  for (const item of items) {
    const g = casados.get(item.key);
    if (g) item.jaNoApp = { descricao: g.description ?? "(sem descrição)", data: g.entryDate, id: g.id, valor: g.amount, faturaAberta: true };
  }
}

/**
 * Lançamento que a pessoa JÁ fez à mão e que agora vem no extrato/fatura (critério em
 * lib/import/parecido-manual): o quase certo vira `jaNoApp` (não entra de novo, a tela só mostra
 * "N já estavam no app"); o caso duvidoso de verdade (valor igual, data perto, nome diferente)
 * vira `possivelDuplicata`, uma pergunta na fila de perguntas.
 */
async function marcarPossiveisDuplicatas(ctx: AuthContext, items: ReviewItem[]) {
  const datas = items.map((i) => Date.parse(`${i.date}T12:00:00Z`)).filter((t) => Number.isFinite(t));
  if (datas.length === 0) return;
  const de = new Date(Math.min(...datas) - 4 * DIA_MS);
  const ate = new Date(Math.max(...datas) + 4 * DIA_MS);
  const meses: { year: number; month: number }[] = [];
  for (let d = new Date(Date.UTC(de.getUTCFullYear(), de.getUTCMonth(), 1)); d <= ate; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    meses.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  const manuais = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: ctx.profileId, importBatchId: null, externalId: null, OR: meses },
    select: { id: true, category: true, amount: true, entryDate: true, description: true, year: true, month: true },
  });
  const linhas: LinhaDoArquivo[] = items.flatMap((item) =>
    item.ignorar || item.jaNoApp || !Number.isFinite(Date.parse(`${item.date}T12:00:00Z`))
      ? []
      : [{ key: item.key, date: item.date, description: item.description, valor: item.estorno ? -item.amount : item.amount, category: item.category }],
  );
  const casados = casarComLancadosAMao(
    linhas,
    manuais.map((m) => ({ id: m.id, category: m.category, amount: Number(m.amount), entryDate: m.entryDate ? m.entryDate.toISOString().slice(0, 10) : null, year: m.year, month: m.month, description: m.description })),
  );
  for (const item of items) {
    const c = casados.get(item.key);
    if (!c) continue;
    const par = { descricao: c.manual.description ?? "(sem descrição)", data: c.manual.entryDate, id: c.manual.id, valor: c.manual.amount };
    if (c.tipo === "certo") item.jaNoApp = par;
    else item.possivelDuplicata = par;
  }
}

/**
 * Os lançamentos à mão que a importação deu como "já estavam no app": ficam com o que de fato
 * aconteceu (o dia e o valor do arquivo, que diferem no máximo 3 dias e 1%), e o lançamento sem
 * nome que diga algo ganha o nome do arquivo. Nunca cria nem apaga nada.
 */
export async function conciliarJaNoAppAction(lista: { id: string; valor: number; data: string; descricao: string }[]): Promise<{ error?: string }> {
  const ctx = await getRequiredSession();
  if (!Array.isArray(lista) || lista.length > 500) return { error: "Dados inválidos." };
  for (const l of lista) {
    const valor = Math.round(Number(l?.valor) * 100) / 100;
    const dia = new Date(`${l?.data}T12:00:00`);
    if (typeof l?.id !== "string" || !Number.isFinite(valor) || valor === 0 || Math.abs(valor) > 1e8 || Number.isNaN(dia.getTime())) continue;
    const atual = await prisma.monthlyEntry.findFirst({
      where: { id: l.id, userId: ctx.userId, profileId: ctx.profileId, importBatchId: null },
      select: { amount: true, description: true },
    });
    if (!atual) continue;
    // Nunca mais longe que o critério: protege de um id trocado no cliente.
    if (Math.abs(Number(atual.amount) - valor) > Math.max(0.011, Math.abs(valor) * 0.01 + 0.001)) continue;
    const nome = typeof l.descricao === "string" ? nomeNaTela(l.descricao).nome.slice(0, 120) : "";
    await prisma.monthlyEntry.updateMany({
      where: { id: l.id, userId: ctx.userId, profileId: ctx.profileId, importBatchId: null },
      data: {
        amount: valor,
        entryDate: dia,
        year: dia.getFullYear(),
        month: dia.getMonth() + 1,
        ...(nome && semNomeUtil(atual.description) ? { description: nome } : {}),
      },
    });
  }
  revalidatePath("/mensal", "layout");
  return {};
}

/** Chave solta (ver lib/import/duplicata-solta): mesmo dia, mesmo valor gravado e mesmo tipo. */
function chaveSoltaDe(date: string, valorGravado: number, category: string): string {
  return `${date}|${valorGravado.toFixed(2)}|${category}`;
}

/**
 * Extrato: linha com o mesmo dia, valor e tipo de um lançamento que JÁ veio de outra importação,
 * mas com outra descrição. Pode ser o mesmo extrato em outro formato ou um gasto de outra conta
 * (o Pix de R$ 100 no Nubank e o saque de R$ 100 no Itaú). Antes a confirmação pulava calada;
 * agora a revisão pergunta, mostrando o que já está lá. Descrição igual continua pulando sozinha
 * na confirmação, sem pergunta: é o mesmo arquivo de novo.
 */
async function marcarParecidosDeOutraImportacao(ctx: AuthContext, items: ReviewItem[]) {
  const meses = [...new Set(items.flatMap((i) => (yearMonthFromISO(i.date) ? [i.date.slice(0, 7)] : [])))].map((ym) => ({
    year: Number(ym.slice(0, 4)),
    month: Number(ym.slice(5, 7)),
  }));
  if (meses.length === 0) return;
  const perfis = [...new Set(items.map((it) => it.profileId ?? ctx.profileId))];
  const [importados, nomesDoBanco] = await Promise.all([
    prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: { in: perfis }, importBatchId: { not: null }, entryDate: { not: null }, OR: meses },
      select: { id: true, entryDate: true, amount: true, description: true, category: true, profileId: true },
    }),
    descricoesOriginais(ctx, perfis),
  ]);
  const existentes = new Map<string, ExistenteSolto[]>();
  for (const e of importados) {
    if (!e.entryDate) continue;
    const k = `${e.profileId ?? ctx.profileId}|${chaveSoltaDe(e.entryDate.toISOString().slice(0, 10), Number(e.amount), e.category)}`;
    // Compara pelo nome do banco (o mesmo da confirmação) e mostra o nome que ela deu.
    existentes.set(k, [...(existentes.get(k) ?? []), { descricao: nomesDoBanco.get(e.id) ?? e.description, mostrar: e.description }]);
  }
  const chaves = items.map((it) =>
    // Com o sinal que vai para o banco: estorno e resgate são gravados negativos (o resgate subido de
    // novo não casava e a conferência prometia "anotar 1" que a gravação pulava).
    it.amount > 0 && !it.installment && yearMonthFromISO(it.date)
      ? `${it.profileId ?? ctx.profileId}|` + chaveSoltaDe(it.date, (it.estorno && it.category === "EXPENSE") || (it.resgate && it.category === "INVESTMENT_CONTRIBUTION") ? -it.amount : it.amount, it.category)
      : null,
  );
  const casados = casarPorDataEValor(chaves, items.map((it) => it.description), existentes, { perguntar: true });
  for (const [i, c] of casados) {
    if (items[i].possivelDuplicata || items[i].jaNoApp || items[i].ignorar) continue;
    // Mesmo dia, valor e nome de uma linha que já veio de outro arquivo (14/10/2026): a gravação
    // pula sozinha, e a tela dizia "Pronto, anotar 10" para depois dizer "Nada novo". Agora a
    // conferência já mostra "10 já estavam no app" e conta só o que é novo.
    if (c.tipo === "mesmo") {
      items[i].jaNoApp = { descricao: items[i].description, data: items[i].date, id: "", valor: items[i].amount, importado: true };
      continue;
    }
    // A pergunta do lançamento à mão já cobre a linha: uma pergunta por linha.
    if (c.tipo !== "parecido") continue;
    items[i].possivelDuplicata = { descricao: c.descricao ?? "(sem descrição)", data: items[i].date, importado: true };
  }
}

/**
 * Fatura e prints da fatura aberta: a parcela que já está no app (a fatura anterior projetou a
 * 2/8 em outubro, ou é a mesma fatura subida de novo) aparece na revisão como "já estava no app",
 * e não como compra nova nem como pergunta de categoria. A gravação já pulava (ver
 * `parcelaJaLancada`), mas a tela dizia "anotar 10" e fazia perguntas que não mudavam nada.
 */
async function marcarParcelasJaNoApp(ctx: AuthContext, items: ReviewItem[], contexto: ContextoDaFatura) {
  const alvos = items.flatMap((item) => {
    if (item.ignorar || item.jaNoApp || item.possivelDuplicata || item.estorno || !item.installment?.confident) return [];
    const destino = mesDaCompra({ date: item.date, description: item.description, installment: item.installment }, contexto);
    return [{ item, mes: destino.mes }];
  });
  if (alvos.length === 0) return;
  const meses = [...new Map(alvos.map((a) => [`${a.mes.year}-${a.mes.month}`, a.mes])).values()];
  // No perfil para onde a compra vai (a regra "sempre mandar para a Empresa" já rodou).
  const perfis = [...new Set(alvos.map((a) => a.item.profileId ?? ctx.profileId))];
  const existentes = await prisma.monthlyEntry.findMany({
    where: { userId: ctx.userId, profileId: { in: perfis }, category: "EXPENSE", OR: meses.map((m) => ({ year: m.year, month: m.month })) },
    select: { id: true, description: true, amount: true, year: true, month: true, entryDate: true, profileId: true },
  });
  const usados = new Set<string>();
  for (const { item, mes } of alvos) {
    const chave = descricaoComparavel(item.description);
    const perfil = item.profileId ?? ctx.profileId;
    const achado = existentes.find(
      (e) => !usados.has(e.id) && (e.profileId ?? ctx.profileId) === perfil && e.year === mes.year && e.month === mes.month && descricaoComparavel(e.description) === chave && mesmaParcela(Number(e.amount), item.amount, item.installment!.total),
    );
    if (!achado) continue;
    usados.add(achado.id);
    item.jaNoApp = { descricao: achado.description ?? item.description, data: achado.entryDate ? achado.entryDate.toISOString().slice(0, 10) : item.date, id: "", valor: Number(achado.amount), importado: true, parcela: true };
  }
}

/**
 * Cria os lançamentos escolhidos e memoriza as categorias definidas manualmente (item 3).
 * Transações idênticas já lançadas (mesma data+valor+descrição) são puladas, importar o
 * mesmo extrato duas vezes não duplica nada.
 *
 * Fatura (out/2026): sem `targetYear`/`targetMonth`, cada compra entra no mês em que foi feita,
 * com o dia, e a parcela k no mês da compra + (k - 1), sem dia (ver lib/import/mes-da-compra; o
 * vencimento e o fechamento lidos do arquivo vêm em `fatura`). Com o mês escolhido no "Mudar",
 * vale o modo antigo: TODAS as compras nesse mês, sem dia. Nos dois modos a mesma fatura já
 * gravada no outro modelo é reconhecida (ver `chavesDoOutroModelo`).
 */
export async function importTransactionsAction(
  items: ConfirmedItem[],
  docType: "extrato" | "fatura" = "extrato",
  targetYear?: number,
  targetMonth?: number,
  fileName?: string,
  /** O perfil que a tela de revisão mostrava (ver perfil-da-tela.ts). */
  perfilDaTela?: string | null,
  /** Perfil Casal: de quem é o extrato ("A"/"B"). Todas as linhas que ficam no perfil levam o nome. */
  pessoaDoExtrato?: string | null,
  /** Fatura: vencimento e fechamento lidos do arquivo (ParseStats), que decidem o mês de cada compra. */
  fatura?: { vencimento: string | null; fechamento: string | null } | null,
  /** Prints da fatura ABERTA: o lote fica marcado como parcial e não projeta parcelas (a fatura fechada projeta). */
  faturaAberta?: boolean,
): Promise<ImportResult> {
  const ctx = await getRequiredSession();
  // Só no Casal, e só nas linhas que ficam nele (a que foi mandada pra outro perfil não leva).
  const pessoaDasLinhas = ehCasal(ctx.profileKind) && ehPessoa(pessoaDoExtrato) ? pessoaDoExtrato : undefined;
  const pessoaPara = (destino: string | undefined) => (destino === undefined || destino === ctx.profileId ? pessoaDasLinhas : undefined);
  // A revisão foi montada num perfil (as categorias, os "mandar pra outro perfil") e as linhas
  // sem perfil próprio iam pro ATIVO na hora do toque: trocar de perfil noutro aparelho no meio
  // da revisão punha o extrato inteiro da Empresa no Pessoal, com o lote no histórico errado.
  if (trocouDePerfil(perfilDaTela, ctx.profileId)) return { ok: false, error: MSG_TROCOU_DE_PERFIL };
  // Extrato com a fatura do pagamento já no app (gravada depois da leitura, no mesmo lote).
  const pagamentosCobertos = docType === "extrato" ? await pagamentosComFaturaNoApp(ctx, items) : new Set<ConfirmedItem>();
  if (pagamentosCobertos.size > 0) items = items.filter((item) => !pagamentosCobertos.has(item));
  const now = new Date();
  const touchedMonths = new Set<string>();
  // Fatura: os meses em que esta importação gravou compra (não as parcelas projetadas).
  const mesesDasComprasCriadas = new Map<string, { year: number; month: number }>();
  let created = 0;
  let parcelasFuturas = 0;
  let skipped = pagamentosCobertos.size;

  // Todo upload vira um "lote": é o que dá o histórico de importações e permite desfazer o
  // arquivo inteiro depois (upload errado/duplicado). Se nada for criado, o lote é removido.
  const aberta = docType === "fatura" && faturaAberta === true;
  const batch = await createImportBatch(ctx, { docType, fileName, faturaAberta: aberta });

  // Fatura com mês escolhido ("Mudar › contar tudo num mês"): o modo antigo, tudo nesse mês e
  // sem dia. Sem mês escolhido (o padrão desde out/2026): cada compra no mês em que foi feita,
  // parcela k no mês da compra + (k - 1) (ver lib/import/mes-da-compra).
  const faturaTarget =
    docType === "fatura" && targetYear && targetMonth ? { year: targetYear, month: targetMonth } : null;
  const ehFatura = docType === "fatura";
  const modoCompra = ehFatura && !faturaTarget;
  const datasDaFatura = { vencimento: fatura?.vencimento ?? null, fechamento: fatura?.fechamento ?? null };
  // O contexto vale nos dois modos: no do mês escolhido ele dá a chave "pela data da compra", pra
  // a mesma fatura já gravada no modo novo não entrar de novo.
  const contextoFatura: ContextoDaFatura | null = ehFatura ? contextoDaFatura(datasDaFatura, items.map((i) => i.date), now) : null;
  const destinos = new Map<ConfirmedItem, Destino>();
  const destinoPelaCompra = (item: ConfirmedItem): Destino | null => {
    if (!contextoFatura) return null;
    if (!destinos.has(item)) destinos.set(item, mesDaCompra(item, contextoFatura, now));
    return destinos.get(item)!;
  };

  // Cada linha pode ir pro perfil ativo ou pra OUTRO perfil do usuário (fatura Pessoal com
  // compra da Empresa, por exemplo — ver `profileId` em ReviewItem). Um id que não é REALMENTE
  // de um perfil do usuário é ignorado, sem quebrar o lançamento nem vazar dado de outra conta.
  const ownProfileIds = new Set((await listProfiles(ctx.userId)).map((p) => p.id));
  const profileIdOf = (item: ConfirmedItem): string =>
    item.profileId && ownProfileIds.has(item.profileId) ? item.profileId : ctx.profileId;

  // "Não é parcela" e "Apagar esta compra" do menu "…" de Recorrentes, por perfil: a série que ela
  // recusou não é projetada de novo, nem a compra que ela apagou (subir a fatura antiga outra vez).
  // Só a fatura projeta. A recusa não segura a importação: sem ler, projeta como sempre.
  const recusasDeParcela = new Map<string, Set<string>>();
  if (ehFatura) {
    try {
      const recusas = await prisma.contaRecusada.findMany({
        where: { userId: ctx.userId, profileId: { in: [...ownProfileIds] }, OR: [{ chave: { startsWith: PREFIXO_NAO_PARCELA } }, { chave: { startsWith: PREFIXO_COMPRA_APAGADA } }] },
        select: { profileId: true, chave: true },
      });
      for (const r of recusas) recusasDeParcela.set(r.profileId ?? "", (recusasDeParcela.get(r.profileId ?? "") ?? new Set()).add(r.chave));
    } catch (err) {
      console.error("Importação: não leu as parcelas recusadas (projeta como sempre)", err);
    }
  }
  const parcelaRecusada = (profileId: string, descricao: string, total: number, origem: number) =>
    projecaoRecusada(recusasDeParcela.get(profileId) ?? new Set(), descricao, total, origem);

  // Categoria personalizada só vale se for do MESMO perfil de destino do lançamento — uma
  // categoria da Pessoal não existe pro banco quando o lançamento é gravado na Empresa. Busca
  // todas de uma vez (sem filtrar por perfil) e agrupa, em vez de uma consulta por perfil.
  const customCategoriesByProfile = new Map<string, Set<string>>();
  for (const cc of await prisma.customCategory.findMany({ where: { userId: ctx.userId }, select: { id: true, profileId: true } })) {
    if (!cc.profileId) continue; // categoria de antes dos perfis, sem dono — não entra em nenhum grupo
    if (!customCategoriesByProfile.has(cc.profileId)) customCategoriesByProfile.set(cc.profileId, new Set());
    customCategoriesByProfile.get(cc.profileId)!.add(cc.id);
  }

  // Meses afetados pela importação → busca os lançamentos existentes deles de uma vez. Entram
  // também os meses das PARCELAS futuras: sem eles, subir a fatura de outubro recriava as
  // parcelas que a fatura de setembro já tinha lançado, e a cada mês sobrava mais uma cópia.
  // A chave leva o PERFIL de destino junto: mesma data/valor/descrição em perfis diferentes
  // (Pessoal e Empresa) não é duplicata uma da outra, é o mesmo gasto do cartão dividido em duas contas.
  const monthOf = (item: ConfirmedItem) =>
    faturaTarget ?? destinoPelaCompra(item)?.mes ?? yearMonthFromISO(item.date) ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
  /** O dia que vai no lançamento (e na chave): fatura pelo mês escolhido não tem dia; pela data
   * da compra, a compra à vista e a parcela com certeza têm (a parcela no dia da compra original,
   * como as projetadas); a parcela é reconhecida pelo mês e pela descrição, sem o dia. */
  const diaDe = (item: ConfirmedItem): string | null =>
    faturaTarget ? null : modoCompra ? destinoPelaCompra(item)!.dia : yearMonthFromISO(item.date) ? item.date : null;
  const monthsInBatch = new Set<string>();
  for (const item of items) {
    const ym = monthOf(item);
    const profileId = profileIdOf(item);
    monthsInBatch.add(`${profileId}|${ym.year}/${ym.month}`);
    // Mês escolhido: o mês "pela data da compra" também, pra achar a mesma fatura gravada no modo novo.
    const pelaCompra = faturaTarget ? destinoPelaCompra(item)?.mes : null;
    if (pelaCompra) monthsInBatch.add(`${profileId}|${pelaCompra.year}/${pelaCompra.month}`);
    if (ehFatura && item.installment?.confident) {
      // Um mês antes e um depois das parcelas também: é onde a parcela projetada por outra fatura
      // está quando o mês escolhido ficou um mês fora (ver `parcelaJaLancada`).
      for (let n = item.installment.current; n <= item.installment.total + 1; n += 1) {
        const d = new Date(ym.year, ym.month - 1 + (n - item.installment.current), 1);
        monthsInBatch.add(`${profileId}|${d.getFullYear()}/${d.getMonth() + 1}`);
      }
      const antes = shiftMonth(ym.year, ym.month, -1);
      monthsInBatch.add(`${profileId}|${antes.year}/${antes.month}`);
    }
  }
  // CONTAGEM, não presença: quem tem dois cafés iguais no mesmo dia (e escolheu manter os dois
  // na revisão) fica com os dois. Só é pulado o que já existe no banco, um a um.
  const existingCounts = new Map<string, number>();
  // Segunda chave, sem a descrição: mesma data + mesmo valor + mesmo tipo, só contra o que JÁ
  // veio de um arquivo. É o extrato da semana subido de novo no fim do mês (ou em outro formato,
  // CSV numa semana e PDF no mês), em que o banco escreve a mesma transação de outro jeito. Só
  // pula sozinho quando a descrição bate (ver lib/import/duplicata-solta); com descrição diferente
  // a revisão já perguntou "é o mesmo?", e o que ela manteve entra.
  const looseDescricoes = new Map<string, ExistenteSolto[]>();
  // Terceira, só pra parcela de fatura: mesma descrição (com o "N/T" normalizado) e valor com a
  // folga dos centavos (ver mesmaParcela). Sem ela, "PARC 02/03" de R$ 33,33 não batia com a
  // parcela 02/03 de R$ 33,34 que a fatura anterior já tinha lançado, e a compra duplicava.
  // Guarda o id e o lote de cada uma: a parcela que esta fatura confirma passa a ser dela (ver `adotar`).
  const parcelasExistentes = new Map<string, ParcelaExistente[]>();
  // Linha importada que ela renomeou ("Definir descrição" no Foco) é comparada pelo nome que o
  // banco deu: com o nome novo, a mesma fatura subida de novo entrava em dobro.
  // Todos os perfis dela: a linha que este perfil mandou pra outro também é comparada (ver abaixo).
  const nomesDoBanco = await descricoesOriginais(ctx, [...new Set([...[...monthsInBatch].map((k) => k.split("|")[0]), ...ownProfileIds])]);
  // Pela data da compra: esta mesma fatura já entrou antes no modelo ANTIGO (inteira num mês, sem
  // dia)? A chave nova (mês da compra, com dia) nunca bate com aquela; sem isto, subir de novo uma
  // fatura antiga duplicava tudo. Só os meses em que um lote antigo tem a maioria das compras.
  let mesesDaFaturaAntiga: { year: number; month: number }[] = [];
  if (modoCompra && contextoFatura) {
    const centro = mesDaData(contextoFatura.vencimento) ?? contextoFatura.limite ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
    const janela = [-1, 0, 1].map((d) => somarMeses(centro, d));
    const perfisDosItens = [...new Set(items.map(profileIdOf))];
    const antigos = await prisma.monthlyEntry.findMany({
      where: {
        userId: ctx.userId, profileId: { in: perfisDosItens },
        entryDate: null,
        importBatchId: { not: null },
        importBatch: { is: { docType: "fatura" } },
        OR: janela,
      },
      select: { id: true, importBatchId: true, year: true, month: true, amount: true, description: true },
    });
    mesesDaFaturaAntiga = mesesDaMesmaFaturaAntiga(
      items.filter((i) => !i.estorno && i.category === "EXPENSE").map((i) => ({ valor: i.amount, descricao: i.description })),
      antigos.map((e) => ({ loteId: e.importBatchId!, year: e.year, month: e.month, valor: Number(e.amount), descricao: nomesDoBanco.get(e.id) ?? e.description })),
    );
    for (const m of mesesDaFaturaAntiga) for (const p of perfisDosItens) monthsInBatch.add(`${p}|${m.year}/${m.month}`);
  }
  for (const key of monthsInBatch) {
    const [profileId, ym] = key.split("|");
    const [y, m] = ym.split("/").map(Number);
    const existing = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId, year: y, month: m },
      select: { id: true, entryDate: true, amount: true, description: true, category: true, importBatchId: true },
    });
    for (const e of existing) {
      const dia = e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null;
      const descricao = nomesDoBanco.get(e.id) ?? e.description;
      const k = `${profileId}|${y}/${m}|${dedupeKey(dia, Number(e.amount), descricao)}`;
      existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
      // Com dia ou sem: a parcela gravada antes (out/2026) ia sem dia; agora vai no dia da compra.
      const ehParcela = Number(e.amount) > 0 && parcelaCerta(descricao) !== null;
      if (ehParcela) {
        const pk = `${profileId}|${y}/${m}|${descricaoComparavel(descricao)}`;
        parcelasExistentes.set(pk, [...(parcelasExistentes.get(pk) ?? []), { valor: Number(e.amount), id: e.id, loteId: e.importBatchId, mes: y * 12 + m, semDia: !dia }]);
      }
      if (dia && e.importBatchId && !ehParcela) {
        const lk = `${profileId}|${chaveSoltaDe(dia, Number(e.amount), e.category)}`;
        looseDescricoes.set(lk, [...(looseDescricoes.get(lk) ?? []), { descricao }]);
      }
    }
  }
  // Linha que uma importação DESTE perfil mandou pra outro ("mandar pra Empresa" na revisão da
  // semana) conta como já lançada aqui também. O extrato do mês traz a mesma linha sem perfil, ela
  // vai pro ativo, e as chaves acima só olham o perfil de destino: a compra entrava de novo no
  // Pessoal, calada. Só a chave exata e a solta (a do extrato); a parcela de fatura continua como era.
  const outrosPerfis = [...ownProfileIds].filter((id) => id !== ctx.profileId);
  const mesesDoAtivo = [...monthsInBatch].flatMap((k) => {
    const [profileId, ym] = k.split("|");
    const [year, month] = ym.split("/").map(Number);
    return profileId === ctx.profileId ? [{ year, month }] : [];
  });
  if (outrosPerfis.length > 0 && mesesDoAtivo.length > 0) {
    const mandadas = await prisma.monthlyEntry.findMany({
      where: { userId: ctx.userId, profileId: { in: outrosPerfis }, importBatchId: { not: null }, importBatch: { is: { profileId: ctx.profileId } }, OR: mesesDoAtivo },
      select: { id: true, entryDate: true, amount: true, description: true, category: true, year: true, month: true },
    });
    for (const e of mandadas) {
      const dia = e.entryDate ? e.entryDate.toISOString().slice(0, 10) : null;
      const descricao = nomesDoBanco.get(e.id) ?? e.description;
      const k = `${ctx.profileId}|${e.year}/${e.month}|${dedupeKey(dia, Number(e.amount), descricao)}`;
      existingCounts.set(k, (existingCounts.get(k) ?? 0) + 1);
      if (dia) {
        const lk = `${ctx.profileId}|${chaveSoltaDe(dia, Number(e.amount), e.category)}`;
        looseDescricoes.set(lk, [...(looseDescricoes.get(lk) ?? []), { descricao }]);
      }
    }
  }
  // Mês da fatura de cada lote que lançou parcela = o primeiro mês em que ele gravou algo (as
  // compras vão todas pro mês escolhido; só as parcelas projetadas caem depois). Parcela num mês
  // DEPOIS desse foi projetada ("as seguintes entram sozinhas"), não veio na fatura daquele lote.
  const lotesComParcela = [...new Set([...parcelasExistentes.values()].flat().flatMap((p) => (p.loteId ? [p.loteId] : [])))];
  const mesDaFaturaDoLote = new Map<string, number>();
  if (ehFatura && lotesComParcela.length > 0) {
    const mesesDosLotes = await prisma.monthlyEntry.findMany({
      // Todos os perfis dela: o lote é de um perfil, mas a revisão pode ter mandado linhas pra outro.
      where: { userId: ctx.userId, profileId: { in: [...ownProfileIds] }, importBatchId: { in: lotesComParcela } },
      select: { importBatchId: true, year: true, month: true },
      distinct: ["importBatchId", "year", "month"],
    });
    for (const { importBatchId, year, month } of mesesDosLotes) {
      if (!importBatchId) continue;
      const mes = year * 12 + month;
      mesDaFaturaDoLote.set(importBatchId, Math.min(mesDaFaturaDoLote.get(importBatchId) ?? mes, mes));
    }
  }
  const ehProjecao = (p: ParcelaExistente) => p.loteId !== null && p.mes > (mesDaFaturaDoLote.get(p.loteId) ?? Infinity);
  /**
   * A parcela que outro lote PROJETOU e esta fatura confirma passa pra este lote. Sem isso,
   * desfazer a fatura de setembro (que tinha projetado 04..12) apagava também a parcela de
   * outubro que a fatura de outubro trouxe e pulou como "já existia", e o mês perdia o gasto
   * sem aviso. A linha que a fatura do outro lote trazia de verdade (mesma fatura subida de
   * novo) não muda de dono: desfazer a cópia não pode levar a original.
   */
  let adotados = 0;
  const adotar = async (id: string, profileId: string, mes: number) => {
    const r = await prisma.monthlyEntry.updateMany({ where: { id, userId: ctx.userId, profileId }, data: { importBatchId: batch.id } });
    adotados += r.count;
    // O mês em que a parcela ESTÁ (pode ser o vizinho do esperado, ver `parcelaJaLancada`).
    const year = Math.floor((mes - 1) / 12);
    if (r.count > 0) touchedMonths.add(`${year}/${mes - year * 12}`);
  };

  /**
   * A compra que entrou pelo PRINT da fatura aberta e chegou de novo (ver lib/import/fatura-aberta):
   * passa para este lote e fica com o valor, o dia e o nome desta linha (a fatura fechada é a
   * verdade). A categoria que ela já tinha dado fica. O nome só muda se ela não tiver renomeado.
   * Só uma compra de um lote de print, deste usuário e de um perfil dela; senão segue o caminho normal.
   */
  const lotesDePrintMexidos = new Set<string>();
  const adotarDoPrint = async (item: ConfirmedItem, ym: { year: number; month: number }, dia: string | null): Promise<boolean> => {
    const atual = await prisma.monthlyEntry.findFirst({
      where: { id: item.adotar!, userId: ctx.userId, profileId: { in: [...ownProfileIds] }, importBatch: { is: { faturaAberta: true } } },
      select: { id: true, importBatchId: true, profileId: true, year: true, month: true },
    });
    if (!atual) return false;
    const renomeada = nomesDoBanco.has(atual.id);
    await prisma.monthlyEntry.update({
      where: { id: atual.id },
      data: {
        importBatchId: batch.id,
        amount: valorGravado(item),
        entryDate: dia ? new Date(`${dia}T12:00:00`) : null,
        year: ym.year,
        month: ym.month,
        ...(renomeada ? {} : { description: item.description }),
      },
    });
    if (atual.importBatchId) lotesDePrintMexidos.add(atual.importBatchId);
    adotados += 1;
    skipped += 1;
    touchedMonths.add(`${atual.year}/${atual.month}`);
    touchedMonths.add(`${ym.year}/${ym.month}`);
    if (ehFatura) mesesDasComprasCriadas.set(`${ym.year}/${ym.month}`, ym);
    return true;
  };

  /** Já existe no banco uma cópia ainda não "gasta" desta chave? Consome uma e diz que sim. */
  const alreadyThere = (k: string) => {
    const left = existingCounts.get(k) ?? 0;
    if (left <= 0) return false;
    existingCounts.set(k, left - 1);
    return true;
  };
  /** Estorno e resgate são gravados negativos: a chave tem que usar o mesmo sinal que está no banco. */
  const valorGravado = (item: ConfirmedItem) =>
    (item.estorno && item.category === "EXPENSE") || (item.resgate && item.category === "INVESTMENT_CONTRIBUTION") ? -item.amount : item.amount;
  const chaveExata = (item: ConfirmedItem, valor = valorGravado(item)) => {
    const ym = monthOf(item);
    return `${profileIdOf(item)}|${ym.year}/${ym.month}|${dedupeKey(diaDe(item), valor, item.description)}`;
  };
  /**
   * A mesma fatura gravada no OUTRO modelo: pela data da compra, a chave antiga (mês em que o lote
   * antigo pôs a fatura, sem dia); pelo mês escolhido, a chave nova (mês e dia da compra). A
   * antiga só nos meses de um lote com a maioria das compras desta fatura: a assinatura que se
   * repete todo mês não é confundida com a do mês passado.
   */
  const chavesDoOutroModelo = (item: ConfirmedItem, parcela: boolean): string[] => {
    if (!ehFatura) return [];
    const resto = parcela ? descricaoComparavel(item.description) : null;
    if (modoCompra) {
      return mesesDaFaturaAntiga.map(
        (m) => `${profileIdOf(item)}|${m.year}/${m.month}|${resto ?? dedupeKey(null, valorGravado(item), item.description)}`,
      );
    }
    const d = destinoPelaCompra(item);
    return d ? [`${profileIdOf(item)}|${d.mes.year}/${d.mes.month}|${resto ?? dedupeKey(d.dia, valorGravado(item), item.description)}`] : [];
  };
  /**
   * Crédito do extrato que ela já tinha marcado como ESTORNO numa importação anterior (gravado
   * como gasto negativo). O extrato do mês traz a mesma linha como renda de novo: a chave exata
   * compara o valor com sinal e a solta compara o tipo, então nenhuma batia e a devolução entrava
   * outra vez, agora como renda que não existe. Só o extrato, e só renda contra valor negativo:
   * valor negativo no banco é sempre estorno, nunca uma compra com a mesma descrição.
   */
  const jaLancadoComoEstorno = (item: ConfirmedItem) => !faturaTarget && item.category === "INCOME" && alreadyThere(chaveExata(item, -item.amount));
  /**
   * Já existe esta parcela (valor com folga de centavos)? Consome uma e devolve qual era.
   * Primeiro no mês certo; se não achar, a parcela que outra fatura PROJETOU no mês vizinho. É o
   * caso do mês escolhido um mês fora (o seletor começa no mês de hoje): setembro projetou a
   * 04/10 em outubro, a fatura de outubro foi lançada em novembro, e a 04/10 e as seguintes
   * ficavam todas em dobro. Só projeção no vizinho: parcela que veio de verdade numa fatura
   * daquele mês é de outra compra igual, não desta.
   */
  const parcelaJaLancada = (k: string, valor: number, total: number): ParcelaExistente | null => {
    const pegar = (chave: string, aceita: (p: ParcelaExistente) => boolean) => {
      const existentes = parcelasExistentes.get(chave) ?? [];
      const i = existentes.findIndex((p) => mesmaParcela(p.valor, valor, total) && aceita(p));
      return i === -1 ? null : existentes.splice(i, 1)[0];
    };
    const [profileId, ym, ...resto] = k.split("|");
    const [year, month] = ym.split("/").map(Number);
    const vizinho = (delta: number) => {
      const v = shiftMonth(year, month, delta);
      return [profileId, `${v.year}/${v.month}`, ...resto].join("|");
    };
    return pegar(k, () => true) ?? pegar(vizinho(-1), ehProjecao) ?? pegar(vizinho(1), ehProjecao);
  };
  /** Parcela de fatura usa SÓ a comparação por parcela (que já cobre o valor exato); o resto usa
   * a chave exata. Como os dois lados decidem pela mesma descrição, um lançamento do banco nunca
   * é "gasto" duas vezes, uma por cada caminho. */
  const chaveParcela = (item: ConfirmedItem) => {
    const parcela = ehFatura && !item.estorno ? parcelaCerta(item.description) : null;
    if (!parcela) return null;
    const ym = monthOf(item);
    return { key: `${profileIdOf(item)}|${ym.year}/${ym.month}|${descricaoComparavel(item.description)}`, total: parcela.total };
  };
  const chaveSolta = (item: ConfirmedItem) => {
    // Parcela de fatura só tem a comparação por parcela (o dia dela é o da compra original).
    if (item.adotar || chaveParcela(item)) return null;
    const dia = diaDe(item);
    return item.amount > 0 && dia ? `${profileIdOf(item)}|${chaveSoltaDe(dia, valorGravado(item), item.category)}` : null;
  };
  // Duas etapas: primeiro o que bate EXATO (mesma descrição), depois, só entre os que sobraram,
  // o que bate por data + valor com a descrição do mesmo jeito (ver casarPorDataEValor).
  const pular = new Set<number>();
  // Parcela pulada que era projeção de outro lote: índice → a parcela (ver `adotar`).
  const confirmadas = new Map<number, ParcelaExistente>();
  // Parcela já no app que foi gravada sem dia: a fatura que chega agora diz o dia (ver abaixo).
  const parcelasSemDia = new Map<number, ParcelaExistente>();
  items.forEach((item, i) => {
    if (item.amount <= 0 || item.adotar) return;
    const parcela = chaveParcela(item);
    let achada = parcela ? parcelaJaLancada(parcela.key, valorGravado(item), parcela.total) : null;
    for (const k of parcela && !achada ? chavesDoOutroModelo(item, true) : []) {
      achada = parcelaJaLancada(k, valorGravado(item), parcela!.total);
      if (achada) break;
    }
    if (achada && ehProjecao(achada)) confirmadas.set(i, achada);
    if (achada?.semDia) parcelasSemDia.set(i, achada);
    const jaExiste = parcela
      ? achada !== null
      : alreadyThere(chaveExata(item)) || jaLancadoComoEstorno(item) || chavesDoOutroModelo(item, false).some(alreadyThere);
    if (jaExiste) pular.add(i);
  });
  const soltas = casarPorDataEValor(items.map(chaveSolta), items.map((item) => item.description), looseDescricoes, { perguntar: false, jaCasados: pular });
  for (const [i, casamento] of soltas) if (casamento.tipo === "mesmo") pular.add(i);

  /**
   * Compra parcelada: as parcelas que ainda vêm entram nos meses seguintes, no mesmo lote
   * (desfazer o lote leva todas). "03/10" em setembro vira 04/10 em outubro… até 10/10.
   * `confident`: "POSTO SHELL 03/09" é data de compra, não parcela 3 de 9 — sem essa checagem
   * o app inventava seis gastos nos meses seguintes. `adotarDe`: a parcela desta fatura era
   * projeção desse lote; as seguintes que ele projetou passam pra este (ver `adotar`), e nada
   * novo é criado (foi assim antes: a parcela que já existia só era pulada).
   */
  const lancarParcelasFuturas = async (
    item: ConfirmedItem,
    ym: { year: number; month: number },
    profileId: string,
    parentCategory: ParentCategory | undefined,
    customCategoryId: string | undefined,
    adotarDe: string | null,
  ) => {
    // Print da fatura aberta não projeta: quem projeta as parcelas seguintes é a fatura fechada.
    if (!ehFatura || aberta || item.estorno || !item.installment?.confident || item.installment.current >= item.installment.total) return;
    const { current, total } = item.installment;
    if (parcelaRecusada(profileId, item.description, total, ym.year * 12 + (ym.month - 1) - (current - 1))) return;
    // O dia da parcela deste mês vale nos seguintes (sem ele, a projetada caía em "Sem data").
    const diaDaCompra = diaDe(item);
    // Loja de tudo (Amazon, Mercado Livre) com a categoria que o app pôs sozinho: as próximas não
    // herdam o palpite, ficam para ela dizer. A que ela escolheu vale para todas.
    const herda = item.learn || !ehLojaDeTudo(item.description);
    for (let n = current + 1; n <= total; n += 1) {
      const offset = n - current;
      const d = new Date(ym.year, ym.month - 1 + offset, 1);
      const mesDaParcela = { year: d.getFullYear(), month: d.getMonth() + 1 };
      const desc = installmentDescription(item.description, n, total);
      // Com o perfil na frente, como todas as chaves de lançamentos existentes: sem ele a
      // checagem nunca achava nada, e subir as faturas fora de ordem (outubro antes de
      // setembro) recriava as parcelas que já estavam lá.
      const futureKey = `${profileId}|${d.getFullYear()}/${d.getMonth() + 1}|${descricaoComparavel(desc)}`;
      const achada = parcelaJaLancada(futureKey, item.amount, total);
      if (achada) {
        if (adotarDe && achada.loteId === adotarDe) await adotar(achada.id, profileId, achada.mes);
        continue;
      }
      // Só adotando: a parcela projetada que não está mais lá foi apagada por ela, não volta.
      if (adotarDe) continue;
      await createMonthlyEntry(ctx, {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        category: item.category,
        parentCategory: item.category === "EXPENSE" && herda ? parentCategory : undefined,
        customCategoryId: herda ? customCategoryId : undefined,
        subcategory: herda ? (item.subcategory ?? undefined) : undefined,
        description: desc,
        amount: item.amount,
        entryDate: diaDaCompra ? new Date(`${diaDaParcela(diaDaCompra, mesDaParcela)}T12:00:00`) : undefined,
        importBatchId: batch.id,
        profileId,
        pessoa: pessoaPara(profileId),
      });
      created += 1;
      parcelasFuturas += 1;
      touchedMonths.add(`${d.getFullYear()}/${d.getMonth() + 1}`);
    }
  };

  // O que ela ensinou nesta importação, por perfil + comerciante (pra aplicar nos outros meses).
  const aprendidas = new Map<string, { profileId: string; regra: { pattern: string; parentCategory: ParentCategory; subcategory?: string; customCategoryId: string | null } }>();
  for (const [indice, item] of items.entries()) {
    if (item.amount <= 0) continue;
    const profileId = profileIdOf(item);
    const ownCustomIds = customCategoriesByProfile.get(profileId) ?? new Set<string>();
    const customCategoryId =
      item.category === "EXPENSE" && item.customCategoryId && ownCustomIds.has(item.customCategoryId)
        ? item.customCategoryId
        : undefined;
    // Categoria personalizada e categoria-mãe são exclusivas: com uma custom, a mãe fica de fora.
    // A personalizada que não existe no perfil de destino (a "Pet" da Pessoal numa linha mandada
    // pra Empresa) cai em Outros: sem isso o gasto era gravado sem categoria nenhuma e sumia de
    // todo orçamento. A tela já tira a personalizada ao mover; isto cobre o que escapar.
    const personalizadaDeOutroPerfil = item.category === "EXPENSE" && Boolean(item.customCategoryId) && !customCategoryId;
    const parentCategory: ParentCategory | undefined =
      !customCategoryId && item.parentCategory && PARENT_CATEGORY_VALUES.includes(item.parentCategory)
        ? item.parentCategory
        : personalizadaDeOutroPerfil
          ? "OUTROS"
          : undefined;

    // Fatura com mês escolhido: todas as compras vão pro MESMO mês, sem dia. Pela data da
    // compra (o padrão): o mês de cada compra, com o dia; parcela no mês dela, sem dia. A chave
    // de duplicata usa o MESMO mês e o MESMO dia que vão pro banco (ver `chaveExata`/`diaDe`).
    const ym = monthOf(item);
    const dia = diaDe(item);
    if (item.adotar && ehFatura && (await adotarDoPrint(item, ym, dia))) {
      // A fatura fechada projeta as parcelas seguintes da compra que veio do print (o print não projeta).
      await lancarParcelasFuturas(item, ym, profileId, parentCategory, customCategoryId, null);
      continue;
    }
    if (pular.has(indice)) {
      skipped += 1;
      // A parcela que estava em "Sem data" ganha o dia que esta fatura diz. Só o dia, e só se
      // continua sem dia: nada do que ela mudou na linha é tocado.
      const semDia = parcelasSemDia.get(indice);
      if (semDia && dia) {
        const r = await prisma.monthlyEntry.updateMany({ where: { id: semDia.id, userId: ctx.userId, profileId, entryDate: null }, data: { entryDate: new Date(`${dia}T12:00:00`) } });
        if (r.count > 0) touchedMonths.add(`${ym.year}/${ym.month}`);
      }
      const confirmada = confirmadas.get(indice);
      if (confirmada) {
        await adotar(confirmada.id, profileId, confirmada.mes);
        // As parcelas seguintes que o mesmo lote projetou também passam pra esta fatura.
        await lancarParcelasFuturas(item, ym, profileId, parentCategory, customCategoryId, confirmada.loteId);
      }
      continue;
    }

    await createMonthlyEntry(ctx, {
      year: ym.year,
      month: ym.month,
      category: item.category,
      parentCategory: item.category === "EXPENSE" ? parentCategory : undefined,
      customCategoryId,
      subcategory: item.subcategory ?? undefined,
      description: item.description,
      amount: valorGravado(item),
      ...(item.moedaDeFora && moedaDeForaValida(item.moedaDeFora.moeda) ? conversaoDaCompra(item.moedaDeFora, valorGravado(item)) : {}),
      // Extrato e compra à vista da fatura: o dia da transação. Parcela e fatura pelo mês
      // escolhido: sem dia.
      entryDate: dia ? new Date(`${dia}T12:00:00`) : undefined,
      importBatchId: batch.id,
      profileId,
      pessoa: pessoaPara(profileId),
    });
    created += 1;
    touchedMonths.add(`${ym.year}/${ym.month}`);
    if (ehFatura) mesesDasComprasCriadas.set(`${ym.year}/${ym.month}`, ym);

    await lancarParcelasFuturas(item, ym, profileId, parentCategory, customCategoryId, null);

    // Aprende a classificação só para gastos com categoria definida pelo usuário, inclusive a
    // personalizada que ela criou (antes só as oito fixas: "Dani Invest" pro ManyChat era
    // esquecida e perguntada de novo todo mês). O Outros de reserva (personalizada de outro
    // perfil) não foi escolha dela: não vira regra. A regra é guardada pela chave do comerciante
    // (comerciante.ts), que é a mesma em todo extrato e todo mês.
    if (item.learn && item.category === "EXPENSE" && (parentCategory || customCategoryId) && !personalizadaDeOutroPerfil) {
      const pattern = chaveDoComerciante(item.description);
      // Loja de tudo não vira regra: a Amazon de hoje (um batom) não diz o que é a do mês que vem.
      if (chaveUtil(pattern) && !ehLojaDeTudo(item.description)) {
        // A regra mora no perfil pra onde a linha FOI, não no aberto: a compra da Kalunga
        // mandada pra Empresa como "Mercadorias e insumos" (chave ALIMENTACAO) virava
        // "Alimentação" na próxima importação da Pessoal, e a Empresa não aprendia nada.
        const regra = { pattern, parentCategory: parentCategory ?? "OUTROS", subcategory: item.subcategory ?? undefined, customCategoryId: customCategoryId ?? null };
        await upsertTransactionRule({ ...ctx, profileId }, regra);
        aprendidas.set(`${profileId}|${pattern}`, { profileId, regra });
      }
    }
  }

  // O que ela ensinou agora vale também nos meses que já estavam no app: os gastos do mesmo
  // comerciante que ainda estão SEM categoria recebem a mesma (nunca troca o que já tem).
  let aplicadosEmOutrosMeses = 0;
  for (const profileId of new Set([...aprendidas.values()].map((a) => a.profileId))) {
    try {
      aplicadosEmOutrosMeses += await aplicarNosOutrosMeses(
        { ...ctx, profileId },
        [...aprendidas.values()].filter((a) => a.profileId === profileId).map((a) => a.regra),
      );
    } catch (err) {
      console.error("aplicarNosOutrosMeses falhou (a importação segue)", err);
    }
  }
  if (aplicadosEmOutrosMeses > 0) revalidatePath("/mensal", "layout");

  // Upload que só tinha duplicata não criou nada: não polui o histórico com lote vazio. (O que
  // só confirmou parcelas projetadas por outro lote não está vazio: agora elas são dele.)
  if (created === 0 && adotados === 0) await deleteEmptyImportBatch(ctx, batch.id);
  // O lote de print que ficou sem nenhuma compra (todas passaram para este) sai do histórico.
  for (const id of lotesDePrintMexidos) if (id !== batch.id) await deleteEmptyImportBatch(ctx, id);

  // Fatura: lista candidatos a "pagamento de fatura" no extrato pra pessoa decidir se remove
  // (evita contar em dobro), sem apagar nada sozinho.
  // O pagamento sai perto do vencimento: é em volta dele que o extrato tem a linha. Sem o
  // vencimento lido, o último mês das compras.
  const mesDoPagamento = faturaTarget ?? mesDaData(datasDaFatura.vencimento) ?? contextoFatura?.limite ?? null;
  // O pagamento que é desta fatura sai sozinho (antes de listar o que ela ainda pode tirar).
  const pagamentosTirados = ehFatura && !aberta && created > 0 ? await tirarPagamentosDaFatura(ctx, [...mesesDasComprasCriadas.values()]) : [];
  for (const p of pagamentosTirados) if (p.date) touchedMonths.add(`${Number(p.date.slice(0, 4))}/${Number(p.date.slice(5, 7))}`);
  const cardPaymentCandidates =
    // A fatura ABERTA (prints) ainda não foi paga: o pagamento que aparecia era o da fatura anterior.
    ehFatura && !aberta && mesDoPagamento && created > 0 ? await findCardPaymentCandidates(ctx, mesDoPagamento.year, mesDoPagamento.month) : [];

  for (const key of touchedMonths) {
    const [year, month] = key.split("/");
    revalidatePath(`/mensal/${year}`);
    revalidatePath(`/mensal/${year}/${month}`);
  }

  // Limite do cartão: a fatura que entrou pode ter passado de 70/90/100% de cada mês em que
  // ela pôs compra (o aviso guarda o que já mandou por mês, não repete).
  if (ehFatura && created > 0) for (const m of mesesDasComprasCriadas.values()) await agendarAvisoDoCartao(ctx, m.year, m.month);

  // Dinheiro perdido: o extrato novo pode trazer carta nova ("2 cartas novas"), e um estorno pedido
  // pode ter caído. Depois da resposta; a Empresa não tem essa tela.
  if (created > 0 && ctx.profileKind !== "EMPRESA") await agendarCacaDoDinheiroPerdido(ctx);
  // Contas do histórico: a Vivo, a luz, o aluguel achados no extrato entram em Recorrentes › Contas
  // sozinhos (a Empresa também tem contas).
  if (created > 0) await agendarContasDoHistorico(ctx);

  await recordImportDiagnostic({
    userId: ctx.userId,
    target: docType,
    stage: "confirm",
    ok: true,
    fileName,
    parsed: items.length,
    created,
    skipped,
  });
  return { ok: true, created, skipped, cardPaymentCandidates, pagamentosTirados, parcelasFuturas };
}

/**
 * Desfaz um lote de importação: apaga o lote E todos os lançamentos que aquele upload criou
 * (upload errado ou duplicado). Só afeta lotes do próprio usuário.
 */
export async function deleteImportBatchAction(id: string): Promise<{ ok: boolean; removed: number }> {
  const ctx = await getRequiredSession();
  const removed = await deleteImportBatchWithEntries(ctx, id);
  revalidatePath("/mensal", "layout");
  return { ok: removed >= 0, removed };
}

/** Vencimento a mais de 2 meses no futuro não é de fatura (é o "Data Vencimento: 2027" de um CDB
 * num relatório subido como fatura): sem ele, a fatura cai no mês das compras, não em 2027. */
function vencimentoPlausivel(venc: string | null): string | null {
  if (!venc) return null;
  const limite = new Date(Date.now() + 62 * 86_400_000).toISOString().slice(0, 10);
  return venc <= limite ? venc : null;
}

/**
 * Os meses que já têm lançamento neste perfil, nos últimos 12 (a faixa do C na entrada da
 * importação, 12/10/2026). "YYYY-MM".
 */
export async function mesesNoAppAction(): Promise<string[]> {
  const ctx = await getRequiredSession();
  const agora = new Date();
  const desde = new Date(agora.getFullYear(), agora.getMonth() - 11, 1);
  const grupos = await prisma.monthlyEntry.groupBy({
    by: ["year", "month"],
    where: { userId: ctx.userId, profileId: ctx.profileId, OR: [{ year: { gt: desde.getFullYear() } }, { year: desde.getFullYear(), month: { gte: desde.getMonth() + 1 } }] },
  });
  return grupos.map((g) => `${g.year}-${String(g.month).padStart(2, "0")}`).sort();
}
