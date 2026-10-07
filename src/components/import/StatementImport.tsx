"use client";

import { FalarComSuporte } from "@/components/support/FalarComSuporte";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Upload, Check, ArrowRight, Lock, Plus, Tag, ChevronLeft, ChevronDown, CircleHelp } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { PARENT_CATEGORIES, categoryLabel, categoriaOculta, categoryIcon, colorForCategorySlice, emojiEscolhido } from "@/lib/categories";
import { emojiDaCategoria } from "@/lib/profiles/icones";
import { Button } from "@/components/ui/Button";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useToast } from "@/components/ui/toast-context";
import { createCategoryAction } from "@/lib/actions/category";
import {
  parseStatementAction,
  importTransactionsAction,
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
import { UPLOAD_MAX_BYTES } from "@/lib/import/limites";
import { iguaisPraAplicar, proximaPendente, semCategoria as gastoSemCategoria } from "@/lib/import/revisao-em-grupo";
import { mesDaRevelacao, type Revelacao } from "@/lib/import/revelacao";
import { resumoDoMesImportadoAction } from "@/app/(app)/mensal/revelacao-actions";
import { ComoImportar } from "./ComoImportar";
import { ComoTirarExtrato } from "./ComoTirarExtrato";
import { ProtegerSaida } from "./ProtegerSaida";
import { nomeNaTela } from "@/lib/import/nome-na-tela";
import { FitText } from "@/components/ui/FitText";
import { Explica } from "@/components/ui/Explica";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

type Phase = "upload" | "password" | "review" | "confirm" | "done";

/** "YYYY-MM" do mês corrente, usado como valor inicial do seletor de mês da fatura. */
function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}


function formatDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

/** "2026-10-10" → "10/10/2026", pro "achei no arquivo: vence em…". */
function formatFullDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
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
}: {
  onDone: () => void;
  /** Os OUTROS perfis do usuário (não o ativo) — deixa mandar uma linha da fatura pra lá em vez
   * do perfil ativo (ex.: compra da Empresa que caiu no cartão Pessoal). Vazio pra quem só tem
   * um perfil: nenhum botão extra aparece. */
  otherProfiles?: { id: string; name: string }[];
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
  // Perfil Casal: de quem é o extrato/fatura. Todas as linhas entram com esse nome em "quem pagou".
  const [pessoaDoExtrato, setPessoaDoExtrato] = useState<"A" | "B">("A");
  // Mês/ano de destino da FATURA (todas as compras entram nesse mês, escolhido por quem importa
  // — não no mês de cada compra, que fica espalhado pelo período de fechamento da fatura).
  const [faturaMonth, setFaturaMonth] = useState(currentMonthValue());
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
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string }[]>([]);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  // Ela mexeu no mês da fatura à mão: o vencimento lido do arquivo vira só uma sugestão, não
  // troca a escolha dela.
  const [faturaMesTocado, setFaturaMesTocado] = useState(false);
  // Conferência: a linha aberta pra trocar categoria/tipo, e se a lista longa está inteira.
  const [editandoKey, setEditandoKey] = useState<number | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  // Depois de importar: o mês montado. `mes` null = arquivo sem data, fica só o "pronto".
  const [revelacao, setRevelacao] = useState<{ mes: { year: number; month: number } | null; dados: Revelacao | null; carregando: boolean }>({
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

  function handleFile(file: File) {
    setError(null);
    // Arquivo novo: a pergunta de tipo (e a senha guardada nela) era do anterior.
    setKindMismatch(null);
    // …e o vencimento lido também: sem isso o "achei no arquivo" do anterior aparecia no novo.
    setStats(null);
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
    const type = forcedType ?? docType;
    const formData = buildUploadForm(file, type, type === "fatura" ? faturaMonth : undefined);
    if (pwd) formData.set("password", pwd);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof parseStatementAction>>;
      try {
        result = await parseStatementAction(formData);
      } catch (err) {
        console.error("parseStatementAction falhou no envio", err);
        setError(t.impErroEnvio);
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
      // Fatura subida como extrato vira renda; extrato subido como fatura vira gasto. Se o
      // conteúdo diz que é o outro tipo, pergunta antes de mostrar qualquer lançamento.
      if (!acceptKind && result.stats.detectedKind !== "unknown" && result.stats.detectedKind !== type) {
        // A pergunta só aparece na tela de upload. Vindo da tela de senha, sem voltar pra ela o
        // "Desbloquear" parava de carregar e nada acontecia; e sem guardar a senha, responder
        // "é extrato mesmo" reenviava o arquivo trancado e caía na senha de novo, em loop.
        setKindMismatch({ file, suggested: result.stats.detectedKind, reason: result.stats.detectedReason, pwd });
        // Só pro "achei no arquivo: vence em…" da pergunta; a leitura de verdade vem na resposta.
        setStats(result.stats);
        if (result.stats.detectedKind === "fatura" && result.stats.vencimento && !faturaMesTocado) setFaturaMonth(result.stats.vencimento.slice(0, 7));
        setPhase("upload");
        return;
      }
      // Fatura: o mês certo é o do vencimento. Se o arquivo diz e ela não escolheu outro à mão,
      // já fica escolhido (o seletor começa no mês de hoje, e era aí que a fatura caía errada).
      if (type === "fatura" && result.stats.vencimento && !faturaMesTocado) setFaturaMonth(result.stats.vencimento.slice(0, 7));
      setKindMismatch(null);
      setStats(result.stats);
      setItems(result.items);
      setCustomCategories(result.customCategories);
      setReviewIdx(0);
      // Se nada precisa de revisão, pula direto pra confirmação.
      // O que é dúvida (dinheiro dela mesma) ou fica de fora não pede categoria agora.
      const pendentes = result.items.filter((it) => gastoSemCategoria(it) && !it.ignorar && !it.duvida);
      setReviewKeys(pendentes.map((it) => it.key));
      setPhase(pendentes.length > 0 ? "review" : "confirm");
    });
  }

  /**
   * Põe a categoria na linha E nos iguais dela (mesma loja, mesmo Pix — ver revisao-em-grupo):
   * cinco Pix pra mesma pessoa eram cinco toques. Devolve as chaves que ganharam categoria, pra
   * fila pular as que já foram resolvidas junto.
   */
  function aplicarCategoria(itemKey: number, escolha: { parentCategory: ParentCategory | null; customCategoryId: string | null }): Set<number> {
    const iguais = iguaisPraAplicar(items, itemKey);
    const resolvidas = new Set([itemKey, ...iguais]);
    setItems((prev) =>
      prev.map((it) => (resolvidas.has(it.key) ? { ...it, ...escolha, subcategory: null, autoClassified: false } : it)),
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
    const confirmed: ConfirmedItem[] = items
      .filter(entraNaImportacao)
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
    const [targetYear, targetMonth] = docType === "fatura" ? faturaMonth.split("-").map(Number) : [undefined, undefined];
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof importTransactionsAction>>;
      try {
        result = await importTransactionsAction(confirmed, docType, targetYear, targetMonth, fileName ?? undefined, perfilDaTela, nomesDoCasal ? pessoaDoExtrato : null);
      } catch (err) {
        console.error("importTransactionsAction falhou no envio", err);
        setError(t.impErroSalvar);
        return;
      }
      if (!result.ok) {
        setError(result.error);
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
   * "Em que mês essa fatura vence?" — o mesmo bloco nos três lugares em que o mês aparece
   * (envio, aviso de "parece fatura" e conferência). Se o arquivo trouxe o vencimento, diz o que
   * achou; se ela escolheu outro mês, oferece o do arquivo com um toque, sem trocar sozinho.
   */
  function mesDaFatura(id: string) {
    const venc = stats?.vencimento ?? null;
    const mesDoVencimento = venc ? venc.slice(0, 7) : null;
    return (
      <div className="flex flex-col gap-1.5">
        <MonthPicker label={t.impFaturaVence} id={id} value={faturaMonth} onChange={escolherMesFatura} />
        <span className="text-caption text-ink-faint">{t.impFaturaVenceDica(formatMonthYear(faturaMonth))}</span>
        {venc && mesDoVencimento && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-accent-strong">{t.impFaturaVencimentoLido(formatFullDate(venc))}</span>
            {mesDoVencimento !== faturaMonth && (
              <button
                type="button"
                onClick={() => setFaturaMonth(mesDoVencimento)}
                className="inline-flex min-h-11 items-center rounded-full border border-accent px-3 text-sm font-medium text-accent-strong hover:bg-accent-soft"
              >
                {t.impFaturaUsarMes(formatMonthYear(mesDoVencimento))}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

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

        {kindMismatch && (
          <div className="flex flex-col gap-3 rounded-xl border border-danger/40 bg-danger-soft px-4 py-3">
            <p className="text-sm font-semibold text-ink">{t.impPareceOutroTipo(kindMismatch.suggested, docType, kindMismatch.reason)}</p>
            <p className="text-caption text-ink-muted">
              {kindMismatch.suggested === "fatura" ? t.impPareceFaturaAviso : t.impPareceExtratoAviso}
            </p>
            {/* Virar fatura por aqui segue direto pra revisão: sem a pergunta do mês neste ponto,
                a fatura de maio subida em setembro caía inteira em setembro sem ela ver. */}
            {kindMismatch.suggested === "fatura" && mesDaFatura("fatura-month-aviso")}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-11"
                onClick={() => {
                  setDocType(kindMismatch.suggested);
                  runParse(kindMismatch.file, kindMismatch.pwd, kindMismatch.suggested, true);
                }}
              >
                {t.impImportarComo(kindMismatch.suggested)}
              </Button>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => runParse(kindMismatch.file, kindMismatch.pwd, docType, true)}>
                {t.impEMesmo(docType)}
              </Button>
            </div>
          </div>
        )}

        <ComoImportar />

        {/* Extrato bancário (sinal manda) vs Fatura de cartão (tudo é gasto). */}
        <div className="flex flex-col gap-1.5">
          {/* O que cada tipo faz mora no "?" (07/10/2026), não numa frase embaixo dos botões. */}
          <span className="flex items-center gap-1.5 text-caption text-ink-muted">
            {t.impOQueSubindo}
            <Explica>{docType === "fatura" ? t.impFaturaDica : t.impExtratoDica}</Explica>
          </span>
          <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
            {(["extrato", "fatura"] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setDocType(tipo)}
                aria-pressed={docType === tipo}
                data-guia={`tipo-${tipo}`}
                className={`min-h-11 flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  docType === tipo ? "bg-pill text-on-pill" : "text-ink-muted hover:text-ink"
                }`}
              >
                {tipo === "extrato" ? t.impTipoExtrato : t.impTipoFatura}
              </button>
            ))}
          </div>
        </div>

        {/* Fatura: a pessoa escolhe o mês de destino — todas as compras entram nesse mês (o
            período de fechamento da fatura costuma cruzar dois meses do calendário, e a data
            de cada compra não é o que importa aqui, é quando a fatura foi paga). */}
        {docType === "fatura" && mesDaFatura("fatura-month")}

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

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isPending}
          data-guia="escolher-arquivo"
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-4 py-10 text-center transition-colors hover:border-accent hover:bg-surface-hover disabled:opacity-60"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pill text-on-pill">
            <Upload size={22} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-medium text-ink">{isPending ? t.impLendoArquivo : t.impEscolherExtrato}</span>
          <span className="text-caption text-ink-faint">{t.impFormatosBanco}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.ofx,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Zera o campo: depois de um erro, escolher o MESMO arquivo de novo não dispara
            // change (o valor não mudou) e o toque não fazia nada, justo quando o aviso mandou tentar de novo.
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />

        {/* Onde pegar o arquivo, banco por banco: a dúvida nº 1 de quem nunca importou. */}
        <ComoTirarExtrato />
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
  function iconeDe(pc: ParentCategory, tamanho: 36 | 40 = 36) {
    const emoji = emojiEscolhido(categorias, pc) ?? emojiDaCategoria(tema, { kind: "parent", value: pc });
    return <CategoryIcon icon={categoryIcon(categorias, pc)} color={colorForCategorySlice({ kind: "parent", value: pc }, categorias)} size={tamanho} variant="soft" emoji={emoji} />;
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
        {PARENT_CATEGORIES.filter((pc) => !categoriaOculta(categorias, pc) || it.parentCategory === pc).map((pc) => (
          <button key={pc} type="button" aria-pressed={it.parentCategory === pc} onClick={() => aoEscolher(assignParent(it.key, pc))} className={`${quadrado} ${cor(it.parentCategory === pc)}`}>
            {iconeDe(pc)}
            <span className="text-xs font-medium leading-tight text-ink">{categoryLabel(categorias, pc)}</span>
          </button>
        ))}
        {!it.profileId &&
          customCategories.map((cc) => (
            <button key={cc.id} type="button" aria-pressed={it.customCategoryId === cc.id} onClick={() => aoEscolher(assignCustom(it.key, cc.id))} className={`${quadrado} ${cor(it.customCategoryId === cc.id)}`}>
              <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted" aria-hidden>
                <Tag size={16} />
              </span>
              <span className="line-clamp-2 text-xs font-medium leading-tight text-ink">{cc.name}</span>
            </button>
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
        {PARENT_CATEGORIES.filter((pc) => !categoriaOculta(categorias, pc) || it.parentCategory === pc).map((pc) => (
          <button key={pc} type="button" aria-pressed={it.parentCategory === pc} onClick={() => aoEscolher(assignParent(it.key, pc))} className={classe(it.parentCategory === pc)}>
            {categoryLabel(categorias, pc)}
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
          ativo
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
          <p className="text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-ink">{money(it.amount)}</p>
          {/* O nome da loja sem o "Compra no débito - " na frente; o meio vira etiqueta (07/10/2026). */}
          <p className="mt-2 text-[15px] font-semibold leading-snug text-ink">{nomeNaTela(it.description).nome}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
            {formatDate(it.date)}
            {nomeNaTela(it.description).meio && <span className="rounded-full bg-surface px-2 py-0.5 font-medium">{nomeNaTela(it.description).meio}</span>}
          </p>
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
            entrar sem categoria: ele aparece no mês e dá pra classificar depois. */}
        <Button type="button" variant="secondary" className="min-h-11" onClick={() => advanceReview()}>
          {t.impNaoSeiAgora}
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
    const visiveis = mostrarTodos ? importable : importable.slice(0, LINHAS_VISIVEIS);
    const rotuloDaLinha = (it: ReviewItem) =>
      it.category === "INCOME"
        ? t.impRotuloRenda
        : it.category === "INVESTMENT_CONTRIBUTION"
          ? it.resgate
            ? t.uiTipoResgate
            : t.uiTipoAporte
          : it.parentCategory
            ? categoryLabel(categorias, it.parentCategory)
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
          ativo={importable.length > 0}
          areaRef={areaRef}
          textos={{ titulo: t.impSairTitulo, dica: t.impSairDica, ficar: t.impSairFicar, sair: t.impSairSim }}
        />
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        {/* Sem categoria numa linha (07/10/2026): quantos, quanto somam e um botão. A explicação de
            que eles entram assim mesmo mora no "?". */}
        {semCategoria.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden>
              <CircleHelp size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                {semCategoria.length === 1 ? "1 sem categoria" : `${semCategoria.length} sem categoria`}
                <Explica>{t.impSemCategoriaEntraSub(semCategoria.length, money(semCategoria.reduce((sum, it) => sum + it.amount, 0)))}</Explica>
              </span>
              <span className="block text-caption tabular-nums text-ink-muted">{money(semCategoria.reduce((sum, it) => sum + it.amount, 0))}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setReviewKeys(semCategoria.map((it) => it.key));
                setReviewIdx(0);
                setPhase("review");
              }}
              className="min-h-10 shrink-0 rounded-full bg-accent-soft px-4 text-sm font-semibold text-accent-strong"
            >
              Escolher
            </button>
          </div>
        )}

        {/* Leitura que não parece dinheiro de gente. Fica ACIMA da conferência e em tom de alerta
            porque é o único aviso que diz "não confirme ainda": quando isso aparece, o mês inteiro
            da pessoa vai entrar errado — orçamento, saúde financeira e gráfico junto. */}
        {stats && stats.suspeitas.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-danger/50 bg-danger/5 px-4 py-3">
            <p className="text-sm font-semibold text-danger">{t.impNumerosErrados}</p>
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

        {/* Conferência: o que o app leu, em números (07/10/2026, em quadradinhos). O quanto entrou,
            saiu e foi guardado, um selo "Conferido" quando bateu com o total do documento, e o
            "como entendi" no "?". */}
        {(() => {
          const entrou = importable.filter((it) => it.category === "INCOME").reduce((s2, it) => s2 + it.amount, 0);
          const guardado = importable.filter((it) => it.category === "INVESTMENT_CONTRIBUTION").reduce((s2, it) => s2 + (it.resgate ? -it.amount : it.amount), 0);
          const quadrados = [
            ...(docType !== "fatura" && entrou > 0 ? [{ rotulo: t.entrou, valor: money(entrou, { round: true }), cor: "text-success" }] : []),
            { rotulo: docType === "fatura" ? "Na fatura" : t.gastou, valor: money(expenseSum, { round: true }), cor: "text-ink" },
            ...(guardado !== 0 ? [{ rotulo: t.aportou, valor: money(guardado, { round: true }), cor: "text-accent-strong" }] : []),
          ];
          return (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                    {docType === "fatura" ? "Na fatura" : "No extrato"}
                    {stats && <Explica>{t.impEntendiComo(stats.summary)}</Explica>}
                  </p>
                  <p className="text-[2rem] font-bold leading-none tracking-tight tabular-nums text-ink">{importable.length}</p>
                  <p className="mt-1 text-caption text-ink-muted">{importable.length === 1 ? "lançamento" : "lançamentos"}</p>
                </div>
                {stats?.conferencia.status === "fechou" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success" title={t.impBateuComTotal(money(stats.conferencia.esperado))}>
                    <Check size={13} strokeWidth={2.5} aria-hidden /> Conferido
                  </span>
                ) : (
                  stats && (
                    <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-muted">
                      {stats.parsed} de {stats.moneyLines} linhas
                    </span>
                  )
                )}
              </div>
              <div className={`grid gap-2 ${quadrados.length >= 3 ? "grid-cols-3" : quadrados.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {quadrados.map((q) => (
                  <div key={q.rotulo} className="min-w-0 rounded-xl bg-surface px-2.5 py-2">
                    <p className="line-clamp-2 text-caption leading-tight text-ink-muted">{q.rotulo}</p>
                    {/* O número encolhe para caber (R$ 15.300 em três colunas no celular), nunca corta. */}
                    <FitText className={`mt-0.5 text-[15px] font-bold tabular-nums ${q.cor}`}>{q.valor}</FitText>
                  </div>
                ))}
              </div>
              {/* Fatura: o mês de destino fica à vista (e dá pra trocar) até o último toque. Quem
                  chegou aqui pelo aviso "parece fatura" nunca tinha visto a pergunta do mês. */}
              {docType === "fatura" && mesDaFatura("fatura-month-confirmar")}
              {stats?.conferencia.status !== "fechou" && stats?.invoiceTotal ? <p className="text-caption text-ink-muted">{t.impTotalImpresso(money(stats.invoiceTotal))}</p> : null}
              {lowCoverage && (
                <div className="flex flex-col gap-2">
                  <p className="text-caption text-danger">{t.impCoberturaBaixa}</p>
                  <FalarComSuporte arquivo={fileName} problema="o app leu só parte do arquivo" rotulo={t.impFaltouCoisa} />
                </div>
              )}
              {/* Só quando a soma NÃO bateu com nenhum total do documento: a fatura do Ourocard traz
                  "Total" = saldo anterior − pagamento + compras, que nunca é a soma das compras. */}
              {stats?.invoiceTotal && stats.conferencia.status !== "fechou" && Math.abs(totalGap) >= 1 && (
                <p className="text-caption text-danger">{t.impSomaDiferente(totalGap > 0, money(Math.abs(totalGap)))}</p>
              )}
            </div>
          );
        })()}

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
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{nomeNaTela(it.description).nome}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                      {it.category === "INCOME" ? "+" : "−"} {money(it.amount)}
                    </span>
                  </span>
                  <span className="-mt-1 text-caption text-ink-muted">{formatDate(it.date)}</span>
                  {/* O destaque vai pra resposta certa quase sempre: dinheiro indo pra outra conta
                      dela é "só mudei de conta". Antes o botão forte era "Guardei (aplicação)", e
                      quem só passou o dinheiro do Nubank pro Itaú marcava investimento que não fez. */}
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
                  <span className="text-sm text-ink">
                    {it.description}, {money(it.amount)}, {formatDate(it.date)}
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
                        <p className="truncate text-caption text-ink-muted">{formatDate(it.date)}, {nomeNaTela(it.description).nome}</p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-surface px-3 py-2">
                        <p className="text-caption text-ink-muted">{dup.importado ? "Já importado" : "Você lançou"}</p>
                        <p className="truncate text-[15px] font-bold tabular-nums text-ink">{money(dup.valor ?? it.amount)}</p>
                        <p className="truncate text-caption text-ink-muted">
                          {dup.data ? `${formatDate(dup.data)}, ` : ""}
                          {dup.descricao}
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
                  <span className="min-w-0 truncate text-sm text-ink">
                    {group[0].description}, {money(group[0].amount)}, {group.length}× em {formatDate(group[0].date)}
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
            ali mesmo a categoria, o tipo, "não importar" e o outro perfil: antes só dava pra
            trocar o TIPO, e o palpite errado do app (iFood em Mercado) só se corrigia depois de
            importar, um por um. Fechada, a linha é curta; os botões de 44px só aparecem na aberta.
            No celular a lista NÃO tem rolagem própria (brigava com a da janela); do sm pra cima,
            caixa com altura fixa. */}
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
                    <span className="block truncate text-sm font-medium text-ink">{nomeNaTela(it.description).nome}</span>
                    <span className="block truncate text-caption text-ink-muted">
                      {formatDate(it.date)}, {it.estorno && `${t.impTipoDevolucao}, `}
                      <span className={gastoSemCategoria(it) && !it.duvida ? "font-medium text-accent-strong" : undefined}>{rotuloDaLinha(it)}</span>
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
                        tinha classificado sozinho, e vira regra pra próxima importação. */}
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
                        cartão Pessoal, por exemplo. Só aparece pra quem tem mais de um perfil. */}
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
                        reconheceu, por exemplo). Vai pro "fica de fora", de onde volta com um toque. */}
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
        {!mostrarTodos && importable.length > LINHAS_VISIVEIS && (
          <button type="button" onClick={() => setMostrarTodos(true)} className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-accent-strong hover:underline">
            {t.impMostrarTodos(importable.length)}
          </button>
        )}

        {/* O botão fica grudado no pé da gaveta: com a lista longa, ele sumia lá embaixo. A faixa
            depois dele cobre o respiro da gaveta, pra lista não aparecer por baixo. */}
        <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-border bg-surface pt-3 after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-surface">
          {duvidas.length + duvidasDinheiro.length > 0 && <p className="text-center text-caption text-ink-muted">Responda as dúvidas acima pra importar.</p>}
          <Button type="button" className="min-h-11" onClick={handleImport} disabled={isPending || importable.length === 0 || duvidas.length + duvidasDinheiro.length > 0}>
            {isPending ? t.impImportando : t.impImportarN(importable.length)}
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

      {revelacao.mes ? (
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
      {createdCount > 0 && <p className="text-caption text-ink-muted">{t.impRevelaDesfazer(t.impHistoricoTitulo)}</p>}
    </div>
  );
}
