"use client";

import { ACEITA_ARQUIVO_DE_EXTRATO } from "@/lib/import/limites";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Building2, Check, ChevronDown, ChevronLeft, CircleHelp, Delete, FileText, Globe, Keyboard, Mail, Mic, Search, ShieldCheck, Wallet, X } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { BrandMark } from "@/components/brand/BrandMark";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { StatementImport, type EstadoParaOComeco } from "@/components/import/StatementImport";
import { importarArquivoNoMes } from "@/components/shell/registrar-eventos";
import { VoiceRecorder } from "@/app/(app)/mensal/VoiceRecorder";
import type { ParsedVoiceEntry } from "@/lib/entries/voice-expense-parser";
import { useMoney } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { trackEvent } from "@/lib/usage/track-event";
import { marcaDaDescricao } from "@/lib/marcas/marca";
import { PARENT_CATEGORIES, categoriaOculta, categoryIcon, categoryLabel } from "@/lib/categories";
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "@/lib/money";
import {
  ATALHOS_DO_GASTO,
  BANCOS_DO_COMECO,
  PRINCIPAIS_DO_COMECO,
  apelidoLimpo,
  bancoDoComeco,
  bancoQueFalta,
  barraDoPasso,
  buscarBancos,
  caminhoDoEvento,
  centavosParaReais,
  EVENTOS_DO_COMECO,
  faseDoPasso,
  passoAnterior,
  teclarValor,
  type BancoDoComeco,
  type Comeco as DadosDoComeco,
  type EventoDoComeco,
  type PassoDoComeco,
} from "@/lib/onboarding/comeco";
import { MAX_PERGUNTAS_DO_COMECO } from "@/lib/onboarding/conferencia-inicial";
import { CAMINHO_GENERICO, caminhoDaFatura, caminhoDoExtrato, leMelhor } from "@/lib/onboarding/bancos";

/** Por que a ajuda do banco abriu (muda só a frase de cima). */
type MotivoDaAjuda = "pediu" | "travou" | "falhou";
import { primeiroGastoAction, pularComecoAction, salvarComecoAction, terminarComExtratoAction } from "./actions";
import { BotaoPrincipal, LinkDiscreto, Nota, Pe, Pilula, Recado, Selo, Titulo } from "./pecas";

/** E-mail do "Fale com a gente" (pendência 5.1.13: a recomendação é o e-mail do app). */
export const EMAIL_FALE_COM_A_GENTE = "app@danicolombo.com.br";

/**
 * A saída do começo para a Visão geral, com a página carregada de novo: o roteador do cliente
 * guardava o "manda para o /comecar" de quando a conta ainda não tinha terminado o começo, e quem
 * digitava o primeiro gasto em menos de 30 segundos voltava para as boas-vindas.
 */
function irParaAVisaoGeral() {
  window.location.replace("/mensal/foco");
}

function registrar(evento: EventoDoComeco, detalhe?: string | null) {
  trackEvent(evento, caminhoDoEvento(evento, detalhe));
}

/**
 * O começo de quem acabou de entrar (leva 1 do primeiro uso, aprovada em 14/10/2026). Uma coisa
 * por tela, com "Pular" no topo de todas: Boas-vindas, Porta e o envio do arquivo (3 telas, 3
 * toques até o extrato). O banco não é mais um passo: "Como baixar do meu banco?" abre a ajuda,
 * que também aparece quando ela não consegue baixar ou o arquivo não dá certo. Na conferência do extrato, no máximo 3 perguntas; o resto fica "A conferir". Termina na
 * Visão geral com o mês dela na tela. O nome vem da conta (da compra), o tema fica no Padrão e a
 * renda fica para depois: nada disso é perguntado no primeiro dia.
 */
export function Comeco({
  inicial,
  passoInicial,
  bancoInicial,
  nomeDaConta,
  moedaAtual,
}: {
  inicial: DadosDoComeco | null;
  passoInicial: PassoDoComeco;
  /** Vindo dos Primeiros passos: o banco que ficou para depois. */
  bancoInicial?: string | null;
  /** O primeiro nome da conta (vem da compra). Sem nome, o app não chama por nome. */
  nomeDaConta: string | null;
  moedaAtual: CurrencyCode;
}) {
  const money = useMoney();
  const [passo, setPasso] = useState<PassoDoComeco>(passoInicial);
  const [direcao, setDirecao] = useState<1 | -1 | 0>(0);
  const [banco, setBanco] = useState<string | null>(bancoInicial ?? inicial?.banco ?? null);
  // Por que a ajuda do banco abriu: ela pediu, não conseguiu baixar, ou o arquivo não deu certo.
  const [motivoDaAjuda, setMotivoDaAjuda] = useState<MotivoDaAjuda>("pediu");
  // A confirmação inequívoca de que lançou ("Lançado."), antes da Visão geral.
  const [pronto, setPronto] = useState<{ titulo: string; linha: string } | null>(null);
  const [saindo, startSaida] = useTransition();
  const nome = apelidoLimpo(inicial?.apelido ?? nomeDaConta);

  // Primeira tela da primeira vez: a marca "começou" do funil, uma vez.
  const marcouComeco = useRef(false);
  useEffect(() => {
    if (marcouComeco.current || passoInicial !== "b1" || inicial) return;
    marcouComeco.current = true;
    registrar(EVENTOS_DO_COMECO.comecou);
  }, [passoInicial, inicial]);

  const ir = useCallback((p: PassoDoComeco, dir: 1 | -1 | 0 = 1, extra: Parameters<typeof salvarComecoAction>[0] = {}) => {
    setDirecao(dir);
    setPasso(p);
    window.scrollTo({ top: 0 });
    // A leitura do extrato não é um lugar para onde se volta (o arquivo não fica guardado).
    void salvarComecoAction({ ...extra, ...(p === "lendo" ? {} : { passo: p }) }).catch(() => {});
  }, []);

  const abrirAjuda = useCallback(
    (motivo: MotivoDaAjuda) => {
      setMotivoDaAjuda(motivo);
      ir("banco");
    },
    [ir],
  );

  const pular = useCallback(() => {
    registrar(EVENTOS_DO_COMECO.pulou, passo);
    startSaida(async () => {
      await pularComecoAction(passo).catch(() => {});
      irParaAVisaoGeral();
    });
  }, [passo]);

  const anterior = passoAnterior(passo);
  const barra = barraDoPasso(passo);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-20 bg-canvas/95 px-4 pb-2 pt-[calc(var(--safe-top,0px)+10px)] backdrop-blur-sm">
        <div className="mx-auto grid max-w-md grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2">
          {anterior ? (
            <button type="button" onClick={() => ir(anterior, -1)} aria-label="Voltar" className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink">
              <ChevronLeft size={22} />
            </button>
          ) : (
            <span aria-hidden />
          )}
          <span className="truncate text-center text-[13px] font-semibold text-ink-muted">{faseDoPasso(passo)}</span>
          <button type="button" onClick={pular} disabled={saindo} className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-ink-muted underline decoration-border-strong underline-offset-4 hover:text-ink disabled:opacity-50">
            Pular
          </button>
        </div>
        {barra.total > 0 && (
          <div className="mx-auto mt-1 grid max-w-md auto-cols-fr grid-flow-col gap-1.5" aria-hidden>
            {Array.from({ length: barra.total }, (_, i) => (
              <i key={i} className={`h-1 rounded-full transition-colors ${i <= barra.atual ? "bg-accent" : "bg-border-strong"}`} />
            ))}
          </div>
        )}
      </header>

      <main key={passo} className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-[calc(var(--safe-bottom,0px)+20px)] pt-2 ${direcao !== 0 ? "passo-entra" : ""}`}>
        {passo === "b1" && <BoasVindas1 onSeguir={() => ir("porta")} money={money} />}

        {pronto && <Confirmacao {...pronto} onSeguir={() => irParaAVisaoGeral()} />}
        {!pronto && passo === "porta" && (
          <Porta
            moedaAtual={moedaAtual}
            onMoeda={(m) => {
              registrar(EVENTOS_DO_COMECO.moeda, m.toLowerCase());
              void salvarComecoAction({ moeda: m }).catch(() => {});
            }}
            onEscolher={(p) => {
              registrar(EVENTOS_DO_COMECO.porta, p);
              // Extrato: direto para o envio. O banco fica para a ajuda, se ela precisar.
              ir(p === "extrato" ? "tutorial" : p, 1, { porta: p });
            }}
          />
        )}
        {!pronto && passo === "banco" && (
          <EscolhaDoBanco
            motivo={motivoDaAjuda}
            onEscolher={(b) => {
              registrar(EVENTOS_DO_COMECO.banco, b);
              setBanco(b);
              // Um banco por vez (um toque e já vai). O segundo vira o próximo passo do Resumo.
              ir("tutorial", 1, { banco: b, bancos: [b] });
            }}
          />
        )}
        {!pronto && (passo === "tutorial" || passo === "volta") && (
          <Envio
            key={banco ?? "sem-banco"}
            banco={bancoDoComeco(banco)}
            volta={passo === "volta"}
            nome={nome}
            onArquivo={(arquivo) => {
              registrar(EVENTOS_DO_COMECO.enviou, banco ?? "sem-banco");
              importarArquivoNoMes(arquivo);
              ir("lendo");
            }}
            onAjuda={abrirAjuda}
            onDigitar={() => ir("digitar")}
          />
        )}
        {!pronto && passo === "lendo" && (
          <Lendo
            key={banco ?? "outro"}
            money={money}
            onTerminar={(mes, revisou) => {
              registrar(EVENTOS_DO_COMECO.revisou, revisou ? "com-revisao" : "sem-revisao");
              startSaida(async () => {
                await terminarComExtratoAction({ mes, revisou, banco }).catch(() => {});
                // Direto para o mês dela: a Visão geral abre com "Esse é o seu setembro".
                irParaAVisaoGeral();
              });
            }}
            onOutroArquivo={() => ir("tutorial", -1)}
            onAjuda={() => abrirAjuda("falhou")}
          />
        )}
        {!pronto && passo === "digitar" && <Digitar money={money} onLancado={(linha) => setPronto({ titulo: "Lançado.", linha })} onFalar={() => ir("falar")} />}
        {!pronto && passo === "falar" && <Falar money={money} onLancado={(linha) => setPronto({ titulo: "Lançado.", linha })} onDigitar={() => ir("digitar", -1)} />}
      </main>
    </div>
  );
}

type Money = ReturnType<typeof useMoney>;

// ---------------------------------------------------------------------------------------------
// Boas-vindas
// ---------------------------------------------------------------------------------------------

const SEMANA = ["S", "T", "Q", "Q", "S", "S", "D"];

function BoasVindas1({ onSeguir, money }: { onSeguir: () => void; money: Money }) {
  return (
    <>
      <div className="mt-2 flex flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <BrandMark size={40} />
          <b className="text-[17px] font-semibold">SPI Finance</b>
        </div>
        {/* Uma amostra do que ela vai ver, com o selo de exemplo: não é o dinheiro dela. */}
        <HeroiDoTema>
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-heroi-suave">Livre até domingo</span>
            <span className="heroi-veu rounded-full px-2.5 py-0.5 text-[12px] font-semibold">exemplo</span>
          </div>
          <ValorDestaque texto={money(648, { round: true })} />
          <div className="grid grid-cols-7 gap-1.5" aria-hidden>
            {SEMANA.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <i className={`h-[7px] w-full rounded-full ${i < 2 ? "bg-current opacity-30" : i === 2 ? "bg-current" : "heroi-veu"}`} />
                <span className={`text-[12px] ${i === 2 ? "font-bold" : "text-heroi-suave"}`}>{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 border-t border-current/15 pt-3">
            <div>
              <span className="block text-sm text-heroi-suave">Por dia</span>
              <b className="text-lg font-semibold tabular-nums">{money(130, { round: true })}</b>
            </div>
            <div className="border-l border-current/15 pl-4">
              <span className="block text-sm text-heroi-suave">Fim do mês</span>
              <b className="text-lg font-semibold tabular-nums">+{money(383, { round: true })}</b>
            </div>
          </div>
        </HeroiDoTema>
        <Titulo nivel={1} sub="E eu te digo o que fazer.">
          Seu dinheiro em ordem.
        </Titulo>
      </div>
      <Pe>
        <BotaoPrincipal onClick={onSeguir}>Começar</BotaoPrincipal>
      </Pe>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// O primeiro lançamento
// ---------------------------------------------------------------------------------------------

/** "Como você quer começar?": os três caminhos do mesmo tamanho, e o link de quem mora fora. */
function Porta({ moedaAtual, onMoeda, onEscolher }: { moedaAtual: CurrencyCode; onMoeda: (m: CurrencyCode) => void; onEscolher: (p: "extrato" | "digitar" | "falar") => void }) {
  const [fora, setFora] = useState(moedaAtual !== "BRL");
  const [moeda, setMoeda] = useState<CurrencyCode>(moedaAtual);
  const cartao = "glass flex min-h-[104px] items-center gap-3.5 rounded-3xl px-[18px] py-4 text-left";
  return (
    <>
      <Titulo sub="começar?">Como você quer</Titulo>
      <button type="button" onClick={() => onEscolher("extrato")} className="relative text-left" data-porta="extrato">
        <HeroiDoTema className="min-h-[104px] !flex-row !items-center !gap-3.5 !px-[18px] !py-4">
          <span className="heroi-veu flex size-11 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <FileText size={21} strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-lg font-semibold leading-tight">Extrato ou fatura</b>
            <small className="text-sm font-medium text-heroi-suave">Mostra o mês todo</small>
          </span>
          <span className="heroi-veu shrink-0 self-start rounded-full px-2.5 py-1 text-[12.5px] font-semibold">1 minuto</span>
        </HeroiDoTema>
      </button>
      <button type="button" onClick={() => onEscolher("digitar")} className={cartao} data-porta="digitar">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
          <Keyboard size={21} strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-col">
          <b className="text-lg font-semibold leading-tight">Digitar um gasto</b>
          <small className="text-sm font-medium text-ink-muted">Um de cada vez</small>
        </span>
      </button>
      <button type="button" onClick={() => onEscolher("falar")} className={cartao} data-porta="falar">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
          <Mic size={21} strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-col">
          <b className="text-lg font-semibold leading-tight">Falar</b>
          <small className="text-sm font-medium text-ink-muted">&quot;Mercado, 80 reais&quot;</small>
        </span>
      </button>
      <Pe>
        {fora ? (
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Moeda">
            {CURRENCY_CODES.map((c) => (
              <Pilula
                key={c}
                ativa={moeda === c}
                onClick={() => {
                  setMoeda(c);
                  onMoeda(c);
                }}
              >
                {CURRENCIES[c].symbol} {CURRENCIES[c].label}
              </Pilula>
            ))}
          </div>
        ) : (
          <LinkDiscreto onClick={() => setFora(true)}>
            <Globe size={15} className="mr-1.5" aria-hidden />
            Moro fora do Brasil
          </LinkDiscreto>
        )}
      </Pe>
    </>
  );
}

/** As letras do banco que não tem logo no catálogo ("BRB", "BV"). */
function Sigla({ texto, tamanho }: { texto: string; tamanho: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[13px] bg-surface-2 text-[13px] font-bold tracking-tight text-ink shadow-[inset_0_0_0_1px_var(--color-border)]" style={{ width: tamanho, height: tamanho }} aria-hidden>
      {texto}
    </span>
  );
}

function LogoDoBanco({ banco, tamanho = 44 }: { banco: BancoDoComeco; tamanho?: 40 | 44 | 48 }) {
  if (banco.marca && marcaDaDescricao(banco.marca)) return <LogoDoLancamento descricao={banco.marca} icon={Building2} size={tamanho} />;
  if (banco.sigla) return <Sigla texto={banco.sigla} tamanho={tamanho} />;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[13px] bg-surface-2 text-ink-muted" style={{ width: tamanho, height: tamanho }} aria-hidden>
      <Building2 size={22} strokeWidth={1.7} />
    </span>
  );
}

/**
 * A ajuda "Como baixar do meu banco?" (opcional desde 14/10/2026): um toque e já mostra o caminho.
 * Os 12 mais comuns na grade, a busca por nome, "Ver mais bancos" com o resto e, sempre no fim,
 * "Meu banco não está aqui". A frase de cima muda quando ela não conseguiu baixar ou o arquivo
 * não deu certo.
 */
function EscolhaDoBanco({ motivo, onEscolher }: { motivo: MotivoDaAjuda; onEscolher: (chave: string) => void }) {
  const [busca, setBusca] = useState("");
  const [todos, setTodos] = useState(false);
  const buscando = busca.trim().length > 0;
  const lista = buscando ? buscarBancos(busca) : todos ? BANCOS_DO_COMECO : BANCOS_DO_COMECO.slice(0, PRINCIPAIS_DO_COMECO);
  const faltam = BANCOS_DO_COMECO.length - PRINCIPAIS_DO_COMECO;
  return (
    <>
      <Titulo sub="Eu mostro o caminho.">{motivo === "falhou" ? "Vamos tentar de novo." : motivo === "travou" ? "Sem problema." : "Qual é o seu banco?"}</Titulo>
      <label className="flex h-12 items-center gap-2.5 rounded-2xl border border-border-strong bg-surface px-3.5 focus-within:border-accent">
        <Search size={18} className="shrink-0 text-ink-muted" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome"
          aria-label="Buscar o banco pelo nome"
          autoComplete="off"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
        />
        {buscando && (
          <button type="button" onClick={() => setBusca("")} aria-label="Limpar a busca" className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink">
            <X size={16} />
          </button>
        )}
      </label>
      {lista.length > 0 ? (
        <div className="grid grid-cols-3 gap-2" data-grade-de-bancos>
          {lista.map((b) => (
            <button key={b.chave} type="button" onClick={() => onEscolher(b.chave)} aria-label={b.nome} className="glass flex min-h-[92px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] px-1.5 pb-2.5 pt-3 active:scale-[0.97]">
              <LogoDoBanco banco={b} />
              <small className="w-full text-center text-[12px] font-semibold leading-tight [overflow-wrap:anywhere]">{b.nome}</small>
            </button>
          ))}
        </div>
      ) : (
        <Nota centro>Não achei esse nome na lista.</Nota>
      )}
      {!buscando && !todos && faltam > 0 && (
        <button type="button" onClick={() => setTodos(true)} className="mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]">
          Ver mais {faltam} bancos
          <ChevronDown size={16} aria-hidden />
        </button>
      )}
      <button type="button" onClick={() => onEscolher("outro")} className="glass flex min-h-[64px] items-center gap-3 rounded-[20px] px-4 py-3 text-left" data-banco-nao-esta-aqui>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted" aria-hidden>
          <Building2 size={19} strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-[15px] font-semibold">Meu banco não está aqui</b>
          <small className="text-[13px] font-medium text-ink-muted">Mostro o caminho que serve para todos</small>
        </span>
        <ArrowRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
      </button>
    </>
  );
}

/** O botão grande que abre o arquivo do celular (ou do computador). */
function EscolherArquivo({ onArquivo }: { onArquivo: (f: File) => void }) {
  return (
    <label className="inline-flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent-gradient px-5 text-base font-semibold text-on-accent shadow-premium-sm transition-opacity hover:opacity-95 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent" data-escolher-arquivo>
      <FileText size={19} aria-hidden />
      Escolher arquivo
      <input
        type="file"
        className="sr-only"
        accept={ACEITA_ARQUIVO_DE_EXTRATO}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onArquivo(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** "Não consegui baixar", com o banco já na tela: começa por um gasto, e o extrato fica para depois. */
function NaoConsegui({ onDigitar }: { onDigitar: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-surface-2 p-3.5" data-nao-consegui-baixar>
      <p className="text-sm font-medium leading-snug text-ink">Sem problema. Comece com um gasto de hoje, e o extrato fica para depois.</p>
      <BotaoPrincipal onClick={onDigitar}>
        <Keyboard size={17} aria-hidden />
        Digitar um gasto
      </BotaoPrincipal>
      <p className="text-[13px] leading-snug text-ink-muted">Está no computador? Abra o SPI no navegador de lá, com o mesmo e-mail, e envie por lá.</p>
      <a href={`mailto:${EMAIL_FALE_COM_A_GENTE}?subject=${encodeURIComponent("Ajuda com o extrato")}`} className="mx-auto inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-ink-muted hover:text-ink">
        <Mail size={15} aria-hidden />
        Fale com a gente
      </a>
    </div>
  );
}

/**
 * O envio do arquivo (14/10/2026): a tela já abre com o botão grande de escolher o arquivo. Sem
 * banco escolhido, só o envio e o link "Como baixar do meu banco?". Com banco (ela pediu a ajuda),
 * o passo a passo dele em cima do mesmo botão. O app descobre sozinho se é extrato ou fatura.
 */
function Envio({
  banco,
  volta,
  nome,
  onArquivo,
  onAjuda,
  onDigitar,
}: {
  banco: BancoDoComeco | null;
  volta: boolean;
  nome: string | null;
  onArquivo: (f: File) => void;
  onAjuda: (motivo: MotivoDaAjuda) => void;
  onDigitar: () => void;
}) {
  const [travou, setTravou] = useState(false);
  return (
    <>
      {volta && <Titulo sub="Falta só isso.">{nome ? `Oi de novo, ${nome}.` : "Oi de novo."}</Titulo>}
      {banco ? (
        <PassoAPassoDoBanco banco={banco} />
      ) : (
        <>
          {!volta && <Titulo sub="extrato ou fatura">Envie o seu</Titulo>}
          <label className="glass flex cursor-pointer flex-col items-center gap-3 rounded-3xl px-4 pb-5 pt-6 text-center" data-arquivo-visual>
            <span className="relative h-[84px] w-[120px]" aria-hidden>
              <span className="absolute left-0 top-2 flex h-[76px] w-[62px] -rotate-6 flex-col gap-1.5 rounded-lg bg-surface p-2 shadow-[0_6px_16px_rgba(0,0,0,0.08),inset_0_0_0_1px_var(--color-border)]">
                <span className="h-1.5 w-7 rounded-full bg-accent" />
                {["w-11", "w-9", "w-10"].map((w, i) => <span key={i} className={`h-1.5 ${w} rounded-full bg-surface-2`} />)}
              </span>
              <span className="absolute right-0 top-0 flex h-[80px] w-[66px] rotate-3 flex-col gap-1.5 rounded-lg bg-surface p-2 shadow-[0_6px_16px_rgba(0,0,0,0.1),inset_0_0_0_1px_var(--color-border)]">
                <span className="h-5 w-full rounded bg-accent-gradient" />
                {["w-12", "w-8", "w-11"].map((w, i) => <span key={i} className={`h-1.5 ${w} rounded-full bg-surface-2`} />)}
              </span>
            </span>
            <span className="flex flex-wrap justify-center gap-1.5">
              {["PDF", "Excel", "CSV", "OFX"].map((f) => (
                <span key={f} className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-medium text-ink-muted">
                  {f}
                </span>
              ))}
            </span>
            <span className="text-sm font-medium text-ink-muted">Eu descubro qual é.</span>
            <input
              type="file"
              className="sr-only"
              accept={ACEITA_ARQUIVO_DE_EXTRATO}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onArquivo(f);
                e.target.value = "";
              }}
            />
          </label>
          <Recado icone={<ShieldCheck size={16} />}>Eu não entro na sua conta. Você baixa o arquivo e manda aqui.</Recado>
        </>
      )}
      <Pe>
        {travou && <NaoConsegui onDigitar={onDigitar} />}
        <EscolherArquivo onArquivo={onArquivo} />
        {banco ? (
          <LinkDiscreto onClick={() => onAjuda("pediu")}>Trocar o banco</LinkDiscreto>
        ) : (
          <LinkDiscreto onClick={() => onAjuda("pediu")} data-como-baixar>
            <CircleHelp size={15} className="mr-1.5" aria-hidden />
            Como baixar do meu banco?
          </LinkDiscreto>
        )}
        {/* Sem banco, "Não consegui baixar" abre a ajuda por banco; com banco, o plano B. */}
        {!travou && <LinkDiscreto onClick={() => (banco ? setTravou(true) : onAjuda("travou"))}>Não consegui baixar</LinkDiscreto>}
      </Pe>
    </>
  );
}

/** O passo a passo de um banco: as 3 telinhas, extrato ou fatura, o formato e a nota (senha, e-mail). */
function PassoAPassoDoBanco({ banco }: { banco: BancoDoComeco }) {
  const outro = banco.chave === "outro";
  const cor = (banco.marca && marcaDaDescricao(banco.marca)?.cor) || "var(--color-accent)";
  // O caminho certo de cada banco (lib/onboarding/bancos.ts): o oficial, ou o genérico sem fonte.
  const fatura = outro ? null : caminhoDaFatura(banco.chave);
  const [qual, setQual] = useState<"extrato" | "fatura">("extrato");
  const caminho = qual === "fatura" && fatura ? fatura : outro ? CAMINHO_GENERICO : caminhoDoExtrato(banco.chave);
  return (
    <>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <LogoDoBanco banco={banco} />
        <h2 className="titulo-tema text-[clamp(1.35rem,6.4vw,1.6rem)] font-normal leading-tight text-ink">
          No app {banco.artigo} {banco.nome} <b className="font-semibold">são 3 toques.</b>
        </h2>
      </div>
      {fatura && (
        <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="O que baixar">
          {(["extrato", "fatura"] as const).map((q) => (
            <button
              key={q}
              type="button"
              role="tab"
              aria-selected={qual === q}
              onClick={() => setQual(q)}
              className={`min-h-10 rounded-full text-sm font-semibold ${qual === q ? "bg-surface text-ink shadow-premium-sm" : "text-ink-muted"}`}
            >
              {q === "extrato" ? "Extrato da conta" : "Fatura do cartão"}
            </button>
          ))}
        </div>
      )}
      <ol className="grid grid-cols-3 gap-2">
        {caminho.passos.map(([t, s], i) => (
          <li key={t + i} className="flex min-w-0 flex-col items-center gap-1 text-center">
            {/* A telinha: um desenho do app do banco com o toque marcado (nunca um print). */}
            <span className="glass relative flex aspect-[3/4] w-full max-w-[92px] flex-col gap-[7px] overflow-hidden rounded-[14px] pb-2.5" aria-hidden>
              <span className="h-[20%]" style={{ background: cor }} />
              <span className="mx-2.5 h-1.5 rounded-full bg-border-strong" />
              <span className="mx-2.5 h-1.5 w-[45%] rounded-full bg-border-strong" />
              <span className="mx-2.5 h-1.5 rounded-full bg-border-strong" />
              <span className="mx-2.5 h-1.5 w-[45%] rounded-full bg-border-strong" />
              <span className="absolute inset-x-2 h-[18px] rounded-[9px]" style={{ top: `${[22, 46, 70][i]}%`, boxShadow: `inset 0 0 0 2px ${cor}`, background: `color-mix(in srgb, ${cor} 14%, transparent)` }} />
            </span>
            <span className="mt-1 flex size-6 items-center justify-center rounded-full bg-ink text-[12.5px] font-bold text-canvas">{i + 1}</span>
            <b className="w-full text-[13.5px] font-semibold leading-tight [overflow-wrap:anywhere]">{t}</b>
            <small className="text-[12px] font-medium leading-tight text-ink-muted">{s}</small>
          </li>
        ))}
      </ol>
      {!outro && (
        <div className="flex flex-wrap items-center gap-2">
          {caminho.formatos && <Selo>Sai em {caminho.formatos}</Selo>}
          <Selo forte>
            <Check size={13} aria-hidden />
            Leio melhor em {leMelhor(banco.chave)}
          </Selo>
        </div>
      )}
      <Nota>{caminho.nota ?? "Salve o arquivo no celular e volte aqui."}</Nota>
      {outro && <QualBancoFalta />}
    </>
  );
}

/**
 * "Meu banco não está aqui": um campo para ela dizer qual é. Vira só um evento de uso com o nome
 * limpo (sem número, sem nada dela), para sabermos quais bancos faltam na lista.
 */
function QualBancoFalta() {
  const [nome, setNome] = useState("");
  const [avisou, setAvisou] = useState(false);
  const limpo = bancoQueFalta(nome);
  if (avisou) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
        <Check size={15} aria-hidden />
        Anotado. Obrigado por avisar.
      </p>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!limpo) return;
        registrar(EVENTOS_DO_COMECO.faltaBanco, limpo);
        setAvisou(true);
      }}
    >
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={40}
        placeholder="Qual é o seu banco?"
        aria-label="Qual é o seu banco? Assim a gente coloca na lista"
        autoComplete="off"
        className="h-11 min-w-0 flex-1 rounded-full border border-border-strong bg-surface px-4 text-[15px] text-ink outline-none placeholder:text-ink-muted focus:border-accent"
      />
      <button type="submit" disabled={!limpo} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold text-ink shadow-[inset_0_0_0_1.5px_var(--color-border-strong)] disabled:opacity-40">
        Avisar
      </button>
    </form>
  );
}

/**
 * "Lendo": os quadros da lógica do extrato enquanto o arquivo é lido. Lido, o resumo ("Separei 38.
 * Só 3 precisam de você agora.") e UM botão. As perguntas são as da importação de verdade, no
 * máximo 3; a última resposta já grava e ela vai para o mês.
 */
function Lendo({ money, onTerminar, onOutroArquivo, onAjuda }: { money: Money; onTerminar: (mes: string | null, revisou: boolean) => void; onOutroArquivo: () => void; onAjuda: () => void }) {
  const [estado, setEstado] = useState<EstadoParaOComeco | null>(null);
  const [quadro, setQuadro] = useState(0);
  const [revisando, setRevisando] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const aoMudar = useCallback((e: EstadoParaOComeco) => setEstado(e), []);
  const aoImportar = useCallback(
    (r: { mes: { year: number; month: number } | null; revisou: boolean; criados: number }) => {
      setTerminou(true);
      onTerminar(r.mes ? `${r.mes.year}-${String(r.mes.month).padStart(2, "0")}` : null, r.revisou);
    },
    [onTerminar],
  );

  const lido = !!estado && !estado.lendo && (estado.fase !== "upload" || estado.linhas > 0);

  // Os quadros andam sozinhos enquanto ela espera (sem animação para quem pediu menos movimento).
  useEffect(() => {
    if (lido || revisando || quadro >= 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setQuadro((q) => Math.min(2, q + 1)), 2600);
    return () => clearTimeout(t);
  }, [quadro, revisando, lido]);

  // Arquivo que não deu (senha, tipo errado, erro de leitura): a tela da importação aparece e explica.
  const precisaDaImportacao = revisando || (!!estado && !estado.lendo && (estado.fase === "password" || (estado.fase === "upload" && estado.erro)));
  const agora = estado?.pendentes ?? 0;
  const depois = Math.max(0, (estado?.pendentesTotal ?? 0) - agora);
  const separados = estado ? Math.max(0, estado.linhas - (estado.pendentesTotal ?? 0)) : 0;
  // Respondeu a última (ou não tinha pergunta): a importação grava sozinha. Sem erro, a tela não
  // pisca a confirmação da importação: fica o "Montando o seu mês".
  const gravando = revisando && !!estado && estado.fase !== "review" && !estado.erro;
  const falhou = !revisando && !!estado && !estado.lendo && estado.fase === "upload" && !!estado.erro;

  return (
    <>
      {!precisaDaImportacao && !terminou && (
        <>
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink-muted" aria-live="polite">
            <FileText size={16} aria-hidden />
            <span className="min-w-0 flex-1">{lido ? "Extrato lido" : "Lendo o seu extrato"}</span>
            {lido && estado ? (
              <b className="text-[12.5px] font-semibold text-success">
                {estado.linhas} de {estado.linhas}
              </b>
            ) : (
              <b className="text-[12px] font-semibold text-success">lendo</b>
            )}
          </p>
          {lido && estado ? (
            <div className="passo-entra flex flex-col gap-3" data-resumo-da-leitura>
              <Titulo sub={agora > 0 ? `Só ${agora} ${agora === 1 ? "precisa" : "precisam"} de você agora.` : "Está tudo no lugar."}>{separados > 0 ? `Separei ${separados}.` : "Li tudo."}</Titulo>
              {depois > 0 && <Nota>Os outros {depois} ficam para quando quiser.</Nota>}
              {estado.amostra.length > 0 && (
                <div className="glass flex flex-col rounded-2xl px-3.5 py-1.5">
                  {estado.amostra.slice(0, 3).map((a, i) => (
                    <LinhaDoExtrato key={i} descricao={a.descricao} logo={a.original} categoria={a.categoria} valor={money(a.valor)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="min-h-[360px]">
                <Quadro indice={quadro} estado={estado} money={money} />
              </div>
              <div className="flex justify-center gap-1" role="tablist" aria-label="Como eu leio o extrato">
                {[0, 1, 2].map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={k === quadro} aria-label={`Quadro ${k + 1}`} onClick={() => setQuadro(k)} className="flex size-11 items-center justify-center">
                    <i className={`h-2 rounded-full transition-all ${k === quadro ? "w-6 bg-ink" : "w-2 bg-border-strong"}`} />
                  </button>
                ))}
              </div>
            </>
          )}
          <Pe>
            <BotaoPrincipal onClick={() => setRevisando(true)} disabled={!lido} data-responder-do-comeco>
              {!lido ? "Lendo..." : agora > 0 ? `Responder ${agora}` : "Ver o meu mês"}
            </BotaoPrincipal>
          </Pe>
        </>
      )}
      {/* O arquivo não deu certo: aí sim, a ajuda por banco, antes da explicação da importação. */}
      {falhou && !terminou && (
        <button type="button" onClick={onAjuda} className="glass flex min-h-[64px] items-center gap-3 rounded-[20px] px-4 py-3 text-left" data-ajuda-depois-do-erro>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
            <CircleHelp size={19} strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-[15px] font-semibold">Como baixar do meu banco?</b>
            <small className="text-[13px] font-medium text-ink-muted">Mostro o caminho, banco por banco</small>
          </span>
          <ArrowRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
        </button>
      )}
      {/* A importação de verdade (a mesma do +): lê o arquivo, faz as perguntas uma por vez e grava. */}
      <div className={precisaDaImportacao && !terminou && !gravando ? "" : "hidden"}>
        <StatementImport onDone={onOutroArquivo} comeco={{ aoMudar, aoImportar, visivel: precisaDaImportacao && !terminou && !gravando, maxPerguntas: MAX_PERGUNTAS_DO_COMECO, responder: revisando }} />
      </div>
      {(terminou || gravando) && (
        <p className="mt-[20vh] text-center text-[17px] font-medium text-ink-muted" role="status">
          Montando o seu mês...
        </p>
      )}
    </>
  );
}

function Quadro({ indice, estado, money }: { indice: number; estado: EstadoParaOComeco | null; money: Money }) {
  if (indice === 0) {
    const amostra = estado?.amostra ?? [];
    const separados = estado ? Math.max(0, estado.linhas - estado.pendentes) : 0;
    return (
      <div className="passo-entra flex flex-col gap-3">
        <Titulo sub="separo sozinho">Eu leio e</Titulo>
        {estado && estado.linhas > 0 && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-soft px-3 py-1.5 text-[13.5px] font-semibold text-success">
            <Check size={14} aria-hidden />
            {separados} de {estado.linhas} já separados
          </span>
        )}
        <div className="glass flex flex-col rounded-2xl px-3.5 py-1.5">
          {amostra.length > 0
            ? amostra.map((a, i) => <LinhaDoExtrato key={i} descricao={a.descricao} logo={a.original} categoria={a.categoria} valor={money(a.valor)} />)
            : [0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0" aria-hidden>
                  <span className="esqueleto size-10 rounded-xl" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className="esqueleto h-3 w-2/5 rounded-full" />
                    <span className="esqueleto h-2.5 w-1/4 rounded-full" />
                  </span>
                </div>
              ))}
        </div>
      </div>
    );
  }
  if (indice === 1) {
    const p = estado?.primeiraPendente;
    return (
      <div className="passo-entra flex flex-col gap-3">
        <Titulo sub="o que não sei">Só pergunto</Titulo>
        <div className="glass flex flex-col gap-2 rounded-2xl p-4">
          <span className="self-start text-[12px] font-bold uppercase tracking-[0.06em] text-danger">Precisa de você</span>
          {p ? (
            <LinhaDoExtrato descricao={p.descricao} logo={p.original} categoria={null} valor={money(p.valor)} sub={dataCurta(p.data)} />
          ) : (
            <LinhaDoExtrato descricao="Pix para Maria Souza" categoria={null} valor={money(80)} sub="exemplo" />
          )}
          <p className="text-[14.5px] font-semibold">O que foi isso?</p>
          <div className="flex flex-wrap gap-2" aria-hidden>
            <Selo forte>Moradia</Selo>
            <Selo>Compras</Selo>
            <Selo>Outra</Selo>
          </div>
        </div>
        <p className="flex items-start gap-2 text-sm font-medium leading-snug">
          <Check size={14} className="mt-1 shrink-0 text-success" aria-hidden />
          <span>
            <b className="font-semibold">Aprendi.</b> Na próxima, a mesma pessoa já vai direto para a categoria que você escolheu.
          </span>
        </p>
      </div>
    );
  }
  return (
    <div className="passo-entra flex flex-col gap-3">
      <Titulo sub="não é gasto">Pix para outra conta sua</Titulo>
      <div className="glass flex items-center justify-between rounded-2xl px-[18px] py-4">
        <LogoDoLancamento descricao="Nubank" icon={Building2} size={44} />
        <span className="flex flex-col items-center gap-0.5 text-ink-muted">
          <small className="text-[12px] font-semibold uppercase tracking-wide">exemplo</small>
          <ArrowRight size={18} aria-hidden />
        </span>
        <LogoDoLancamento descricao="Banco Inter" icon={Building2} size={44} />
      </div>
      <p className="text-[15px] font-semibold">Isso é gasto ou dinheiro seu mudando de lugar?</p>
      <div className="flex flex-wrap gap-2" aria-hidden>
        <Selo forte>Só mudei de conta</Selo>
        <Selo>Foi gasto</Selo>
      </div>
      <Nota>Dinheiro que só mudou de conta não entra no seu gasto do mês.</Nota>
    </div>
  );
}

function dataCurta(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${Number(m[2])} de ${meses[Number(m[1]) - 1]}`;
}

function LinhaDoExtrato({ descricao, logo, categoria, valor, sub }: { descricao: string; logo?: string; categoria: ParentCategory | null; valor: string; sub?: string }) {
  const { categorias } = useProfileTheme();
  const Icone = categoria ? categoryIcon(categorias, categoria) : Wallet;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-2.5 first:border-t-0">
      <LogoDoLancamento descricao={logo ?? descricao} icon={Icone} size={40} />
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px] font-semibold">{descricao}</b>
        <small className="text-[12.5px] font-medium text-ink-muted">{sub ?? (categoria ? categoryLabel(categorias, categoria) : "")}</small>
      </span>
      <em className="whitespace-nowrap text-[15px] font-medium not-italic tabular-nums">{valor}</em>
    </div>
  );
}

/** "R$ 45" quando o valor é redondo, "R$ 12,50" quando tem centavo. */
function valorCurto(money: Money, v: number): string {
  return money(v, { round: Number.isInteger(v) });
}

function Digitar({ money, onLancado, onFalar }: { money: Money; onLancado: (linha: string) => void; onFalar: () => void }) {
  const { categorias } = useProfileTheme();
  const [digitos, setDigitos] = useState("");
  const [atalho, setAtalho] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();
  const valor = centavosParaReais(digitos);
  const a = ATALHOS_DO_GASTO[atalho];
  const rotulo = categoryLabel(categorias, a.categoria);
  const lancar = () =>
    startSalvar(async () => {
      setErro(null);
      const r = await primeiroGastoAction({ valor, descricao: rotulo, parentCategory: a.categoria, como: "digitado" });
      if (!r.ok) return setErro(r.erro);
      trackEvent("registro_digitado", "/comecar/digitar");
      onLancado(`${valorCurto(money, valor)} em ${rotulo}, hoje`);
    });
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "apagar"];
  return (
    <>
      <Titulo centro>Um gasto de hoje</Titulo>
      {/* Começa no zero, sem exemplo: nada aqui pode parecer um gasto já lançado. */}
      <div className="flex justify-center" aria-live="polite">
        <ValorDestaque texto={money(valor)} className={`text-[clamp(2.4rem,12vw,2.75rem)] font-light leading-none tracking-[-0.02em] tabular-nums ${digitos ? "" : "text-ink-muted"}`} />
      </div>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Categoria">
        {ATALHOS_DO_GASTO.map((x, i) => {
          const Icone = categoryIcon(categorias, x.categoria);
          return (
            <Pilula key={x.categoria} ativa={atalho === i} onClick={() => setAtalho(i)}>
              <Icone size={16} strokeWidth={1.9} aria-hidden />
              {categoryLabel(categorias, x.categoria)}
            </Pilula>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {teclas.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setDigitos((s) => teclarValor(s, k))}
            aria-label={k === "apagar" ? "Apagar" : k}
            className="flex min-h-[52px] items-center justify-center rounded-2xl bg-surface-2 text-xl font-medium text-ink active:bg-surface-hover"
          >
            {k === "apagar" ? <Delete size={22} aria-hidden /> : k}
          </button>
        ))}
      </div>
      {erro && <p className="text-center text-sm text-danger">{erro}</p>}
      <Pe>
        <BotaoPrincipal onClick={lancar} disabled={valor <= 0 || salvando}>
          {salvando ? "Lançando..." : "Lançar"}
        </BotaoPrincipal>
        <LinkDiscreto onClick={onFalar}>
          <Mic size={16} className="mr-1.5" aria-hidden />
          Prefiro falar
        </LinkDiscreto>
      </Pe>
    </>
  );
}

function Falar({ money, onLancado, onDigitar }: { money: Money; onLancado: (linha: string) => void; onDigitar: () => void }) {
  const { categorias } = useProfileTheme();
  const [entendi, setEntendiCru] = useState<ParsedVoiceEntry | null>(null);
  // A categoria que o motor sugeriu já vem marcada; ela troca tocando em outra.
  const [mae, setMae] = useState<ParentCategory | null>(null);
  const setEntendi = (e: ParsedVoiceEntry | null) => {
    setEntendiCru(e);
    setMae(e?.category === "EXPENSE" ? e.parentCategory : null);
  };
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();
  const confirmar = () =>
    startSalvar(async () => {
      if (!entendi?.amount) return;
      setErro(null);
      const r = await primeiroGastoAction({
        valor: entendi.amount,
        descricao: entendi.description || "Gasto",
        categoria: entendi.category,
        parentCategory: mae,
        sub: mae && mae === entendi.parentCategory ? entendi.subcategory : null,
        como: "falado",
      });
      if (!r.ok) return setErro(r.erro);
      trackEvent("registro_voz", "/comecar/falar");
      const onde = mae ? categoryLabel(categorias, mae) : entendi.description || "Outros";
      onLancado(`${valorCurto(money, entendi.amount)} em ${onde}, hoje`);
    });
  const iconeDaFala = mae ? categoryIcon(categorias, mae) : Wallet;
  return (
    <>
      <Titulo centro>Segure e fale</Titulo>
      <Nota centro>Do jeito que sai</Nota>
      <p className="text-center text-[17px] font-medium">&quot;Gastei 45 no mercado&quot;</p>
      {entendi ? (
        <>
          <Nota centro>Entendi assim:</Nota>
          <div className="glass grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3.5 py-2.5">
            <LogoDoLancamento descricao={entendi.description} icon={iconeDaFala} size={40} />
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[15px] font-semibold">{entendi.description || "Gasto"}</b>
              <small className="text-[12.5px] font-medium text-ink-muted">{mae ? `${categoryLabel(categorias, mae)} · Hoje` : "Hoje"}</small>
            </span>
            <em className="whitespace-nowrap text-[15px] font-medium not-italic tabular-nums">{entendi.amount ? money(entendi.amount) : "sem valor"}</em>
          </div>
          {entendi.category === "EXPENSE" && (
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Categoria">
              {PARENT_CATEGORIES.filter((pc) => !categoriaOculta(categorias, pc)).map((pc) => (
                <Pilula key={pc} ativa={mae === pc} onClick={() => setMae(pc)}>
                  {categoryLabel(categorias, pc)}
                </Pilula>
              ))}
            </div>
          )}
          {!entendi.amount && <Nota centro>Não ouvi o valor. Fale de novo com o número, ou digite.</Nota>}
          {erro && <p className="text-center text-sm text-danger">{erro}</p>}
          <Pe>
            <BotaoPrincipal onClick={confirmar} disabled={!entendi.amount || salvando}>
              {salvando ? "Lançando..." : "Lançar"}
            </BotaoPrincipal>
            <LinkDiscreto onClick={() => setEntendi(null)}>Falar de novo</LinkDiscreto>
          </Pe>
        </>
      ) : (
        <>
          {/* O gravador de verdade do app (o mesmo do +), com os avisos de cada celular. */}
          <VoiceRecorder onParsed={setEntendi} />
          <Pe>
            <LinkDiscreto onClick={onDigitar}>Prefiro digitar</LinkDiscreto>
          </Pe>
        </>
      )}
    </>
  );
}

/** A confirmação que não deixa dúvida: o check, "Lançado." e o que entrou. */
function Confirmacao({ titulo, linha, onSeguir }: { titulo: string; linha: string; onSeguir: () => void }) {
  return (
    <>
      <div className="mt-[12vh] flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <span className="flex size-[84px] items-center justify-center rounded-full bg-success text-canvas shadow-premium-sm" aria-hidden>
          <Check size={42} strokeWidth={2.6} />
        </span>
        <Titulo centro>{titulo}</Titulo>
        <p className="text-lg font-medium text-ink">{linha}</p>
      </div>
      <Pe>
        <BotaoPrincipal onClick={onSeguir}>Ver a Visão geral</BotaoPrincipal>
      </Pe>
    </>
  );
}
