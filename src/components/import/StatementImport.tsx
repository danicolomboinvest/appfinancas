"use client";

import { ehFalhaDeRede, MSG_FALHA_NOSSA, registrarErroNoCliente } from "@/lib/erros/erro-do-cliente";
import { LapisDaCategoria } from "@/components/categorias/LapisDaCategoria";
import { FalarComSuporte } from "@/components/support/FalarComSuporte";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ArrowRight, Lock, Plus, Send, Tag, ChevronLeft, ChevronDown, CircleHelp, Paperclip } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES, categoryLabel, categoriaOculta, categoryIcon, colorForCategorySlice, emojiEscolhido, type CategoriasDoPerfil } from "@/lib/categories";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast-context";
import { createCategoryAction } from "@/lib/actions/category";
import {
  parseStatementAction,
  importTransactionsAction,
  mesesNoAppAction,
  removeCardPaymentCandidateAction,
  conciliarComExtratoAction,
  type ReviewItem,
  type ParseStats,
  type ConfirmedItem,
  type CardPaymentCandidate,
  type EntryType,
} from "@/app/(app)/mensal/import-actions";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { ACEITA_ARQUIVO_DE_EXTRATO, UPLOAD_MAX_BYTES } from "@/lib/import/limites";
import { chaveDeIguais, filaPorComerciante, iguaisPraAplicar, proximaPendente, semCategoria as gastoSemCategoria } from "@/lib/import/revisao-em-grupo";
import { foiSeparada, porqueDaLinha } from "@/lib/import/porque";
import { faixaDosMeses, levarRespostas, resumoDoArquivo } from "@/lib/import/varios-arquivos";
import { mesDaRevelacao } from "@/lib/import/revelacao";
import { listaDeMeses } from "@/lib/import/mes-da-compra";
import { resumoDoMesImportadoAction, type RevelacaoDoImport } from "@/app/(app)/mensal/revelacao-actions";
import { pegarArquivoParaOMes } from "@/components/shell/registrar-eventos";
import { OfertaDeAvisos } from "@/components/push/OfertaDeAvisos";
import { ProtegerSaida } from "./ProtegerSaida";
import { nomeNaTela } from "@/lib/import/nome-na-tela";
import { FitText } from "@/components/ui/FitText";
import { Modal } from "@/components/ui/Modal";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Explica } from "@/components/ui/Explica";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

type Phase = "upload" | "password" | "arquivos" | "review" | "confirm" | "done";

/** Um arquivo do envio com vários (caminho B, 12/10/2026). */
type ArquivoNaFila = {
  id: number;
  file: File;
  status: "esperando" | "lendo" | "ok" | "erro" | "anotado" | "senha";
  /** A senha que abriu este arquivo (fica só na memória da tela, pro "Mudar" reler). */
  pwd?: string;
  /** Tentou abrir com uma senha e ela não serviu. */
  senhaErrada?: boolean;
  docType: "extrato" | "fatura";
  stats?: ParseStats;
  items?: ReviewItem[];
  customCategories?: { id: string; name: string; icon?: string }[];
  erro?: string;
  criados?: number;
  /** "Extrato Itaú · agosto": o nome da aba na revisão. */
  rotulo?: string;
};
export type FaseDaImportacao = Phase;

/** O que o começo (onboarding) vê da importação enquanto ela acontece. */
export type EstadoParaOComeco = {
  fase: Phase;
  lendo: boolean;
  /** Linhas que entram (sem as que ficam de fora). */
  linhas: number;
  /** Quantas precisam dela na revisão. */
  pendentes: number;
  erro: boolean;
  /** Até 4 gastos que o app já separou sozinho, do arquivo dela. */
  amostra: { descricao: string; original: string; categoria: ParentCategory | null; valor: number }[];
  /** A primeira linha que vai precisar dela. */
  primeiraPendente: { descricao: string; original: string; data: string; valor: number } | null;
};

/** "YYYY-MM" do mês corrente, usado como valor inicial do seletor de mês da fatura. */
function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}


/** A pergunta da transferência com o NOME de quem (12/10/2026): "Pix para Daniela Colombo (você mesma)", "Pix de Marina Souza". */
/** O rótulo do que entrou sem resposta na revisão: aparece no lugar da subcategoria. */
const A_CONFERIR = "A conferir";

function tituloDaTransferencia(it: { description: string; category: string; duvida?: string | null }): string {
  const n = nomeNaTela(it.description);
  const pix = /pix/i.test(n.meio ?? it.description);
  const entrada = it.category === "INCOME";
  const como = it.duvida === "resgate" ? (entrada ? "Resgate de" : "Aplicação em") : pix ? (entrada ? "Pix de" : "Pix para") : entrada ? "Transferência de" : "Transferência para";
  return `${como} ${n.nome}${it.duvida === "conta_propria" ? " (conta sua)" : ""}`;
}

function formatDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** Linha que já pode ir pro banco. Gasto SEM categoria também vai (ver `handleImport`). */
function entraNaImportacao(it: ReviewItem): boolean {
  return !it.ignorar;
}

/** Quantas linhas a conferência mostra antes do "Mostrar todos": no celular, 200 linhas de
 * extrato empurravam o botão de importar pra muito longe. */
const LINHAS_VISIVEIS = 30;

/** "2027-06" → "junho de 2027", pro texto de confirmação do mês da fatura. */
function formatMonthYear(monthValue: string): string {
  const [y, m] = monthValue.split("-").map(Number);
  if (!y || !m) return monthValue;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** O arquivo vai CRU num FormData (string grande de base64 estoura o limite de serialização
 * das actions). O encoding diz ao servidor como interpretar os bytes. */
function buildUploadForm(file: File, docType: "extrato" | "fatura", faturaMonth?: string): FormData {
  const name = file.name.toLowerCase();
  const encoding = name.endsWith(".xlsx") || name.endsWith(".xls") ? "xlsx" : name.endsWith(".pdf") ? "pdf" : "text";
  const formData = new FormData();
  formData.set("file", file);
  formData.set("encoding", encoding);
  formData.set("docType", docType);
  if (faturaMonth) formData.set("faturaMonth", faturaMonth);
  return formData;
}

/**
 * Importação de extrato bancário (item 3). Upload CSV/OFX → classificação automática → fila de
 * revisão (uma transação por vez, chips de categoria em 1 toque) → confirmação. As categorias
 * definidas na revisão viram regra aprendida no servidor pra próxima importação.
 */
export function StatementImport({
  onDone,
  otherProfiles = [],
  comeco,
}: {
  onDone: () => void;
  /**
   * Dentro do começo (onboarding, versão nova): a tela de fora mostra os quadros "Eu leio e separo"
   * enquanto o arquivo é lido e, quando a importação grava, segue para a Visão geral em vez de
   * mostrar o "pronto" daqui. Fora do começo, nada muda.
   */
  comeco?: {
    aoMudar?: (estado: EstadoParaOComeco) => void;
    aoImportar?: (resultado: { mes: { year: number; month: number } | null; revisou: boolean; criados: number }) => void;
    /** A importação está na tela? Escondida atrás dos quadros, ela não pergunta "Sair da importação?". */
    visivel?: boolean;
  };
  /** Os OUTROS perfis do usuário (não o ativo) — deixa mandar uma linha da fatura pra lá em vez
   * do perfil ativo (ex.: compra da Empresa que caiu no cartão Pessoal). Vazio pra quem só tem
   * um perfil: nenhum botão extra aparece. */
  otherProfiles?: { id: string; name: string; kind?: string }[];
}) {
  const money = useMoney();
  const { showToast, showError } = useToast();
  // Tudo que a pessoa lê aqui (instruções, botões, avisos) vem da voz do tema; a lógica de
  // leitura do arquivo não sabe de tema nenhum.
  // `kind` porque os chips de categoria têm o nome do perfil (Empresa: "Estrutura", não "Moradia").
  const { voz, profileId, categorias, nomesDoCasal, key: tema } = useProfileTheme();
  const t = voz.titulos;
  // O perfil de quando a tela abriu: a revisão (categorias, "mandar pra outro perfil") é dele. Se
  // ela trocar de perfil noutro aparelho no meio, o servidor recusa em vez de importar no novo.
  const [perfilDaTela] = useState(profileId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("upload");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [reviewIdx, setReviewIdx] = useState(0);
  const [createdCount, setCreatedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [docType, setDocType] = useState<"extrato" | "fatura">("extrato");
  // Vários arquivos de uma vez (caminho B): a fila, qual está aberto na revisão e os meses já no app (C).
  const [fila, setFila] = useState<ArquivoNaFila[] | null>(null);
  const [filaAtual, setFilaAtual] = useState<number | null>(null);
  const [mesesNoApp, setMesesNoApp] = useState<string[]>([]);
  const [lendoFila, setLendoFila] = useState(false);
  useEffect(() => {
    let vivo = true;
    mesesNoAppAction()
      .then((m) => vivo && setMesesNoApp(m))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  // O último arquivo lido (e a senha, se tinha): o "Mudar" relê como o outro tipo.
  const [ultimoArquivo, setUltimoArquivo] = useState<{ file: File; pwd?: string } | null>(null);
  // Perfil Casal: de quem é o extrato/fatura. Todas as linhas entram com esse nome em "quem pagou".
  const [pessoaDoExtrato, setPessoaDoExtrato] = useState<"A" | "B">("A");
  // Mês/ano de destino da FATURA (todas as compras entram nesse mês, escolhido por quem importa
  // — não no mês de cada compra, que fica espalhado pelo período de fechamento da fatura).
  const [faturaMonth, setFaturaMonth] = useState(currentMonthValue());
  const [conferirAberto, setConferirAberto] = useState(false);
  const [cardPaymentCandidates, setCardPaymentCandidates] = useState<CardPaymentCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Excel do banco costuma vir protegido por senha: guardamos o arquivo e pedimos a senha.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Nome do arquivo subido — vai pro histórico de importações ("o que era este lote?").
  const [fileName, setFileName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [stats, setStats] = useState<ParseStats | null>(null);
  /** O app achou que o arquivo é de outro tipo: pergunta antes de seguir. `pwd` é a senha que
   * abriu o arquivo, se ele era trancado — a resposta reenvia o arquivo e precisa dela de novo. */
  const [kindMismatch, setKindMismatch] = useState<{ file: File; suggested: "extrato" | "fatura"; reason: string; pwd?: string } | null>(null);
  // Categorias personalizadas do usuário + a criação na hora ("+ Outra") durante a revisão.
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  // Ela mexeu no mês da fatura à mão: o vencimento lido do arquivo vira só uma sugestão, não
  // troca a escolha dela.
  const [faturaMesTocado, setFaturaMesTocado] = useState(false);
  // Fatura: o app separa cada compra no mês em que foi feita, sem perguntar. "Mudar" abre a
  // escolha de contar tudo num mês só (o modo antigo), só pra ESTA fatura.
  const [contarNoMes, setContarNoMes] = useState(false);
  const [mudandoFatura, setMudandoFatura] = useState(false);
  // Conferência: a linha aberta pra trocar categoria/tipo, e se a lista longa está inteira.
  const [editandoKey, setEditandoKey] = useState<number | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  // "Eu já separei 64. Revisar": as linhas que o app separou sozinho, congeladas no toque (trocar a
  // categoria de uma não a tira da lista no meio da revisão). null = lista normal.
  const [separadosEmRevisao, setSeparadosEmRevisao] = useState<Set<number> | null>(null);
  // "Responder igual nas parecidas" vale por padrão.
  const [igualNasParecidas, setIgualNasParecidas] = useState(true);
  // As que ela respondeu "Não sei": entram como "A conferir" e saem da conta das perguntas.
  const [naoSei, setNaoSei] = useState<Set<number>>(new Set());
  // Depois de importar: o mês montado. `mes` null = arquivo sem data, fica só o "pronto".
  const [revelacao, setRevelacao] = useState<{ mes: { year: number; month: number } | null; dados: RevelacaoDoImport | null; carregando: boolean }>({
    mes: null,
    dados: null,
    carregando: false,
  });
  // A área da revisão/conferência: toque fora dela (Voltar, X, fundo escuro) pergunta antes de fechar.
  const areaRef = useRef<HTMLDivElement>(null);

  function escolherMesFatura(valor: string) {
    setFaturaMonth(valor);
    setFaturaMesTocado(true);
  }

  /**
   * Fila de revisão CONGELADA na entrada: as chaves dos gastos que chegaram sem categoria.
   *
   * Antes a fila era recalculada a cada render a partir de `items` — classificar o item 1 o
   * tirava da fila E o índice avançava, então o item 2 era pulado e, no fim, descartado sem
   * aviso na hora de importar (o filtro de `handleImport` derruba gasto sem categoria). Com a
   * lista fixa, cada toque anda exatamente uma posição e ninguém some.
   */
  const [reviewKeys, setReviewKeys] = useState<number[]>([]);
  const reviewQueue = reviewKeys.flatMap((key) => {
    const it = items.find((x) => x.key === key);
    return it ? [{ it, i: key }] : [];
  });

  // Escondida atrás dos quadros do começo, tocar fora dela não é sair.
  const protegerSaida = !comeco || comeco.visivel === true;

  // O começo acompanha a leitura (para os quadros) sem saber de nada daqui de dentro. As linhas de
  // amostra são as DELA (as primeiras que o app já separou), nunca um exemplo.
  const aoMudarDoComeco = comeco?.aoMudar;
  useEffect(() => {
    if (!aoMudarDoComeco) return;
    const separadas = items.filter((it) => !it.ignorar && it.category === "EXPENSE" && (it.parentCategory || it.customCategoryId));
    const pendente = reviewKeys.length > 0 ? items.find((it) => it.key === reviewKeys[0]) : undefined;
    aoMudarDoComeco({
      fase: phase,
      lendo: isPending,
      linhas: items.filter((it) => !it.ignorar).length,
      pendentes: reviewKeys.length,
      erro: error !== null || kindMismatch !== null,
      amostra: separadas.slice(0, 4).map((it) => ({ descricao: nomeNaTela(it.description).nome, original: it.description, categoria: it.parentCategory, valor: it.amount })),
      primeiraPendente: pendente ? { descricao: nomeNaTela(pendente.description).nome, original: pendente.description, data: pendente.date, valor: pendente.amount } : null,
    });
  }, [aoMudarDoComeco, phase, isPending, items, reviewKeys, error, kindMismatch]);

  // Veio da Carteira com um extrato subido lá por engano: começa a ler esse arquivo na hora.
  const handleFileRef = useRef<(file: File) => void>(() => {});
  useEffect(() => {
    const arquivo = pegarArquivoParaOMes();
    // Depois do primeiro desenho: a referência para o handleFile de agora é ligada num efeito abaixo.
    if (arquivo) setTimeout(() => handleFileRef.current(arquivo), 0);
  }, []);

  function handleFile(file: File) {
    setError(null);
    // Arquivo novo: a pergunta de tipo (e a senha guardada nela) era do anterior.
    setKindMismatch(null);
    // …e o vencimento lido também: sem isso o "achei no arquivo" do anterior aparecia no novo.
    setStats(null);
    // "Tudo num mês só" era escolha da fatura anterior.
    setContarNoMes(false);
    setMudandoFatura(false);
    // Barra aqui o que a Vercel recusaria com 413 lá fora, onde não sobra nem registro.
    if (file.size > UPLOAD_MAX_BYTES) {
      setError(t.impArquivoGrande);
      return;
    }
    runParse(file);
  }

  /** Lê o arquivo no servidor. Se o Excel estiver protegido, cai na tela de senha; com a senha,
   * reenvia o MESMO arquivo pra descriptografar e seguir. */
  function runParse(file: File, pwd?: string, forcedType?: "extrato" | "fatura", acceptKind = false) {
    setError(null);
    setFileName(file.name);
    setUltimoArquivo({ file, pwd });
    const type = forcedType ?? docType;
    const formData = buildUploadForm(file, type, type === "fatura" && contarNoMes ? faturaMonth : undefined);
    if (pwd) formData.set("password", pwd);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof parseStatementAction>>;
      try {
        result = await parseStatementAction(formData);
      } catch (err) {
        console.error("parseStatementAction falhou no envio", err);
        registrarErroNoCliente("importar-ler", err);
        // "Confira a internet" só quando foi a internet mesmo (12/10/2026).
        setError(ehFalhaDeRede(err) ? t.impErroEnvio : MSG_FALHA_NOSSA);
        return;
      }
      if (!result.ok) {
        if (result.needsPassword) {
          setPendingFile(file);
          setPhase("password");
          // Se já tinha tentado com senha (veio de novo needsPassword), mostra que a senha não serviu.
          setError(pwd ? result.error : null);
          return;
        }
        setError(result.error);
        return;
      }
      // Uma porta só (12/10/2026): o app segue com o tipo que ele detectou, sem perguntar. Quem
      // discordar toca no "Mudar" discreto depois da leitura.
      if (!acceptKind && result.stats.detectedKind !== "unknown" && result.stats.detectedKind !== type) {
        setDocType(result.stats.detectedKind);
        runParse(file, pwd, result.stats.detectedKind, true);
        return;
      }
      // Fatura: o mês certo é o do vencimento. Se o arquivo diz e ela não escolheu outro à mão,
      // já fica escolhido (o seletor começa no mês de hoje, e era aí que a fatura caía errada).
      if (type === "fatura" && result.stats.vencimento && !faturaMesTocado) setFaturaMonth(result.stats.vencimento.slice(0, 7));
      setKindMismatch(null);
      carregarLeitura(result.stats, result.items, result.customCategories);
    });
  }

  /** Põe uma leitura na revisão B (um arquivo só, ou o arquivo aberto da fila). */
  function carregarLeitura(novos: ParseStats, linhas: ReviewItem[], categorias: { id: string; name: string; icon?: string }[]) {
    setStats(novos);
    setItems(linhas);
    setCustomCategories(categorias);
    setReviewIdx(0);
    setNaoSei(new Set());
    // O que é dúvida (dinheiro dela mesma) ou fica de fora não pede categoria agora.
    const pendentes = linhas.filter((it) => gastoSemCategoria(it) && !it.ignorar && !it.duvida);
    // Uma pergunta por comerciante, não por linha (12/10/2026): a resposta vale pro grupo.
    const filaDeRevisao = filaPorComerciante(pendentes);
    setReviewKeys(filaDeRevisao.keys);
    setSeparadosEmRevisao(null);
    // Caminho B (12/10/2026): primeiro a confirmação calma e o "Separei N de M"; as perguntas
    // que sobram vêm depois, em cartões grandes, quando ela tocar em Responder.
    setPhase("confirm");
  }

  /** Lê um arquivo da fila no servidor, seguindo o tipo que o app detectar (ou o forçado no "Mudar"). */
  async function lerDaFila(arq: ArquivoNaFila, forcado?: "extrato" | "fatura", pwd: string | undefined = arq.pwd): Promise<ArquivoNaFila> {
    if (arq.file.size > UPLOAD_MAX_BYTES) return { ...arq, status: "erro", erro: t.impArquivoGrande };
    const tentar = async (tipo: "extrato" | "fatura") => {
      const form = buildUploadForm(arq.file, tipo);
      if (pwd) form.set("password", pwd);
      return parseStatementAction(form);
    };
    try {
      let tipo = forcado ?? arq.docType;
      let r = await tentar(tipo);
      if (r.ok && !forcado && r.stats.detectedKind !== "unknown" && r.stats.detectedKind !== tipo) {
        tipo = r.stats.detectedKind;
        r = await tentar(tipo);
      }
      // Com senha (12/10/2026): em vez de mandar enviar sozinho, o arquivo espera a senha, e uma
      // senha só abre todos os que estão esperando (os PDFs do mesmo banco usam a mesma).
      if (!r.ok && r.needsPassword) return { ...arq, status: "senha", senhaErrada: !!pwd, pwd: undefined, erro: undefined };
      if (!r.ok) return { ...arq, status: "erro", erro: r.error };
      const resumo = resumoDoArquivo(tipo, r.stats, r.items);
      const meses = resumo.chips[resumo.chips.length - 1];
      return { ...arq, status: "ok", pwd, senhaErrada: false, docType: tipo, stats: r.stats, items: r.items, customCategories: r.customCategories, erro: undefined, rotulo: meses && !/compra|lançamento|vence/.test(meses) ? `${resumo.titulo} · ${meses}` : resumo.titulo };
    } catch (err) {
      registrarErroNoCliente("importar-ler", err);
      return { ...arq, status: "erro", erro: ehFalhaDeRede(err) ? t.impErroEnvio : MSG_FALHA_NOSSA };
    }
  }

  /**
   * Vários arquivos: o servidor lê um por vez, em sequência (cada um no seu envio, cada um dentro do
   * limite de tamanho), e cada linha da lista mostra o que o app achou assim que termina.
   */
  async function lerFila(novos: File[], juntarCom: ArquivoNaFila[] = []) {
    const base = juntarCom.length ? Math.max(...juntarCom.map((a) => a.id)) + 1 : 0;
    let lista: ArquivoNaFila[] = [...juntarCom, ...novos.map((file, i) => ({ id: base + i, file, status: "esperando" as const, docType: "extrato" as const }))];
    setFila(lista);
    setFilaAtual(null);
    setError(null);
    setPhase("arquivos");
    setLendoFila(true);
    for (const arq of lista.filter((a) => a.status === "esperando")) {
      lista = lista.map((a) => (a.id === arq.id ? { ...a, status: "lendo" } : a));
      setFila(lista);
      const lido = await lerDaFila(arq);
      lista = lista.map((a) => (a.id === arq.id ? lido : a));
      setFila(lista);
    }
    setLendoFila(false);
  }

  /** Uma senha para todos os arquivos que pediram senha: tenta em cada um, um por vez. */
  async function abrirComSenha(senha: string) {
    if (!fila) return;
    let lista = fila;
    setError(null);
    setLendoFila(true);
    for (const arq of lista.filter((a) => a.status === "senha")) {
      lista = lista.map((a) => (a.id === arq.id ? { ...a, status: "lendo" } : a));
      setFila(lista);
      const lido = await lerDaFila(arq, undefined, senha);
      lista = lista.map((a) => (a.id === arq.id ? lido : a));
      setFila(lista);
    }
    setLendoFila(false);
    if (!lista.some((a) => a.status === "senha")) setPassword("");
  }

  /** "Mudar" num arquivo da lista: relê como o outro tipo. */
  async function mudarTipoNaFila(id: number) {
    if (!fila) return;
    const arq = fila.find((a) => a.id === id);
    if (!arq) return;
    const outro = arq.docType === "fatura" ? "extrato" : "fatura";
    setFila((l) => l?.map((a) => (a.id === id ? { ...a, status: "lendo" } : a)) ?? null);
    const lido = await lerDaFila(arq, outro);
    setFila((l) => l?.map((a) => (a.id === id ? lido : a)) ?? null);
  }

  /** Abre um arquivo da fila na revisão B; o que estava aberto guarda as respostas dadas até ali. */
  function abrirDaFila(id: number, listaAtual: ArquivoNaFila[] | null = fila) {
    if (!listaAtual) return;
    let lista = listaAtual;
    if (filaAtual !== null && filaAtual !== id) lista = lista.map((a) => (a.id === filaAtual && a.status === "ok" ? { ...a, items } : a));
    const arq = lista.find((a) => a.id === id);
    if (!arq || arq.status !== "ok" || !arq.stats || !arq.items) return;
    setFila(lista);
    setFilaAtual(id);
    setDocType(arq.docType);
    setFileName(arq.file.name);
    setUltimoArquivo({ file: arq.file });
    carregarLeitura(arq.stats, arq.items, arq.customCategories ?? []);
  }

  /**
   * Põe a categoria na linha E nos iguais dela (mesma loja, mesmo Pix — ver revisao-em-grupo):
   * cinco Pix pra mesma pessoa eram cinco toques. Devolve as chaves que ganharam categoria, pra
   * fila pular as que já foram resolvidas junto.
   */
  function aplicarCategoria(itemKey: number, escolha: { parentCategory: ParentCategory | null; customCategoryId: string | null }): Set<number> {
    const iguais = igualNasParecidas ? iguaisPraAplicar(items, itemKey) : [];
    const resolvidas = new Set([itemKey, ...iguais]);
    setItems((prev) =>
      prev.map((it) =>
        resolvidas.has(it.key)
          ? { ...it, ...escolha, subcategory: null, autoClassified: false, motivo: it.key === itemKey ? ("regra_sua" as const) : ("mesmo_nome" as const), confianca: "alta" as const }
          : it,
      ),
    );
    if (iguais.length > 0) showToast(t.impAplicadoAosIguais(iguais.length));
    return resolvidas;
  }

  /** Categoria-mãe fixa: zera a personalizada. */
  function assignParent(itemKey: number, parentCategory: ParentCategory): Set<number> {
    return aplicarCategoria(itemKey, { parentCategory, customCategoryId: null });
  }

  /** Categoria personalizada: zera a categoria-mãe fixa. */
  function assignCustom(itemKey: number, customCategoryId: string): Set<number> {
    return aplicarCategoria(itemKey, { parentCategory: null, customCategoryId });
  }

  /** Cria a categoria na hora ("+ Outra"), já disponível pra planejar depois no Orçamento. */
  function createAndAssign(itemKey: number) {
    const name = newCatName.trim();
    if (!name) return;
    startTransition(async () => {
      // Falha de rede rejeita a action: sem o catch, o erro subia pro error boundary e a
      // importação inteira (com a revisão feita até ali) virava a tela de erro.
      let res: Awaited<ReturnType<typeof createCategoryAction>>;
      try {
        res = await createCategoryAction(name);
      } catch (err) {
        console.error("createCategoryAction falhou no envio", err);
        setError(t.impErroSalvar);
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCustomCategories((prev) => (prev.some((c) => c.id === res.id) ? prev : [...prev, { id: res.id, name: res.name }]));
      const resolvidas = assignCustom(itemKey, res.id);
      setCreatingCat(false);
      setNewCatName("");
      // Criada na conferência (fora da fila), não há fila pra andar.
      if (phase === "review") advanceReview(resolvidas);
    });
  }

  /**
   * Anda a fila até o próximo gasto que ainda pede resposta. `resolvidas` são as linhas que o
   * último toque resolveu (a própria e as iguais): o estado de `items` ainda não mudou neste
   * render, então elas vêm à parte. "Não sei agora" chama sem nada: a linha segue sem categoria
   * e a fila só anda.
   */
  function advanceReview(resolvidas: Set<number> = new Set()) {
    const pendente = (key: number) => {
      if (resolvidas.has(key)) return false;
      const it = items.find((x) => x.key === key);
      return Boolean(it && gastoSemCategoria(it) && !it.ignorar && !it.duvida);
    };
    const proxima = proximaPendente(reviewKeys, reviewIdx, pendente);
    setCreatingCat(false);
    if (proxima === null) setPhase("confirm");
    else setReviewIdx(proxima);
  }

  /** Corrigiu a categoria errado no anterior? Volta um passo na fila, sem sair da importação
   * nem perder o que já foi classificado — ao contrário do "Voltar" do topo do drawer, que
   * fecha o fluxo inteiro e reseta tudo (a pessoa tinha que subir o arquivo de novo). */
  function retreatReview() {
    setReviewIdx((i) => Math.max(0, i - 1));
  }

  /** Alterna o destino da linha entre o perfil ativo e `profileId` (compra da Empresa que caiu
   * no cartão Pessoal, por exemplo). Clicar de novo no mesmo perfil volta pro ativo. */
  function toggleProfile(itemKey: number, profileId: string) {
    // Categoria personalizada é do perfil ATIVO: no outro perfil ela não existe, e o gasto era
    // gravado lá sem categoria nenhuma enquanto esta tela seguia mostrando o nome dela. Sai junto
    // com a troca, e a linha cai em "sem categoria" pra ser classificada com as fixas.
    setItems((prev) =>
      prev.map((it) =>
        it.key === itemKey
          ? { ...it, profileId: it.profileId === profileId ? null : profileId, ...(it.customCategoryId ? { customCategoryId: null, autoClassified: false } : {}) }
          : it,
      ),
    );
  }

  /** Muda o TIPO do lançamento (Gasto/Renda/Aporte) — pro Pix que a pessoa manda pra ela mesma
   * pra investir, por exemplo: o sinal do extrato só sabe "saiu da conta", não sabe que virou
   * aporte. Categoria/personalizada só fazem sentido em Gasto, então saem ao trocar pra outro tipo. */
  function toggleType(itemKey: number, tipo: EntryType | "ESTORNO" | "RESGATE") {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        // Estorno = gasto que voltou: fica como gasto (negativo) e precisa de categoria pra
        // descontar da compra; sem uma, vai pra Outros.
        if (tipo === "ESTORNO") return { ...it, category: "EXPENSE", estorno: true, resgate: false, parentCategory: it.parentCategory ?? (it.customCategoryId ? null : "OUTROS") };
        if (tipo === "RESGATE") return { ...it, category: "INVESTMENT_CONTRIBUTION", resgate: true, estorno: false, parentCategory: null, customCategoryId: null };
        return { ...it, category: tipo, estorno: false, resgate: false, ...(tipo === "EXPENSE" ? {} : { parentCategory: null, customCategoryId: null }) };
      }),
    );
  }

  /**
   * Dinheiro dela mesma: "gasto" (categoria depois), "guardei" (aporte), "renda", ou "mudei"
   * (só passou de uma conta pra outra, ou voltou da aplicação: fica de fora).
   */
  function responderDinheiroProprio(itemKey: number, resposta: "gasto" | "guardei" | "renda" | "mudei") {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== itemKey) return it;
        // Voltou do que ela guardou: entra como resgate (guardado negativo), não fica de fora.
        // Ficando de fora, o dinheiro aparecia na conta e o investimento nunca diminuía.
        if (resposta === "mudei" && it.duvida === "resgate") {
          return { ...it, category: "INVESTMENT_CONTRIBUTION", resgate: true, parentCategory: null, customCategoryId: null, duvida: null, nota: "Resgate: desconta do que você guardou. Depois, na Carteira, diga de qual investimento saiu." };
        }
        if (resposta === "gasto") return { ...it, category: "EXPENSE", duvida: null };
        if (resposta === "guardei") return { ...it, category: "INVESTMENT_CONTRIBUTION", parentCategory: null, customCategoryId: null, duvida: null };
        if (resposta === "renda") return { ...it, category: "INCOME", parentCategory: null, customCategoryId: null, duvida: null };
        return { ...it, ignorar: true, duvida: null, nota: "Dinheiro seu mudando de lugar: fica de fora." };
      }),
    );
  }

  /** "É o mesmo que já está no app (lançado à mão ou de outro arquivo)?": sim tira da importação; não, importa normalmente. */
  function responderDuplicata(itemKey: number, mesmo: boolean) {
    // Lançamento à mão com valor ou dia diferentes (a conta prevista antes de pagar): "é o mesmo"
    // deixa o lançamento com o que o extrato diz que aconteceu, em vez de manter o estimado.
    const item = items.find((it) => it.key === itemKey);
    const dup = item?.possivelDuplicata;
    const ajustar = mesmo && item && dup?.id && (Math.abs((dup.valor ?? item.amount) - item.amount) > 0.005 || (dup.data ?? item.date) !== item.date);
    if (ajustar) {
      void conciliarComExtratoAction({ id: dup!.id!, valor: item!.amount, data: item!.date }).then((r) => {
        if (r.error) showError(r.error);
      });
    }
    setItems((prev) => (mesmo ? prev.filter((it) => it.key !== itemKey) : prev.map((it) => (it.key === itemKey ? { ...it, possivelDuplicata: null } : it))));
  }

  function handleImport() {
    // Gasto sem categoria ("Não sei agora") ENTRA, sem categoria: antes ele sumia calado da
    // importação, e o mês ficava com o saldo inflado. O servidor já grava gasto sem categoria
    // (ele aparece como "Sem categoria" na tela do mês) e só não aprende regra dele.
    // Sem resposta (12/10/2026): a dúvida de dinheiro próprio entra sem categoria, marcada "A conferir";
    // o "é o mesmo?" sem resposta entra como lançamento novo, também "A conferir".
    const aConferir = (it: ReviewItem) => !!it.duvida || !!it.possivelDuplicata || (gastoSemCategoria(it) && !it.estorno);
    const confirmed: ConfirmedItem[] = items
      .filter(entraNaImportacao)
      .map((it) => (aConferir(it) ? { ...it, parentCategory: null, customCategoryId: null, subcategory: A_CONFERIR, autoClassified: true } : it))
      .map((it) => ({
        date: it.date,
        description: it.description,
        amount: it.amount,
        category: it.category,
        parentCategory: it.parentCategory,
        customCategoryId: it.customCategoryId,
        subcategory: it.subcategory,
        // Aprende quando foi o usuário quem classificou (não veio 100% automático).
        learn: !it.autoClassified,
        installment: it.installment,
        profileId: it.profileId,
        estorno: it.estorno ?? false,
        resgate: it.resgate ?? false,
      }));
    // Sem mês escolhido, o servidor põe cada compra no mês dela (com o vencimento e o fechamento lidos).
    const [targetYear, targetMonth] = docType === "fatura" && contarNoMes ? faturaMonth.split("-").map(Number) : [undefined, undefined];
    const datasDaFatura = docType === "fatura" ? { vencimento: stats?.vencimento ?? null, fechamento: stats?.fechamento ?? null } : null;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof importTransactionsAction>>;
      try {
        result = await importTransactionsAction(confirmed, docType, targetYear, targetMonth, fileName ?? undefined, perfilDaTela, nomesDoCasal ? pessoaDoExtrato : null, datasDaFatura);
      } catch (err) {
        console.error("importTransactionsAction falhou no envio", err);
        registrarErroNoCliente("importar-gravar", err);
        setError(ehFalhaDeRede(err) ? t.impErroSalvar : MSG_FALHA_NOSSA);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Vários arquivos: este fica anotado, as respostas dadas nele valem nos próximos, e a revisão
      // segue para o próximo arquivo. As repetidas entre eles o servidor já pula ao gravar.
      if (fila && filaAtual !== null) {
        let lista = fila.map((a) => (a.id === filaAtual ? { ...a, status: "anotado" as const, criados: result.created, items: undefined } : a));
        let levadas = 0;
        lista = lista.map((a) => {
          if (a.status !== "ok" || !a.items) return a;
          const r = levarRespostas(items, a.items);
          levadas += r.levadas;
          return { ...a, items: r.linhas };
        });
        const proximo = lista.find((a) => a.status === "ok");
        const total = lista.reduce((soma, a) => soma + (a.criados ?? 0), 0);
        if (proximo) {
          showToast(levadas > 0 ? `${t.impToastImportados(result.created)}. Levei ${levadas} ${levadas === 1 ? "resposta" : "respostas"} para o próximo arquivo.` : `${t.impToastImportados(result.created)}.`);
          setFilaAtual(null);
          abrirDaFila(proximo.id, lista);
          return;
        }
        setFila(lista);
        setCreatedCount(total);
        setSkippedCount(result.skipped);
        setCardPaymentCandidates(result.cardPaymentCandidates);
        setRevelacao({ mes: null, dados: null, carregando: false });
        setPhase("done");
        showToast(`${t.impToastImportados(total)}.`);
        return;
      }
      setCreatedCount(result.created);
      setSkippedCount(result.skipped);
      setCardPaymentCandidates(result.cardPaymentCandidates);
      // O mês montado: busca DEPOIS de gravar, fora da transição (o "pronto" aparece já, e os
      // números chegam em seguida). Linha mandada pra outro perfil não conta pro mês deste.
      const mes = mesDaRevelacao(
        confirmed.filter((c) => !c.profileId).map((c) => c.date),
        targetYear && targetMonth ? { year: targetYear, month: targetMonth } : null,
      );
      setRevelacao({ mes, dados: null, carregando: mes !== null });
      if (comeco?.aoImportar) {
        // No começo, o mês montado aparece na Visão geral (o "aha"), não aqui.
        comeco.aoImportar({ mes, revisou: reviewKeys.length > 0, criados: result.created });
        setPhase("done");
        return;
      }
      if (mes) {
        resumoDoMesImportadoAction(mes.year, mes.month, perfilDaTela)
          .then((dados) => setRevelacao({ mes, dados, carregando: false }))
          .catch((err) => {
            // Sem os números, fica o "pronto" de sempre: a importação já deu certo.
            console.error("resumoDoMesImportadoAction falhou", err);
            setRevelacao({ mes, dados: null, carregando: false });
          });
      }
      setPhase("done");
      const parts = [t.impToastImportados(result.created)];
      if (result.skipped > 0) parts.push(t.impToastJaExistiam(result.skipped));
      showToast(parts.join(", ") + ".");
    });
  }

  /** Some da lista assim que a pessoa decide (removeu ou manteve), sem esperar recarregar a página. */
  function dismissCandidate(id: string) {
    setCardPaymentCandidates((prev) => prev.filter((c) => c.id !== id));
  }

  /**
   * A fatura nos três lugares em que ela aparece (envio, aviso de "parece fatura" e conferência).
   * Nada de "de que mês é essa fatura?": o app lê o fechamento, o vencimento e a data de cada
   * compra, e só confirma numa frase. "Mudar" (discreto) deixa contar tudo num mês só.
   */
  function mesDaFatura(id: string) {
    if (!stats) return <p className="text-caption text-ink-faint">{t.impFaturaAntesDoArquivo}</p>;
    const diaMes = (iso: string | null) => (iso ? formatDate(iso) : null);
    const frase = contarNoMes
      ? t.impFaturaTudoNoMesDica(formatMonthYear(faturaMonth))
      : t.impFaturaResumo(stats.banco, diaMes(stats.fechamento), diaMes(stats.vencimento), stats.compras, listaDeMeses(stats.mesesDasCompras), stats.mesesDasCompras.length > 1);
    const opcao = (ativo: boolean, rotulo: string, aoTocar: () => void) => (
      <button
        type="button"
        onClick={aoTocar}
        aria-pressed={ativo}
        className={`min-h-11 flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${ativo ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"}`}
      >
        {rotulo}
      </button>
    );
    return (
      <div className="flex flex-col gap-1.5" id={id}>
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-sm text-ink">{frase}</span>
          <button
            type="button"
            onClick={() => setMudandoFatura((v) => !v)}
            aria-expanded={mudandoFatura}
            className="inline-flex min-h-11 items-center text-caption text-ink-muted underline underline-offset-4"
          >
            {mudandoFatura ? t.impMudarPronto : t.impFaturaMudar}
          </button>
        </div>
        {mudandoFatura && (
          <div className="flex flex-col gap-2">
            <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
              {opcao(!contarNoMes, t.impFaturaPorCompra, () => setContarNoMes(false))}
              {opcao(contarNoMes, t.impFaturaTudoNoMes, () => {
                // Começa no mês do vencimento lido, se ela não escolheu outro antes.
                if (stats.vencimento && !faturaMesTocado) setFaturaMonth(stats.vencimento.slice(0, 7));
                setContarNoMes(true);
              })}
            </div>
            {contarNoMes && <MonthPicker label={t.impFaturaTudoNoMes} id={`${id}-mes`} value={faturaMonth} onChange={escolherMesFatura} />}
          </div>
        )}
      </div>
    );
  }

  // O começo entrega o arquivo por fora (handleFileRef): fica apontando para a função de agora.
  useEffect(() => {
    handleFileRef.current = handleFile;
  });

  // --- UPLOAD ---
  if (phase === "upload") {
    return (
      <div className="flex flex-col gap-4">
        {/* Erro de leitura: antes esta tela era um beco sem saída. O botão abre a conversa com a
            mensagem já escrita, incluindo o nome do arquivo e o que o app disse — a pessoa não
            precisa explicar nada, e o ManyChat reconhece o assunto e responde na hora. */}
        {error && (
          <div className="flex flex-col gap-2 rounded-lg bg-danger-soft px-3 py-3">
            <p className="text-sm text-danger">{error}</p>
            <FalarComSuporte arquivo={fileName} problema={error} />
          </div>
        )}

        {/* Perfil Casal: uma pergunta por arquivo, e cada linha já entra com "quem pagou". */}
        {nomesDoCasal && (
          <div className="flex flex-col gap-1.5">
            <span className="text-caption text-ink-muted">{docType === "fatura" ? "De quem é essa fatura?" : "De quem é esse extrato?"}</span>
            <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
              {(["A", "B"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPessoaDoExtrato(p)}
                  aria-pressed={pessoaDoExtrato === p}
                  className={`min-h-11 flex-1 truncate rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    pessoaDoExtrato === p ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {nomesDoCasal[p]}
                </button>
              ))}
            </div>
            <span className="text-caption text-ink-faint">Todos os lançamentos entram como pagos (ou recebidos) por {nomesDoCasal[pessoaDoExtrato]}.</span>
          </div>
        )}

        {/* C: os meses que já estão no app, para quem já importou alguma vez. */}
        {mesesNoApp.length > 0 && <FaixaDosMeses noApp={mesesNoApp} lidos={[]} />}

        {/* Uma porta só (proposta da entrada, 12/10/2026): "Extrato ou fatura", os formatos que o app
            lê, e um botão. O app descobre o tipo sozinho e segue; o "Mudar" aparece depois da leitura. */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          data-guia="escolher-arquivo"
          data-porta-unica
          className="flex flex-col items-center gap-2 rounded-3xl bg-surface px-4 pb-6 pt-7 text-center shadow-premium-sm transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="relative mb-3 h-[84px] w-[120px]" aria-hidden>
            <span className="absolute left-0 top-2 flex h-[76px] w-[62px] -rotate-6 flex-col gap-1.5 rounded-lg bg-surface p-2 shadow-[0_6px_16px_rgba(0,0,0,0.08),inset_0_0_0_1px_var(--color-border)]">
              <span className="h-1.5 w-7 rounded-full bg-accent" />
              {["w-11", "w-9", "w-10"].map((w, i) => <span key={i} className={`h-1.5 ${w} rounded-full bg-surface-2`} />)}
            </span>
            <span className="absolute right-0 top-0 flex h-[80px] w-[66px] rotate-3 flex-col gap-1.5 rounded-lg bg-surface p-2 shadow-[0_6px_16px_rgba(0,0,0,0.1),inset_0_0_0_1px_var(--color-border)]">
              <span className="h-5 w-full rounded bg-accent-gradient" />
              {["w-12", "w-8", "w-11"].map((w, i) => <span key={i} className={`h-1.5 ${w} rounded-full bg-surface-2`} />)}
            </span>
          </span>
          <b className="titulo-tema text-[1.75rem] font-normal leading-tight text-ink">{isPending ? t.impLendoArquivo : "Extrato ou fatura"}</b>
          <span className="text-[15px] text-ink-muted">Pode ser qualquer um dos dois. Eu descubro qual é.</span>
          <span className="mt-1 flex flex-wrap justify-center gap-1.5">
            {["PDF", "Excel", "CSV", "OFX"].map((f) => (
              <span key={f} className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-ink-muted">
                {f}
              </span>
            ))}
          </span>
        </button>
        <Link href="/comecar?passo=banco" className="mx-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-strong hover:underline" data-como-tiro>
          <CircleHelp size={16} aria-hidden />
          Como tiro o extrato do meu banco?
        </Link>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={isPending} className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-full [background:var(--botao-fundo,var(--color-ink))] text-base font-semibold [color:var(--botao-tinta,var(--color-canvas))] disabled:opacity-60">
          {isPending ? t.impLendoArquivo : "Escolher arquivo"}
          {!isPending && <ArrowRight size={18} aria-hidden />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACEITA_ARQUIVO_DE_EXTRATO}
          multiple
          className="hidden"
          onChange={(e) => {
            const arquivos = Array.from(e.target.files ?? []);
            // Zera o campo: depois de um erro, escolher o MESMO arquivo de novo não dispara
            // change (o valor não mudou) e o toque não fazia nada, justo quando o aviso mandou tentar de novo.
            e.target.value = "";
            // Vários de uma vez (caminho B): um por vez no servidor, cada um numa linha.
            if (arquivos.length > 1) void lerFila(arquivos);
            else if (arquivos[0]) handleFile(arquivos[0]);
          }}
        />

      </div>
    );
  }

  // --- VÁRIOS ARQUIVOS (caminho B; com mais de dois, a faixa dos meses do C) ---
  if (phase === "arquivos" && fila) {
    const prontos = fila.filter((a) => a.status === "ok");
    const comSenha = fila.filter((a) => a.status === "senha");
    const lidosAgora = fila.flatMap((a) => (a.status === "ok" || a.status === "anotado" ? (a.items ?? []).map((l) => l.date.slice(0, 7)) : []));
    return (
      <div className="flex flex-col gap-3" data-varios-arquivos>
        <p className="titulo-tema px-1 text-[1.6rem] font-normal leading-tight text-ink">{fila.length} arquivos</p>
        {fila.length > 2 && <FaixaDosMeses noApp={mesesNoApp} lidos={lidosAgora} />}
        {comSenha.length > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (password && !lendoFila) void abrirComSenha(password);
            }}
            className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-premium-sm"
            data-senha-em-lote
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <Lock size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <b className="titulo-tema text-[1.3rem] font-normal leading-tight text-ink">
                {comSenha.length === 1 ? "1 arquivo tem senha" : `${comSenha.length} arquivos têm senha`}
              </b>
            </span>
            <span className="text-sm text-ink-muted">
              {comSenha.some((a) => a.senhaErrada)
                ? comSenha.length === 1
                  ? "Essa senha não abriu este. Tenta outra?"
                  : `Essa senha não abriu estes ${comSenha.length}. Tenta outra?`
                : comSenha.length === 1
                  ? t.impSenhaDicaBanco
                  : "Digita uma vez e eu abro todos."}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.impSenhaPlaceholder}
              autoComplete="off"
              className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <Button type="submit" disabled={lendoFila || !password}>
              {lendoFila ? t.impAbrindo : comSenha.length === 1 ? t.impDesbloquear : `Abrir os ${comSenha.length}`}
            </Button>
            <span className="text-caption text-ink-faint">{t.impSenhaConfianca}</span>
          </form>
        )}
        {fila.map((a) => {
          const resumo = a.status === "ok" && a.stats && a.items ? resumoDoArquivo(a.docType, a.stats, a.items) : null;
          return (
            <div key={a.id} className="flex flex-col gap-2 rounded-3xl bg-surface p-4 shadow-premium-sm" data-arquivo-da-fila={a.status}>
              <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-muted">
                <Paperclip size={15} className="shrink-0" aria-hidden />
                <span className="truncate">{a.file.name}</span>
              </span>
              {resumo ? (
                <>
                  <b className="titulo-tema text-[1.4rem] font-normal leading-tight text-ink">{resumo.titulo}</b>
                  <span className="flex flex-wrap gap-1.5">
                    {resumo.chips.map((c) => (
                      <span key={c} className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium text-ink">
                        {c}
                      </span>
                    ))}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
                      <Check size={15} aria-hidden /> Pronto para revisar
                    </span>
                    <button type="button" disabled={lendoFila} onClick={() => void mudarTipoNaFila(a.id)} className="min-h-11 px-1 text-sm text-ink-muted underline underline-offset-4 disabled:opacity-50">
                      Mudar
                    </button>
                  </span>
                </>
              ) : a.status === "erro" ? (
                <span className="text-sm text-ink-muted">{a.erro}</span>
              ) : a.status === "senha" ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                  <Lock size={15} aria-hidden /> Esperando a senha
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm text-ink-muted">
                  <span className="esqueleto h-3 w-24 rounded-full" aria-hidden />
                  {a.status === "lendo" ? t.impLendoArquivo : "Na fila"}
                </span>
              )}
            </div>
          );
        })}
        <button type="button" disabled={lendoFila} onClick={() => fileRef.current?.click()} className="mx-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent-strong disabled:opacity-50">
          <Plus size={16} aria-hidden /> Mais um arquivo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACEITA_ARQUIVO_DE_EXTRATO}
          multiple
          className="hidden"
          onChange={(e) => {
            const arquivos = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (arquivos.length) void lerFila(arquivos, fila);
          }}
        />
        <button
          type="button"
          disabled={lendoFila || prontos.length === 0}
          onClick={() => abrirDaFila(prontos[0].id)}
          className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-full [background:var(--botao-fundo,var(--color-ink))] text-base font-semibold [color:var(--botao-tinta,var(--color-canvas))] disabled:opacity-50"
        >
          {lendoFila ? t.impLendoArquivo : `Revisar ${prontos.length === 1 ? "o arquivo" : `os ${prontos.length}`}`}
          {!lendoFila && <ArrowRight size={18} aria-hidden />}
        </button>
      </div>
    );
  }

  // --- SENHA (Excel ou PDF protegido pelo banco) ---
  if (phase === "password") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
            <Lock size={22} strokeWidth={1.75} />
          </span>
          <p className="text-sm font-medium text-ink">{t.impProtegido}</p>
          <p className="text-caption text-ink-faint">{t.impSenhaDicaBanco}</p>
          {/* O medo na hora da senha era "estão pedindo a senha do meu banco?". */}
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-caption text-ink">{t.impSenhaConfianca}</p>
        </div>

        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pendingFile && password) runParse(pendingFile, password);
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.impSenhaPlaceholder}
            autoFocus
            autoComplete="off"
            className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <Button type="submit" disabled={isPending || !password}>
            {isPending ? t.impAbrindo : t.impDesbloquear}
          </Button>
          <button
            type="button"
            onClick={() => {
              setPhase("upload");
              setPendingFile(null);
              setPassword("");
              setError(null);
              setKindMismatch(null);
            }}
            className="min-h-11 text-center text-sm font-medium text-ink-faint hover:text-ink"
          >
            {t.impOutroArquivo}
          </button>
        </form>
      </div>
    );
  }

  /**
   * Os botões de categoria: os mesmos na fila de revisão e na conferência (trocar a categoria de
   * uma linha que o app já tinha classificado). `aoEscolher` recebe as linhas resolvidas (a
   * própria e as iguais).
   */
  /** O ícone de cada categoria-mãe, na cor e no emoji do tema (o mesmo do resto do app). */
  function iconeDe(pc: ParentCategory, tamanho: 36 | 40 = 36, cats: CategoriasDoPerfil = categorias) {
    const emoji = emojiEscolhido(cats, pc) ?? emojiDaCategoria(tema, { kind: "parent", value: pc });
    return <CategoryIcon icon={categoryIcon(cats, pc)} color={colorForCategorySlice({ kind: "parent", value: pc }, cats)} size={tamanho} variant="soft" emoji={emoji} />;
  }

  /** As categorias que valem para a linha: as do perfil para onde ela VAI. Na linha mandada para a
   * Empresa, ALIMENTACAO é "Mercadorias e insumos", não "Alimentação". */
  function categoriasDaLinha(it: ReviewItem): CategoriasDoPerfil {
    return (it.profileId && otherProfiles.find((p) => p.id === it.profileId)?.kind) || categorias;
  }

  /**
   * A revisão em quadrados (07/10/2026, "tudo que der para transformar texto em visual"): cada
   * categoria é um quadradinho com o ícone dela, três por linha, como os atalhos do Foco. Antes
   * eram pílulas só com o nome, e no celular a pessoa lia oito palavras para achar a dela.
   */
  function quadradosDeCategoria(it: ReviewItem, aoEscolher: (resolvidas: Set<number>) => void) {
    const quadrado = "flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2 text-center transition-colors";
    const cor = (ativo: boolean) => (ativo ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-hover");
    return (
      <div className="grid grid-cols-3 gap-2">
        {PARENT_CATEGORIES.filter((pc) => !categoriaOculta(categoriasDaLinha(it), pc) || it.parentCategory === pc).map((pc) => (
          <button key={pc} type="button" aria-pressed={it.parentCategory === pc} onClick={() => aoEscolher(assignParent(it.key, pc))} className={`${quadrado} ${cor(it.parentCategory === pc)}`}>
            {iconeDe(pc, 36, categoriasDaLinha(it))}
            <span className="text-xs font-medium leading-tight text-ink">{categoryLabel(categoriasDaLinha(it), pc)}</span>
          </button>
        ))}
        {!it.profileId &&
          customCategories.map((cc) => (
            // A que ela criou: lápis ou toque longo para editar e apagar (12/10/2026).
            <LapisDaCategoria key={cc.id} categoria={{ id: cc.id, name: cc.name, icon: cc.icon ?? "tag" }} outras={customCategories.map((o) => ({ id: o.id, name: o.name, icon: o.icon ?? "tag" }))} className="flex">
              <button type="button" aria-pressed={it.customCategoryId === cc.id} onClick={() => aoEscolher(assignCustom(it.key, cc.id))} className={`${quadrado} w-full ${cor(it.customCategoryId === cc.id)}`}>
                <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted" aria-hidden>
                  <Tag size={16} />
                </span>
                <span className="line-clamp-2 text-xs font-medium leading-tight text-ink">{cc.name}</span>
              </button>
            </LapisDaCategoria>
          ))}
        {!it.profileId && (
          <button
            type="button"
            onClick={() => {
              setCreatingCat((v) => !v);
              setNewCatName("");
              setError(null);
            }}
            className={`${quadrado} border-dashed border-border-strong bg-transparent text-ink-muted hover:text-ink`}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-2" aria-hidden>
              <Plus size={16} strokeWidth={2.2} />
            </span>
            <span className="text-xs font-medium leading-tight">{t.impOutra}</span>
          </button>
        )}
      </div>
    );
  }

  function chipsDeCategoria(it: ReviewItem, aoEscolher: (resolvidas: Set<number>) => void, comCriar: boolean) {
    const classe = (ativo: boolean) =>
      `inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium transition-colors active:scale-95 ${
        ativo ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft"
      }`;
    return (
      <div className="flex flex-wrap gap-2">
        {PARENT_CATEGORIES.filter((pc) => !categoriaOculta(categoriasDaLinha(it), pc) || it.parentCategory === pc).map((pc) => (
          <button key={pc} type="button" aria-pressed={it.parentCategory === pc} onClick={() => aoEscolher(assignParent(it.key, pc))} className={classe(it.parentCategory === pc)}>
            {categoryLabel(categoriasDaLinha(it), pc)}
          </button>
        ))}
        {/* Categorias que a própria pessoa criou (aqui ou no Orçamento). Só fica "dourada"
            quando de fato selecionada (it.customCategoryId === cc.id) — antes vinha sempre
            dourada de cara, dava a entender que já estava escolhida sem ter clicado em nada. */}
        {/* Linha mandada pra outro perfil: as personalizadas (e a criada aqui) são do perfil
            ativo e não valem lá, então só as fixas aparecem. */}
        {!it.profileId &&
          customCategories.map((cc) => (
            <button key={cc.id} type="button" aria-pressed={it.customCategoryId === cc.id} onClick={() => aoEscolher(assignCustom(it.key, cc.id))} className={classe(it.customCategoryId === cc.id)}>
              {cc.name}
            </button>
          ))}
        {comCriar && !it.profileId && (
          <button
            type="button"
            onClick={() => {
              setCreatingCat((v) => !v);
              setNewCatName("");
              setError(null);
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border-strong bg-transparent px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <Plus size={14} strokeWidth={2.2} />
            {t.impOutra}
          </button>
        )}
      </div>
    );
  }

  // --- REVIEW (uma por vez, chips) ---
  if (phase === "review") {
    const entry = reviewQueue[reviewIdx];
    if (!entry) {
      // Fila esvaziou (todas classificadas), segue pra confirmação.
      setPhase("confirm");
      return null;
    }
    const it = entry.it;
    return (
      <div ref={areaRef} className="flex flex-col gap-4">
        <ProtegerSaida
          ativo={protegerSaida}
          areaRef={areaRef}
          textos={{ titulo: t.impSairTitulo, dica: t.impSairDica, ficar: t.impSairFicar, sair: t.impSairSim }}
        />
        {/* Onde ela está na fila: uma barra que enche, e "1 de 5" pequeno (07/10/2026). */}
        <div className="flex items-center gap-3">
          {reviewIdx > 0 ? (
            <button type="button" onClick={retreatReview} aria-label={t.impVoltarAnterior} className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink">
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={reviewIdx + 1} aria-valuemin={1} aria-valuemax={reviewQueue.length}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${((reviewIdx + 1) / reviewQueue.length) * 100}%` }} />
          </div>
          <span className="shrink-0 text-caption tabular-nums text-ink-muted">
            {reviewIdx + 1} de {reviewQueue.length}
          </span>
        </div>

        {/* Falha ao criar categoria ("+ Outra") aparece aqui mesmo, e não só na confirmação. */}
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="rounded-2xl border border-border bg-surface-2 p-4">
          {/* O NOME do lugar em destaque (regra da dona, 12/10/2026): "ESPACOBELLA · 3 compras ·
              total. O que é?", nunca algo genérico. Embaixo, as datas e os valores. */}
          {(() => {
            const grupo = [it, ...iguaisPraAplicar(items, it.key).map((k) => items.find((x) => x.key === k)).filter((x): x is ReviewItem => !!x && x.key !== it.key)];
            const total = grupo.reduce((s2, x) => s2 + x.amount, 0);
            const nm = nomeNaTela(it.description);
            return (
              <>
                <p className="break-words text-[1.5rem] font-semibold leading-tight tracking-tight text-ink" data-nome-do-lugar>{nm.nome}</p>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  {grupo.length > 1 ? `${grupo.length} ${it.category === "INCOME" ? "entradas" : "compras"} · ` : ""}
                  <span className="tabular-nums">{money(grupo.length > 1 ? total : it.amount)}</span>. O que é?
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
                  {nm.meio && <span className="rounded-full bg-surface px-2 py-0.5 font-medium">{nm.meio}</span>}
                  {grupo.length > 1
                    ? grupo.slice(0, 6).map((x) => (
                        <span key={x.key} className="whitespace-nowrap tabular-nums">
                          {formatDate(x.date)}, {money(x.amount)}
                        </span>
                      ))
                    : formatDate(it.date)}
                  {grupo.length > 6 && <span>e mais {grupo.length - 6}</span>}
                </p>
                {/* Linha que vai para outro perfil ("sempre mandar" ou o toque na revisão): à vista. */}
                {it.profileId && (
                  <p className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[13px] font-medium text-canvas" data-vai-para>
                    <Send size={13} aria-hidden className="shrink-0" />
                    <span className="break-words">Vai para {otherProfiles.find((p) => p.id === it.profileId)?.name ?? "outro perfil"}</span>
                  </p>
                )}
              </>
            );
          })()}
          {/* Só a parcela com certeza: é a única que o servidor lança nos meses seguintes. "03/10"
              sem "parc" pode ser data ("POSTO SHELL 03/09"), e prometer que "as 7 seguintes
              entram sozinhas" fazia ela planejar os próximos meses com gasto que não existe. */}
          {it.installment?.confident && it.installment.current < it.installment.total && (
            <p className="mt-1.5 text-caption text-accent-strong">
              {t.impParcela(it.installment.current, it.installment.total, it.installment.total - it.installment.current)}
            </p>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-base font-semibold text-ink">
          {t.impQualCategoria}
          <Explica>{t.impNaoSeiAgoraDica}</Explica>
        </p>
        {quadradosDeCategoria(it, (resolvidas) => advanceReview(resolvidas))}
        {/* Criar categoria na hora: fica disponível pra planejar depois no Orçamento. */}
        {creatingCat && !it.profileId && (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createAndAssign(it.key);
                  }
                }}
                placeholder={t.impNovaCategoriaPlaceholder}
                autoFocus
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <Button type="button" className="min-h-11" onClick={() => createAndAssign(it.key)} disabled={isPending || !newCatName.trim()}>
                {isPending ? t.impCriando : t.impCriarEUsar}
              </Button>
            </div>
            <span className="text-caption text-ink-faint">{t.impNovaCategoriaDica}</span>
          </div>
        )}

        {/* "Pular" tirava o gasto da importação sem ela saber. "Não sei agora" deixa o gasto
            entrar sem categoria: ele aparece no mês e dá para classificar depois. */}
        {/* "Responder igual nas parecidas" (caminho B): ligado, a resposta vale para a loja inteira. */}
        {iguaisPraAplicar(items, it.key).length > 0 && (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-2 text-[15px] text-ink">
            <span>Responder igual nas {iguaisPraAplicar(items, it.key).length + 1} parecidas</span>
            <input type="checkbox" checked={igualNasParecidas} onChange={(e) => setIgualNasParecidas(e.target.checked)} className="size-5 shrink-0 accent-[var(--color-ink)]" />
          </label>
        )}
        <Button type="button" variant="secondary" className="min-h-12" onClick={() => {
            const estas = new Set([it.key, ...(igualNasParecidas ? iguaisPraAplicar(items, it.key) : [])]);
            setNaoSei((prev) => new Set([...prev, ...estas]));
            advanceReview(estas);
          }}>
          Não sei · fica “A conferir”
        </Button>
        {/* Sair da fila a qualquer momento: com 23 cartões pela frente (a mediana do 1º arquivo),
            muita gente fechava a tela antes de ver o botão de importar e ficava sem nada. O que
            falta entra sem categoria, igual a tocar "Não sei agora" em cada um. */}
        {reviewQueue.length - reviewIdx > 3 && (
          <button
            type="button"
            onClick={() => setPhase("confirm")}
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-ink-muted hover:text-ink"
          >
            {t.impImportarJa(reviewQueue.length - reviewIdx)}
          </button>
        )}
      </div>
    );
  }

  // --- CONFIRM ---
  if (phase === "confirm") {
    // Tudo que não ficou de fora entra, inclusive o gasto sem categoria ("Não sei agora").
    const importable = items.filter(entraNaImportacao);
    // Gasto sem categoria ENTRA (sem categoria). Antes ficava de fora calado: o botão dizia
    // "Importar 12" e 3 gastos simplesmente não existiam depois. O aviso agora diz que ele entra
    // e oferece escolher a categoria já.
    // O que ainda é dúvida (dinheiro dela mesma) ou fica de fora não é "gasto sem categoria".
    const semCategoria = items.filter((it) => gastoSemCategoria(it) && !it.ignorar && !it.duvida);
    const customName = (id: string) => customCategories.find((c) => c.id === id)?.name ?? "Personalizada";
    // Repetidos dentro do arquivo: mesma data, valor e descrição mais de uma vez. Pode ser real
    // (dois Uber no mesmo dia) ou não; a pessoa decide com um toque, em vez de descobrir depois.
    const repeatGroups = new Map<string, ReviewItem[]>();
    for (const it of items) if (it.fileRepeat) repeatGroups.set(it.fileRepeat.key, [...(repeatGroups.get(it.fileRepeat.key) ?? []), it]);
    const expenseSum = importable.filter((it) => it.category === "EXPENSE").reduce((s, it) => s + (it.estorno ? -it.amount : it.amount), 0);
    // Parece com algo que a pessoa já lançou à mão: precisa de resposta antes de importar.
    const duvidas = items.filter((it) => it.possivelDuplicata && !it.ignorar);
    // Dinheiro que pode ser dela mesma (conta própria, resgate): também precisa de resposta.
    const duvidasDinheiro = items.filter((it) => it.duvida && !it.ignorar);
    const deFora = items.filter((it) => it.ignorar);
    // "Faltou coisa": a mesma régua do relatório diário (conferencia.ts). Contar linhas sozinho
    // acusava fatura lida perfeita — simulação de parcela e tabela de juros também têm número.
    const lowCoverage = stats?.leituraIncompleta ?? false;
    const totalGap = stats?.invoiceTotal ? Math.round((stats.invoiceTotal - expenseSum) * 100) / 100 : 0;
    // O que o app separou sozinho (regra dela, comunidade, banco ou dicionário): entra classificado,
    // e o "Revisar" mostra só essas linhas, todas, pra ela conferir e trocar o que quiser.
    const listaBase = separadosEmRevisao ? importable.filter((it) => separadosEmRevisao.has(it.key)) : importable;
    const visiveis = mostrarTodos || separadosEmRevisao ? listaBase : listaBase.slice(0, LINHAS_VISIVEIS);
    const rotuloDaLinha = (it: ReviewItem) =>
      it.category === "INCOME"
        ? t.impRotuloRenda
        : it.category === "INVESTMENT_CONTRIBUTION"
          ? it.resgate
            ? t.uiTipoResgate
            : t.uiTipoAporte
          : it.parentCategory
            ? categoryLabel(categoriasDaLinha(it), it.parentCategory)
            : it.customCategoryId
              ? customName(it.customCategoryId)
              : t.impRotuloSemCategoria;
    // Botões de resposta das caixas de pergunta: 44px de altura, letra de 14px.
    const respostaForte = "inline-flex min-h-11 items-center rounded-full bg-pill px-4 text-sm font-semibold text-on-pill";
    const respostaFraca = "inline-flex min-h-11 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-ink-muted hover:text-ink";
    const chipPequeno = (ativo: boolean) =>
      `inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium transition-colors ${
        ativo ? "border-accent bg-accent-soft text-accent-strong" : "border-border-strong bg-surface text-ink-muted hover:text-ink"
      }`;
    return (
      <div ref={areaRef} className="flex flex-col gap-4">
        <ProtegerSaida
          ativo={protegerSaida && importable.length > 0}
          areaRef={areaRef}
          textos={{ titulo: t.impSairTitulo, dica: t.impSairDica, ficar: t.impSairFicar, sair: t.impSairSim }}
        />
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        {/* Leitura que não parece dinheiro de gente. Fica ACIMA da conferência e em tom de alerta
            porque é o único aviso que diz "não confirme ainda": quando isso aparece, o mês inteiro
            da pessoa vai entrar errado — orçamento, saúde financeira e gráfico junto. */}
        {stats && stats.suspeitas.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
            <p className="text-sm font-semibold text-ink">{t.impNumerosErrados}</p>
            {stats.suspeitas.map((s) => (
              <div key={s.texto} className="flex flex-col gap-1">
                <p className="text-caption text-ink">{s.texto}</p>
                {s.exemplos.length > 0 && (
                  <ul className="flex flex-col gap-0.5 pl-3 text-caption text-ink-muted">
                    {s.exemplos.map((e) => (
                      <li key={e} className="truncate">• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <p className="text-caption text-ink-muted">{t.impNumerosErradosDica}</p>
            <FalarComSuporte arquivo={fileName} problema={stats.suspeitas[0]?.texto} rotulo={t.impFalarComAGente} />
          </div>
        )}

        {/* Vários arquivos: uma aba por arquivo. O anotado fica marcado; os outros guardam o que ela já respondeu. */}
        {fila && filaAtual !== null && fila.filter((a) => a.status === "ok" || a.status === "anotado").length > 1 && (
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Arquivos" data-abas-dos-arquivos>
            {fila
              .filter((a) => a.status === "ok" || a.status === "anotado")
              .map((a) => {
                const on = a.id === filaAtual;
                const titulo = a.rotulo ?? a.file.name;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    disabled={a.status === "anotado" || isPending}
                    onClick={() => abrirDaFila(a.id)}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-3.5 text-sm text-ink-muted aria-selected:bg-ink aria-selected:font-medium aria-selected:text-canvas disabled:opacity-60"
                  >
                    {a.status === "anotado" && <Check size={14} aria-hidden />}
                    {titulo}
                  </button>
                );
              })}
          </div>
        )}

        {/* Caminho B (12/10/2026): no topo, uma confirmação grande e calma (o arquivo, quantas
            compras, os meses e o total); embaixo, o que o app já separou sozinho, com o porquê
            em "Revisar"; e as perguntas que sobraram, em cartões grandes, uma por vez. */}
        {(() => {
          const entrou = importable.filter((it) => it.category === "INCOME").reduce((s2, it) => s2 + it.amount, 0);
          const meses = [...new Set(importable.map((it) => it.date.slice(0, 7)))].sort();
          const nomeMes = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
          const textoMeses = meses.length === 0 ? "" : meses.length === 1 ? `${nomeMes(meses[0])} de ${meses[0].slice(0, 4)}` : meses.length <= 3 ? `${meses.slice(0, -1).map(nomeMes).join(", ")} e ${nomeMes(meses[meses.length - 1])}` : `${nomeMes(meses[0])} a ${nomeMes(meses[meses.length - 1])}`;
          const deOnde = stats?.summary ?? (docType === "fatura" ? "Fatura" : "Extrato");
          const compras = docType === "fatura" ? importable.filter((it) => it.category === "EXPENSE").length : importable.length;
          return (
            <section className="flex flex-col items-center gap-1 rounded-3xl bg-surface-2 px-4 py-6 text-center" data-confirmacao-do-arquivo>
              <span className="text-sm text-ink-muted">{deOnde}</span>
              <b className="mt-1 text-[2.75rem] font-light leading-none tracking-tight tabular-nums text-ink">{compras}</b>
              <span className="text-[15px] text-ink">{docType === "fatura" ? (compras === 1 ? "compra" : "compras") : compras === 1 ? "lançamento" : "lançamentos"}{textoMeses ? ` em ${textoMeses}` : ""}</span>
              <span className="mt-1 text-[15px] tabular-nums text-ink-muted">
                {docType === "fatura" ? `Total ${money(expenseSum)}` : `Entrou ${money(entrou, { round: true })} · Saiu ${money(expenseSum, { round: true })}`}
              </span>
              {/* O tipo que o app detectou, com o "Mudar" discreto (uma porta só, 12/10/2026). */}
              {ultimoArquivo && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const outro = docType === "fatura" ? "extrato" : "fatura";
                    setDocType(outro);
                    runParse(ultimoArquivo.file, ultimoArquivo.pwd, outro, true);
                  }}
                  className="inline-flex min-h-11 items-center text-caption text-ink-muted underline underline-offset-4"
                  data-mudar-tipo
                >
                  {docType === "fatura" ? "Não é fatura? Ler como extrato" : "É fatura do cartão? Ler como fatura"}
                </button>
              )}
              {/* Fatura: a frase do motor (banco, fechamento, vencimento, meses das compras) e o "Mudar". */}
              {docType === "fatura" && <div className="mt-2 w-full text-left">{mesDaFatura("fatura-month-confirmar")}</div>}
              {stats?.conferencia.status === "fechou" && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success" title={t.impBateuComTotal(money(stats.conferencia.esperado))}>
                  <Check size={13} strokeWidth={2.5} aria-hidden /> Conferido
                </span>
              )}
            </section>
          );
        })()}

        {/* "Separei N de M": o que o app resolveu sozinho, com o porquê de cada um em "Revisar". */}
        {(() => {
          const separadasLinhas = importable.filter((it) => foiSeparada(it));
          const separadas = separadosEmRevisao ? separadosEmRevisao.size : separadasLinhas.length;
          return (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3" data-separei>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
                <Check size={18} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block whitespace-nowrap text-[16px] font-semibold tabular-nums text-ink">
                  Separei {separadas} de {importable.length}
                </b>
                <span className="block text-caption text-ink-muted">O porquê de cada um está em Revisar</span>
              </span>
              {/* A lista congela no toque: trocar a categoria de uma não a tira da revisão no meio. */}
              <button type="button" onClick={() => setSeparadosEmRevisao((atual) => (atual ? null : new Set(separadasLinhas.map((it) => it.key))))} aria-expanded={!!separadosEmRevisao} className="min-h-10 shrink-0 rounded-full bg-surface-2 px-4 text-sm font-medium text-ink">
                {separadosEmRevisao ? "Fechar" : "Revisar"}
              </button>
            </div>
          );
        })()}

        {/* As perguntas que sobraram (cartões grandes, uma por vez). "Não sei" manda para "A conferir". */}
        {semCategoria.some((x) => !naoSei.has(x.key)) && (
          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4" data-perguntas>
            <p className="text-[17px] font-semibold text-ink">
              {(() => {
                const grupos = new Set(semCategoria.filter((x) => !naoSei.has(x.key)).map((it) => chaveDeIguais(it.description) ?? `k${it.key}`)).size;
                return grupos === 1 ? "Falta 1 pergunta" : `Faltam ${grupos} perguntas`;
              })()}
            </p>
            <p className="-mt-2 text-caption tabular-nums text-ink-muted">
              {(() => {
                const faltam = semCategoria.filter((x) => !naoSei.has(x.key));
                return `${faltam.length === 1 ? "1 lançamento" : `${faltam.length} lançamentos`} · ${money(faltam.reduce((sum, it) => sum + it.amount, 0))}. O que ficar sem resposta entra como “A conferir”.`;
              })()}
            </p>
            <button
              type="button"
              onClick={() => {
                setReviewKeys(semCategoria.filter((x) => !naoSei.has(x.key)).map((it) => it.key));
                setReviewIdx(0);
                setPhase("review");
              }}
              className="flex min-h-[52px] w-full items-center justify-center rounded-full [background:var(--botao-fundo,var(--color-ink))] text-[16px] font-semibold [color:var(--botao-tinta,var(--color-canvas))]"
            >
              Responder
            </button>
          </div>
        )}

        {duvidasDinheiro.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent-soft/40 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {t.impProprioTitulo}
              <Explica>{t.impProprioDica}</Explica>
            </p>
            {duvidasDinheiro.length > 1 && (
              <button
                type="button"
                onClick={() => duvidasDinheiro.forEach((it) => responderDinheiroProprio(it.key, "mudei"))}
                className="inline-flex min-h-11 w-fit items-center text-sm font-semibold text-accent-strong hover:underline"
              >
                {t.impProprioTodasMudei(duvidasDinheiro.length)}
              </button>
            )}
            <ul className="flex flex-col gap-2">
              {duvidasDinheiro.map((it) => (
                <li key={it.key} className="flex flex-col gap-1.5 border-t border-border/60 pt-2 first:border-t-0 first:pt-0">
                  {/* O nome em destaque (12/10/2026): "Pix para Daniela Colombo (você mesma)", "Pix de Marina Souza". */}
                  <span className="break-words text-[17px] font-semibold leading-snug text-ink" data-nome-do-lugar>{tituloDaTransferencia(it)}</span>
                  <span className="-mt-1 text-caption tabular-nums text-ink-muted">
                    {formatDate(it.date)} · {it.category === "INCOME" ? "+" : "−"} {money(it.amount)}
                  </span>
                  {/* O destaque vai pra resposta certa quase sempre: dinheiro indo pra outra conta
                      dela é "só mudei de conta". Antes o botão forte era "Guardei (aplicação)", e
                      quem só passou o dinheiro do Nubank para o Itaú marcava investimento que não fez. */}
                  <div className="flex flex-wrap gap-2">
                    {it.category === "EXPENSE" ? (
                      <>
                        <button type="button" onClick={() => responderDinheiroProprio(it.key, "mudei")} className={respostaForte}>
                          {t.impProprioMudei}
                        </button>
                        <button type="button" onClick={() => responderDinheiroProprio(it.key, "guardei")} className={respostaFraca}>
                          {t.impProprioGuardei}
                        </button>
                        <button type="button" onClick={() => responderDinheiroProprio(it.key, "gasto")} className={respostaFraca}>
                          {t.impProprioGasto}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => responderDinheiroProprio(it.key, "mudei")} className={respostaForte}>
                          {it.duvida === "resgate" ? t.impProprioVoltou : t.impProprioMudei}
                        </button>
                        <button type="button" onClick={() => responderDinheiroProprio(it.key, "renda")} className={respostaFraca}>
                          {t.impProprioRenda}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {deFora.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3">
            <p className="text-sm font-semibold text-ink">{deFora.length === 1 ? "1 lançamento fica de fora" : `${deFora.length} lançamentos ficam de fora`}</p>
            <ul className="flex flex-col gap-2">
              {deFora.map((it) => (
                <li key={it.key} className="flex flex-col gap-1">
                  <span className="break-words text-sm text-ink">
                    {nomeNaTela(it.description).nome}, {money(it.amount)}, {formatDate(it.date)}
                  </span>
                  {it.nota && <span className="text-caption text-ink-muted">{it.nota}</span>}
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, ignorar: false, nota: null } : x)))}
                    className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-accent-strong hover:underline"
                  >
                    Contar mesmo assim
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {duvidas.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent-soft/40 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {t.impDuplicataTitulo(duvidas.length, duvidas.every((it) => !it.possivelDuplicata!.importado))}
              <Explica>{t.impDuplicataDica}</Explica>
            </p>
            <ul className="flex flex-col gap-3">
              {duvidas.map((it) => {
                const dup = it.possivelDuplicata!;
                // Os dois lado a lado (07/10/2026): o que veio no arquivo e o que já está no app. Antes
                // eram três frases ("Você lançou: … em …", "Você lançou R$ X. Se for o mesmo…").
                return (
                  <li key={it.key} className="flex flex-col gap-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="min-w-0 rounded-xl bg-surface px-3 py-2">
                        <p className="text-caption text-ink-muted">No arquivo</p>
                        <p className="truncate text-[15px] font-bold tabular-nums text-ink">{money(it.amount)}</p>
                        <p className="break-words text-caption text-ink-muted">{formatDate(it.date)}, {nomeNaTela(it.description).nome}</p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-surface px-3 py-2">
                        <p className="text-caption text-ink-muted">{dup.importado ? "Já importado" : "Você lançou"}</p>
                        <p className="truncate text-[15px] font-bold tabular-nums text-ink">{money(dup.valor ?? it.amount)}</p>
                        <p className="break-words text-caption text-ink-muted">
                          {dup.data ? `${formatDate(dup.data)}, ` : ""}
                          {dup.descricao ? nomeNaTela(dup.descricao).nome : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => responderDuplicata(it.key, true)} className={respostaForte}>
                        {t.impDuplicataEOMesmo}
                      </button>
                      <button type="button" onClick={() => responderDuplicata(it.key, false)} className={respostaFraca}>
                        {t.impDuplicataSaoDiferentes}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {repeatGroups.size > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent-soft/40 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {t.impRepetidos}
              <Explica>{t.impRepetidosDica}</Explica>
            </p>
            <ul className="flex flex-col gap-1.5">
              {[...repeatGroups.entries()].map(([key, group]) => (
                <li key={key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words text-sm text-ink">
                    {nomeNaTela(group[0].description).nome}, {money(group[0].amount)}, {group.length}× em {formatDate(group[0].date)}
                  </span>
                  {group.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((it) => it.fileRepeat?.key !== key || it.key === group[0].key))}
                      className={`w-fit ${respostaFraca}`}
                    >
                      {t.impDeixarSo1}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* A lista do que vai entrar. Cada linha mostra o que o app entendeu e um "Mudar" que abre
            ali mesmo a categoria, o tipo, "não importar" e o outro perfil: antes só dava para
            trocar o TIPO, e o palpite errado do app (iFood em Mercado) só se corrigia depois de
            importar, um por um. Fechada, a linha é curta; os botões de 44px só aparecem na aberta.
            No celular a lista NÃO tem rolagem própria (brigava com a da janela); do sm para cima,
            caixa com altura fixa. */}
        {separadosEmRevisao && (
        <>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border sm:max-h-96 sm:overflow-y-auto">
          {visiveis.map((it) => {
            const aberta = editandoKey === it.key;
            return (
              <li key={it.key} className="flex flex-col gap-2 px-3 py-2">
                {/* A linha inteira abre a edição (07/10/2026): o ícone da categoria no lugar do nome
                    dela escrito, e uma setinha no lugar dos vinte "Mudar" dourados. */}
                <button type="button" onClick={() => setEditandoKey(aberta ? null : it.key)} aria-expanded={aberta} className="flex w-full items-center gap-3 text-left">
                  {it.category === "EXPENSE" && it.parentCategory ? (
                    iconeDe(it.parentCategory)
                  ) : (
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                        it.category === "INCOME" || it.estorno
                          ? "bg-success-soft text-success"
                          : it.category === "INVESTMENT_CONTRIBUTION"
                            ? "bg-accent-soft text-accent-strong"
                            : gastoSemCategoria(it) && !it.duvida
                              ? "bg-accent-soft text-accent-strong"
                              : "bg-surface-2 text-ink-muted"
                      }`}
                      aria-hidden
                    >
                      {it.category === "INCOME" ? <ArrowRight size={16} className="rotate-[135deg]" /> : it.category === "INVESTMENT_CONTRIBUTION" ? <Check size={16} /> : gastoSemCategoria(it) ? <CircleHelp size={16} /> : <Tag size={16} />}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-ink">{nomeNaTela(it.description).nome}</span>
                    <span className="block truncate text-caption text-ink-muted">
                      {formatDate(it.date)}, {it.estorno && `${t.impTipoDevolucao}, `}
                      <span className={gastoSemCategoria(it) && !it.duvida ? "font-medium text-accent-strong" : undefined}>{rotuloDaLinha(it)}</span>
                      {/* O porquê (Revisar, caminho B): "investimento", "devolução", "você já disse antes". */}
                      {porqueDaLinha(it) && <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-px">{porqueDaLinha(it)!.motivo}</span>}
                      {it.profileId && `, ${t.impMoverPra(otherProfiles.find((p) => p.id === it.profileId)?.name ?? "")}`}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      it.category === "INCOME" || it.estorno ? "text-success" : it.category === "INVESTMENT_CONTRIBUTION" ? "text-accent-strong" : "text-ink"
                    }`}
                  >
                    {it.category === "INCOME" || it.estorno || it.resgate ? "+" : "−"} {money(it.amount)}
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-ink-faint transition-transform ${aberta ? "rotate-180" : ""}`} aria-hidden />
                </button>

                {aberta && (
                  <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
                    {/* A descrição inteira, como veio do banco, e a nota do app ficam na linha aberta. */}
                    <p className="break-words text-caption text-ink-muted">{it.description}</p>
                    {it.nota && <p className="text-caption text-accent-strong">{it.nota}</p>}
                    {/* Categoria só existe em gasto. Trocar aqui também troca nos iguais que o app
                        tinha classificado sozinho, e vira regra para próxima importação. */}
                    {it.category === "EXPENSE" && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-caption font-medium text-ink-muted">{t.impRotuloCategoria}</span>
                        {chipsDeCategoria(it, () => undefined, false)}
                      </div>
                    )}
                    {/* Troca o TIPO do lançamento — o Pix pra você mesma guardar cai como gasto
                        pelo sinal, e só a pessoa sabe que era dinheiro guardado. */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-caption font-medium text-ink-muted">{t.impRotuloTipo}</span>
                      <div className="flex flex-wrap gap-2">
                        {(["EXPENSE", "INCOME", "INVESTMENT_CONTRIBUTION", "RESGATE", "ESTORNO"] as const).map((tipo) => {
                          const ativo = tipo === "ESTORNO" ? Boolean(it.estorno) : tipo === "RESGATE" ? Boolean(it.resgate) : it.category === tipo && !it.estorno && !it.resgate;
                          return (
                            <button key={tipo} type="button" onClick={() => toggleType(it.key, tipo)} aria-pressed={ativo} className={chipPequeno(ativo)}>
                              {tipo === "EXPENSE" ? t.uiTipoGasto : tipo === "INCOME" ? t.uiTipoRenda : tipo === "INVESTMENT_CONTRIBUTION" ? t.uiTipoAporte : tipo === "RESGATE" ? t.uiTipoResgate : t.impTipoDevolucao}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Manda essa linha pra OUTRO perfil do usuário — compra da Empresa que caiu no
                        cartão Pessoal, por exemplo. Só aparece para quem tem mais de um perfil. */}
                    {otherProfiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {otherProfiles.map((p) => (
                          <button key={p.id} type="button" onClick={() => toggleProfile(it.key, p.id)} aria-pressed={it.profileId === p.id} className={chipPequeno(it.profileId === p.id)}>
                            {t.impMoverPra(p.name)}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Tira só esta linha da importação (o pagamento da fatura anterior que o app não
                        reconheceu, por exemplo). Vai para o "fica de fora", de onde volta com um toque. */}
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, ignorar: true, nota: "Você tirou da importação." } : x)));
                        setEditandoKey(null);
                      }}
                      className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-ink-muted hover:text-ink hover:underline"
                    >
                      {t.impNaoImportar}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!mostrarTodos && !separadosEmRevisao && importable.length > LINHAS_VISIVEIS && (
          <button type="button" onClick={() => setMostrarTodos(true)} className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-accent-strong hover:underline">
            {t.impMostrarTodos(importable.length)}
          </button>
        )}
        </>
        )}

        {/* A soma lida contra o total da fatura (12/10/2026): sem caixa nem vermelho. Bateu, nada;
            não bateu, um link pequeno no fim que abre os dois totais e as linhas. */}
        {stats?.invoiceTotal && stats.conferencia.status !== "fechou" && Math.abs(totalGap) >= 1 ? (
          <button type="button" onClick={() => setConferirAberto(true)} className="inline-flex min-h-11 items-center justify-center text-sm text-ink-muted underline underline-offset-4 hover:text-ink" data-conferir-total>
            Conferir com o total da fatura
          </button>
        ) : lowCoverage ? (
          <div className="flex justify-center">
            <FalarComSuporte arquivo={fileName} problema="o app leu só parte do arquivo" rotulo="Faltou alguma? Me mande o arquivo" discreto />
          </div>
        ) : null}
        <Modal open={conferirAberto} onClose={() => setConferirAberto(false)} title="Conferir com o total">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-2xl bg-surface-2 px-3 py-3">
                <p className="text-caption text-ink-muted">Total da fatura</p>
                <FitText className="text-[1.25rem] font-semibold tabular-nums text-ink">{money(stats?.invoiceTotal ?? 0)}</FitText>
              </div>
              <div className="min-w-0 rounded-2xl bg-surface-2 px-3 py-3">
                <p className="text-caption text-ink-muted">O que eu li</p>
                <FitText className="text-[1.25rem] font-semibold tabular-nums text-ink">{money(expenseSum)}</FitText>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
              {importable
                .filter((x) => x.category === "EXPENSE")
                .map((x) => (
                  <li key={x.key} className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 break-words text-ink">
                      {nomeNaTela(x.description).nome}
                      <span className="block text-caption text-ink-muted">{formatDate(x.date)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink">{x.estorno ? "+ " : ""}{money(x.amount)}</span>
                  </li>
                ))}
            </ul>
            <div className="flex justify-center">
              <FalarComSuporte arquivo={fileName} problema={`a soma ficou ${money(Math.abs(totalGap))} diferente do total`} rotulo="Faltou alguma? Me mande o arquivo" discreto />
            </div>
          </div>
        </Modal>

        {/* O botão fica grudado no pé da gaveta: com a lista longa, ele sumia lá embaixo. A faixa
            depois dele cobre o respiro da gaveta, para lista não aparecer por baixo. */}
        <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-surface pt-3 after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-surface">
          {/* Nunca desligado (12/10/2026): o que ficar sem resposta entra como "A conferir". */}
          {duvidas.length + duvidasDinheiro.length > 0 && <p className="text-center text-caption text-ink-muted">O que ficar sem resposta entra como “A conferir”.</p>}
          <Button type="button" className="min-h-11" onClick={handleImport} disabled={isPending || importable.length === 0}>
            {isPending ? t.impImportando : `Pronto, anotar ${importable.length}`}
            <ArrowRight size={16} className="ml-1.5" />
          </Button>
        </div>
      </div>
    );
  }

  // --- DONE ---
  const mesDaRevelacaoNome = revelacao.mes
    ? new Date(revelacao.mes.year, revelacao.mes.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : null;
  const dados = revelacao.dados;
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success">
        <Check size={28} strokeWidth={2} />
      </span>
      <p className="text-sm font-medium text-ink">
        {/* Extrato subido de novo: nada entrou porque tudo já estava lá. Dizer "0 importados com
            sucesso" parecia erro. */}
        {createdCount === 0 && skippedCount > 0
          ? `Nada novo: ${skippedCount === 1 ? "esse lançamento já estava" : `os ${skippedCount} lançamentos já estavam`} no app, então não dupliquei.`
          : t.impImportadosSucesso(createdCount)}
      </p>

      {/* O mês montado: a promessa da página de venda ("o mês se monta sozinho") acontecendo na
          frente dela. Os números são do mês INTEIRO, com o que ela já tinha lançado. */}
      {revelacao.mes && mesDaRevelacaoNome && (revelacao.carregando || dados) && (
        <div className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4 text-left">
          <p className="text-sm font-semibold text-ink">{t.impRevelaTitulo(mesDaRevelacaoNome)}</p>
          {revelacao.carregando || !dados ? (
            <p className="text-caption text-ink-muted" aria-live="polite">{t.impRevelaCarregando}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-surface px-3 py-2">
                  <p className="text-caption text-ink-muted">{t.impRevelaEntrou}</p>
                  <p className="text-base font-semibold tabular-nums text-success">{money(dados.entrou)}</p>
                </div>
                <div className="rounded-xl bg-surface px-3 py-2">
                  <p className="text-caption text-ink-muted">{t.impRevelaSaiu}</p>
                  <p className="text-base font-semibold tabular-nums text-ink">{money(dados.saiu)}</p>
                </div>
              </div>
              {dados.maiores.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-caption font-medium text-ink-muted">{t.impRevelaMaiores}</p>
                  <ul className="flex flex-col gap-2">
                    {dados.maiores.map((c) => (
                      <li key={c.rotulo} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate text-ink">{c.rotulo}</span>
                          <span className="shrink-0 tabular-nums text-ink">{money(c.valor)}</span>
                        </div>
                        {/* Trilho com borda: visível até nos temas claros, onde o fundo translúcido sumia. */}
                        <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-surface" aria-hidden>
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(4, Math.round(c.fracao * 100))}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dados.livre !== null && (
                <div className="rounded-xl bg-accent-soft px-3 py-2">
                  <p className="text-caption text-ink-muted">{t.impRevelaLivre}</p>
                  <p className="text-lg font-semibold tabular-nums text-ink">{money(dados.livre)}</p>
                  <p className="text-caption text-ink-muted">{t.impRevelaLivreSub(money(dados.planejado))}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Candidatos a "pagamento desta fatura" já lançados no extrato: a pessoa decide, nunca
          removemos sozinhos (fatura raramente é paga por inteiro, o valor quase nunca bate
          exato — só ela sabe se aquele lançamento é mesmo esta fatura). */}
      {cardPaymentCandidates.length > 0 && (
        <div className="w-full rounded-xl border border-border bg-surface-2 p-3 text-left">
          <p className="text-sm font-medium text-ink">{t.impPagamentoFatura(cardPaymentCandidates.length)}</p>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {cardPaymentCandidates.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{c.description}</p>
                    <p className="text-caption text-ink-faint">{c.date ? formatDate(c.date) : t.impSemData}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-danger">− {money(c.amount)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        // Sem o catch, a falha de rede derrubava a tela no error boundary.
                        try {
                          await removeCardPaymentCandidateAction(c.id);
                        } catch (err) {
                          console.error("removeCardPaymentCandidateAction falhou", err);
                          showToast(t.impErroSalvar);
                          return;
                        }
                        dismissCandidate(c.id);
                        showToast(t.impRemovidoExtrato);
                      });
                    }}
                    className="inline-flex min-h-11 items-center rounded-full border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-40"
                  >
                    {t.impRemover}
                  </button>
                  <button type="button" onClick={() => dismissCandidate(c.id)} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-ink-muted hover:text-ink">
                    {t.impManter}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {revelacao.mes && dados && !dados.temOrcamento ? (
        // Sem orçamento ainda (07/10/2026): metade de quem importava parava aqui e nunca montava o
        // orçamento, que é o que mais separa quem fica de quem some. O assistente já sugere a renda
        // e "o seu padrão" a partir dos meses que ela acabou de importar.
        <>
          <Link
            href={`/orcamento/${revelacao.mes.year}`}
            onClick={onDone}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm hover:opacity-95"
          >
            {t.impMontarOrcamento}
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link
            href={`/mensal/${revelacao.mes.year}/${revelacao.mes.month}`}
            onClick={onDone}
            className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-medium text-ink-muted hover:text-ink"
          >
            {t.impVerMeuMes}
          </Link>
        </>
      ) : revelacao.mes ? (
        <>
          <Link
            href={`/mensal/${revelacao.mes.year}/${revelacao.mes.month}`}
            onClick={onDone}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm hover:opacity-95"
          >
            {t.impVerMeuMes}
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Button type="button" variant="ghost" className="min-h-11" onClick={onDone}>
            {t.impConcluir}
          </Button>
        </>
      ) : (
        <Button type="button" className="min-h-11" onClick={onDone}>
          {t.impConcluir}
        </Button>
      )}
      {createdCount > 0 && <OfertaDeAvisos />}
      {createdCount > 0 && <p className="text-caption text-ink-muted">{t.impRevelaDesfazer(t.impHistoricoTitulo)}</p>}
    </div>
  );
}

/**
 * A faixa dos últimos 12 meses (C, 12/10/2026): os que já estão no app, os que os arquivos acabaram
 * de trazer (preenchem enquanto cada um é lido) e, embaixo, "Faltam: março e abril".
 */
function FaixaDosMeses({ noApp, lidos }: { noApp: string[]; lidos: string[] }) {
  const { meses, faltam } = faixaDosMeses(noApp, lidos, new Date());
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-surface-2 px-3 py-3" data-faixa-dos-meses>
      <span className="text-caption text-ink-muted">Seus meses no app</span>
      <div className="grid grid-cols-12 gap-1" aria-label="Meses no app">
        {meses.map((m) => (
          <span key={m.ym} className="flex flex-col items-center gap-1" title={m.ym}>
            <span
              className={`h-6 w-full rounded-md transition-colors duration-300 ${m.estado === "tem" ? "bg-ink/70" : m.estado === "novo" ? "bg-accent" : "bg-surface shadow-[inset_0_0_0_1px_var(--color-border-strong)]"}`}
              aria-label={`${m.rotulo}: ${m.estado === "falta" ? "falta" : "tem"}`}
            />
            <span className="text-[12px] leading-none text-ink-muted max-[359px]:hidden">{m.rotulo.charAt(0).toUpperCase()}</span>
          </span>
        ))}
      </div>
      {faltam.length > 0 && <span className="text-sm text-ink">Faltam: {faltam.length <= 3 ? faltam.join(faltam.length === 2 ? " e " : ", ") : `${faltam.slice(0, 2).join(", ")} e mais ${faltam.length - 2}`}</span>}
    </div>
  );
}
