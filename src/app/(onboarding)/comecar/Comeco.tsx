"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronLeft,
  Clock,
  Compass,
  Delete,
  FileText,
  KeyRound,
  Keyboard,
  LayoutList,
  Mail,
  Mic,
  PlayCircle,
  Plus,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
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
import { categoryIcon, categoryLabel } from "@/lib/categories";
import { profileTheme, profileThemeCss } from "@/lib/profiles/themes";
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from "@/lib/money";
import {
  ATALHOS_DO_GASTO,
  BANCOS_DO_COMECO,
  BANCO_OUTRO,
  OPCOES_QUER,
  RENDA_INICIAL,
  RENDA_MAX,
  RENDA_MIN,
  RENDA_PASSO,
  TEMAS_DO_COMECO,
  apelidoLimpo,
  bancoDoComeco,
  mesDoTexto,
  cssDosCartoesDosTemas,
  barraDoPasso,
  caminhoDoEvento,
  centavosParaReais,
  EVENTOS_DO_COMECO,
  faseDoPasso,
  notaDoBanco,
  passoAnterior,
  teclarValor,
  type BancoDoComeco,
  type Comeco as DadosDoComeco,
  type EventoDoComeco,
  type PassoDoComeco,
  type Quer,
} from "@/lib/onboarding/comeco";
import { primeiroGastoAction, pularComecoAction, salvarComecoAction, terminarComExtratoAction } from "./actions";
import { BotaoPrincipal, Bolinha, LinkDiscreto, Nota, Pe, Pilula, Recado, Selo, Titulo } from "./pecas";

type TemaDoComeco = (typeof TEMAS_DO_COMECO)[number]["chave"];

/** E-mail do "Fale com a gente" (pendência 5.1.13: a recomendação é o e-mail do app). */
export const EMAIL_FALE_COM_A_GENTE = "app@danicolombo.com.br";

const VIDEO_PRIMEIRO_MES = { src: "/videos/como-funciona-1-primeiro-mes-leve.mp4", poster: "/videos/como-funciona-1-primeiro-mes-poster.jpg", titulo: "Seu primeiro mês em 3 minutos" };

const ICONE_DO_QUER: Record<(typeof OPCOES_QUER)[number]["icone"], typeof LayoutList> = { lista: LayoutList, desce: TrendingDown, alvo: Target, sobe: TrendingUp };

function registrar(evento: EventoDoComeco, detalhe?: string | null) {
  trackEvent(evento, caminhoDoEvento(evento, detalhe));
}

/**
 * O começo de quem acabou de entrar (versão nova). Uma coisa por tela, com "Pular" no topo de
 * todas: boas-vindas, quatro perguntas e o primeiro lançamento (extrato, digitar ou falar). Termina
 * na Visão geral com o mês dela na tela.
 */
export function Comeco({
  inicial,
  passoInicial,
  bancoInicial,
  nomeDaConta,
  temaAtual,
  moedaAtual,
  mesAtual,
}: {
  inicial: DadosDoComeco | null;
  passoInicial: PassoDoComeco;
  /** Vindo dos Primeiros passos: o banco que ficou para depois. */
  bancoInicial?: string | null;
  nomeDaConta: string | null;
  temaAtual: TemaDoComeco;
  moedaAtual: CurrencyCode;
  /** "outubro": o mês de agora, no fuso do Brasil. */
  mesAtual: string;
}) {
  const router = useRouter();
  const money = useMoney();
  const [passo, setPasso] = useState<PassoDoComeco>(passoInicial);
  const [direcao, setDirecao] = useState<1 | -1 | 0>(0);
  const [apelido, setApelido] = useState(inicial?.apelido ?? nomeDaConta ?? "");
  const [renda, setRenda] = useState(inicial?.renda ?? RENDA_INICIAL);
  const [quer, setQuer] = useState<Quer | null>(inicial?.quer ?? null);
  const [tema, setTema] = useState<TemaDoComeco>(temaAtual);
  const [moeda, setMoeda] = useState<CurrencyCode>(moedaAtual);
  const [verMoedas, setVerMoedas] = useState(moedaAtual !== "BRL");
  const [banco, setBanco] = useState<string | null>(bancoInicial ?? inicial?.banco ?? null);
  // Vários bancos (pedido da dona): o passo a passo segue um por vez, na ordem em que ela marcou.
  const [bancos, setBancos] = useState<string[]>(inicial?.bancos ?? []);
  const [feitos, setFeitos] = useState<string[]>(inicial?.bancosFeitos ?? []);
  const [soEste, setSoEste] = useState(false);
  // A confirmação inequívoca de que lançou ("Lançado." / "Pronto."), antes da Visão geral.
  const [pronto, setPronto] = useState<{ titulo: string; linha: string; proximo: string | null } | null>(null);
  const [saindo, startSaida] = useTransition();
  const corpoRef = useRef<HTMLDivElement>(null);

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

  const pular = useCallback(() => {
    registrar(EVENTOS_DO_COMECO.pulou, passo);
    startSaida(async () => {
      await pularComecoAction(passo).catch(() => {});
      router.replace("/mensal/foco");
    });
  }, [passo, router]);

  const anterior = passoAnterior(passo);
  const barra = barraDoPasso(passo);
  const nome = apelidoLimpo(apelido) ?? "você";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas text-ink">
      {/* O tema escolhido na pergunta já pinta o começo inteiro (prévia ao vivo). */}
      {tema !== temaAtual && <style dangerouslySetInnerHTML={{ __html: profileThemeCss(tema) }} />}

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
        <div className="mx-auto mt-1 flex max-w-md justify-center" aria-hidden>
          {barra.tipo === "pontos" ? (
            <span className="flex gap-1.5">
              {Array.from({ length: barra.total }, (_, i) => (
                <i key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === barra.atual ? "w-[22px] bg-ink" : "w-1.5 bg-border-strong"}`} />
              ))}
            </span>
          ) : (
            <span className="grid w-full auto-cols-fr grid-flow-col gap-1.5">
              {Array.from({ length: barra.total }, (_, i) => (
                <i key={i} className={`h-1 rounded-full transition-colors ${i <= barra.atual ? "bg-accent" : "bg-border-strong"}`} />
              ))}
            </span>
          )}
        </div>
      </header>

      <main ref={corpoRef} key={passo} className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pb-[calc(var(--safe-bottom,0px)+20px)] pt-2 ${direcao !== 0 ? "passo-entra" : ""}`}>
        {passo === "b1" && <BoasVindas1 onSeguir={() => ir("b2")} money={money} />}
        {passo === "b2" && <BoasVindas2 onSeguir={() => ir("b3")} />}
        {passo === "b3" && <BoasVindas3 onSeguir={() => ir("nome")} />}

        {passo === "nome" && (
          <PerguntaNome
            apelido={apelido}
            setApelido={setApelido}
            onSeguir={() => {
              registrar(EVENTOS_DO_COMECO.pergunta, "nome");
              ir("renda", 1, { apelido });
            }}
          />
        )}
        {passo === "renda" && (
          <PerguntaRenda
            renda={renda}
            setRenda={setRenda}
            moeda={moeda}
            setMoeda={setMoeda}
            verMoedas={verMoedas}
            setVerMoedas={setVerMoedas}
            money={money}
            onSeguir={(semRenda) => {
              registrar(EVENTOS_DO_COMECO.pergunta, semRenda ? "renda-nao" : "renda");
              ir("quer", 1, semRenda ? { semRenda: true, renda: null, moeda } : { semRenda: false, renda, moeda });
            }}
          />
        )}
        {passo === "quer" && (
          <PerguntaQuer
            quer={quer}
            setQuer={setQuer}
            onSeguir={() => {
              registrar(EVENTOS_DO_COMECO.pergunta, "quer");
              ir("tema", 1, { quer: quer ?? undefined });
            }}
          />
        )}
        {passo === "tema" && (
          <PerguntaTema
            tema={tema}
            setTema={setTema}
            onSeguir={() => {
              registrar(EVENTOS_DO_COMECO.pergunta, "tema");
              ir("porta", 1, { tema });
            }}
          />
        )}

        {pronto && (
          <Confirmacao
            {...pronto}
            onSeguir={() => {
              if (pronto.proximo) {
                setBanco(pronto.proximo);
                setPronto(null);
                ir("tutorial", 1, { banco: pronto.proximo });
              } else router.replace("/mensal/foco");
            }}
            onParar={() => router.replace("/mensal/foco")}
          />
        )}
        {!pronto && passo === "porta" && (
          <Porta
            nome={nome}
            mes={mesAtual}
            onEscolher={(p) => {
              registrar(EVENTOS_DO_COMECO.porta, p);
              ir(p === "extrato" ? "banco" : "digitar", 1, { porta: p });
            }}
          />
        )}
        {!pronto && passo === "banco" && (
          <EscolhaDoBanco
            marcados={bancos}
            onSeguir={(lista) => {
              lista.forEach((b) => registrar(EVENTOS_DO_COMECO.banco, b));
              setBancos(lista);
              setBanco(lista[0]);
              ir("tutorial", 1, { bancos: lista, banco: lista[0] });
            }}
          />
        )}
        {!pronto && (passo === "tutorial" || passo === "volta") && (
          <Tutorial
            banco={bancoDoComeco(banco) ?? BANCO_OUTRO}
            volta={passo === "volta"}
            nome={nome}
            posicao={bancos.length > 1 && banco ? { atual: bancos.indexOf(banco) + 1, total: bancos.length } : null}
            soEste={soEste}
            onSoEste={() => setSoEste((v) => !v)}
            onArquivo={(arquivo) => {
              registrar(EVENTOS_DO_COMECO.enviou, banco ?? "outro");
              importarArquivoNoMes(arquivo);
              ir("lendo");
            }}
            onDigitar={() => ir("digitar")}
          />
        )}
        {!pronto && passo === "lendo" && (
          <Lendo
            key={banco ?? "outro"}
            money={money}
            onTerminar={(mes, revisou, criados) => {
              registrar(EVENTOS_DO_COMECO.revisou, revisou ? "com-revisao" : "sem-revisao");
              const agora = banco && !feitos.includes(banco) ? [...feitos, banco] : feitos;
              setFeitos(agora);
              const falta = bancos.filter((b) => !agora.includes(b));
              const nomeDoMes = mesDoTexto(mes)?.nome;
              startSaida(async () => {
                await terminarComExtratoAction({ mes, revisou, banco }).catch(() => {});
                setPronto({
                  titulo: "Pronto.",
                  linha: `${criados} ${criados === 1 ? "lançamento" : "lançamentos"}${nomeDoMes ? ` de ${nomeDoMes}` : ""}`,
                  proximo: soEste ? null : (falta[0] ?? null),
                });
              });
            }}
            onOutroArquivo={() => ir("tutorial", -1)}
          />
        )}
        {!pronto && passo === "digitar" && <Digitar money={money} onLancado={(linha) => setPronto({ titulo: "Lançado.", linha, proximo: null })} onFalar={() => ir("falar")} />}
        {!pronto && passo === "falar" && <Falar money={money} onLancado={(linha) => setPronto({ titulo: "Lançado.", linha, proximo: null })} onDigitar={() => ir("digitar", -1)} />}
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

function BoasVindas2({ onSeguir }: { onSeguir: () => void }) {
  const itens: [typeof LayoutList, string, string][] = [
    [LayoutList, "Organizo o seu mês", "Cada gasto no lugar certo"],
    [Wallet, "Digo quanto está livre", "Pra semana e pro mês"],
    [BarChart3, "Monto o seu plano", "Com a sua renda de verdade"],
    [Target, "Cuido das suas metas", "E aviso se atrasar"],
    [TrendingUp, "Acompanho seus investimentos", "E mostro o próximo aporte"],
  ];
  return (
    <>
      <Titulo sub="por você">O que eu faço</Titulo>
      <div className="flex flex-col gap-1.5">
        {itens.map(([Icone, t, s]) => (
          <div key={t} className="glass flex items-center gap-3 rounded-[20px] px-3.5 py-2.5">
            <Bolinha>
              <Icone size={19} strokeWidth={1.8} />
            </Bolinha>
            <span className="flex min-w-0 flex-col">
              <b className="text-[15px] font-semibold">{t}</b>
              <small className="text-[13px] font-medium text-ink-muted">{s}</small>
            </span>
          </div>
        ))}
      </div>
      {/* O "te diz o que fazer": o cartão invertido (tinta no fundo), como no protótipo. */}
      <div className="flex items-start gap-3 rounded-[20px] bg-ink px-4 py-3.5 text-canvas">
        <Compass size={20} className="mt-0.5 shrink-0" aria-hidden />
        <span className="text-[14.5px] font-medium leading-snug">
          <small className="block text-[12px] font-bold uppercase tracking-[0.08em] opacity-75">Hoje</small>
          Segura o delivery até sexta. Assim a viagem continua no prazo.
        </span>
      </div>
      <Pe>
        <BotaoPrincipal onClick={onSeguir}>Continuar</BotaoPrincipal>
      </Pe>
    </>
  );
}

function BoasVindas3({ onSeguir }: { onSeguir: () => void }) {
  const [video, setVideo] = useState(false);
  return (
    <>
      <Titulo sub="Eu faço o resto.">Você traz o extrato.</Titulo>
      <HeroiDoTema className="!p-4">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-1 text-center">
          <Passinho icone={<Building2 size={20} strokeWidth={1.8} />} texto="No app do seu banco" />
          <ArrowRight size={16} className="mt-3 text-heroi-suave" aria-hidden />
          <Passinho icone={<FileText size={20} strokeWidth={1.8} />} texto="Baixa o extrato" />
          <ArrowRight size={16} className="mt-3 text-heroi-suave" aria-hidden />
          <Passinho icone={<LayoutList size={20} strokeWidth={1.8} />} texto="Eu separo tudo" />
        </div>
      </HeroiDoTema>
      <div className="flex flex-wrap gap-2">
        <Selo forte>
          <Clock size={14} aria-hidden />1 minuto
        </Selo>
        <Selo forte>
          <ShieldCheck size={14} aria-hidden />
          Sem senha do banco
        </Selo>
        <Selo forte>
          <FileText size={14} aria-hidden />
          PDF, Excel ou OFX
        </Selo>
      </div>
      <Recado>
        <b className="font-semibold">Eu não entro na sua conta do banco.</b> Você baixa o extrato e manda aqui. Digitar e falar também valem.
      </Recado>
      {video ? (
        <figure className="glass overflow-hidden rounded-2xl">
          <video className="aspect-[9/16] max-h-[60vh] w-full bg-surface-2 object-contain" src={VIDEO_PRIMEIRO_MES.src} poster={VIDEO_PRIMEIRO_MES.poster} controls playsInline preload="none" autoPlay />
          <figcaption className="px-3.5 py-2.5 text-sm font-semibold">{VIDEO_PRIMEIRO_MES.titulo}</figcaption>
        </figure>
      ) : null}
      <Pe>
        <BotaoPrincipal onClick={onSeguir}>Combinado</BotaoPrincipal>
        {!video && (
          <LinkDiscreto onClick={() => setVideo(true)}>
            <PlayCircle size={16} className="mr-1.5" aria-hidden />
            Ver como funciona
          </LinkDiscreto>
        )}
      </Pe>
    </>
  );
}

function Passinho({ icone, texto }: { icone: React.ReactNode; texto: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className="heroi-veu flex size-10 items-center justify-center rounded-full">{icone}</span>
      <small className="text-[12.5px] font-semibold leading-tight">{texto}</small>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// As quatro perguntas
// ---------------------------------------------------------------------------------------------

function PerguntaNome({ apelido, setApelido, onSeguir }: { apelido: string; setApelido: (v: string) => void; onSeguir: () => void }) {
  const limpo = apelidoLimpo(apelido);
  return (
    <>
      <Titulo sub="te chamar?">Como posso</Titulo>
      <input
        className="h-14 w-full rounded-2xl border border-border-strong bg-surface px-4 text-xl text-ink outline-none focus:border-accent"
        value={apelido}
        onChange={(e) => setApelido(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && limpo) onSeguir();
        }}
        maxLength={24}
        autoComplete="given-name"
        aria-label="Seu nome ou apelido"
        autoFocus
      />
      <Nota>Prazer, {limpo ?? "você"}. É assim que eu vou falar com você.</Nota>
      <Pe>
        <BotaoPrincipal onClick={onSeguir} disabled={!limpo}>
          Continuar
        </BotaoPrincipal>
      </Pe>
    </>
  );
}

function PerguntaRenda({
  renda,
  setRenda,
  moeda,
  setMoeda,
  verMoedas,
  setVerMoedas,
  money,
  onSeguir,
}: {
  renda: number;
  setRenda: (v: number) => void;
  moeda: CurrencyCode;
  setMoeda: (m: CurrencyCode) => void;
  verMoedas: boolean;
  setVerMoedas: (v: boolean) => void;
  money: Money;
  onSeguir: (semRenda: boolean) => void;
}) {
  const simbolo = CURRENCIES[moeda].symbol;
  const texto = moeda === "BRL" ? money(renda, { round: true }) : `${simbolo} ${renda.toLocaleString("pt-BR")}`;
  const pct = ((renda - RENDA_MIN) / (RENDA_MAX - RENDA_MIN)) * 100;
  return (
    <>
      <Titulo sub="mais ou menos?">Quanto entra por mês,</Titulo>
      <div className="mt-2 flex flex-col items-center">
        <ValorDestaque texto={texto} className="text-[clamp(2.25rem,11vw,2.75rem)] font-light leading-none tracking-[-0.02em] tabular-nums" />
        {renda >= RENDA_MAX && <small className="mt-1 text-[13px] font-medium text-ink-muted">ou mais</small>}
      </div>
      <input
        type="range"
        className="slider-app w-full"
        min={RENDA_MIN}
        max={RENDA_MAX}
        step={RENDA_PASSO}
        value={renda}
        onChange={(e) => setRenda(Number(e.target.value))}
        aria-label="Quanto entra por mês"
        aria-valuetext={texto}
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
      />
      <div className="-mt-2 flex justify-between text-[12.5px] font-medium text-ink-muted">
        <span>{simbolo} 1 mil</span>
        <span>{simbolo} 20 mil ou mais</span>
      </div>
      <Recado icone={<KeyRound size={16} />}>Serve só para eu calcular o seu livre. Ninguém vê, e dá para mudar depois.</Recado>
      {verMoedas ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Moeda">
          {CURRENCY_CODES.map((c) => (
            <Pilula key={c} ativa={moeda === c} onClick={() => setMoeda(c)}>
              {CURRENCIES[c].symbol} {CURRENCIES[c].label}
            </Pilula>
          ))}
        </div>
      ) : null}
      <Pe>
        <BotaoPrincipal onClick={() => onSeguir(false)}>Continuar</BotaoPrincipal>
        <LinkDiscreto onClick={() => onSeguir(true)}>Prefiro não dizer agora</LinkDiscreto>
        {!verMoedas && <LinkDiscreto onClick={() => setVerMoedas(true)}>Moro fora do Brasil</LinkDiscreto>}
      </Pe>
    </>
  );
}

function PerguntaQuer({ quer, setQuer, onSeguir }: { quer: Quer | null; setQuer: (q: Quer) => void; onSeguir: () => void }) {
  return (
    <>
      <Titulo sub="quer agora?">O que você</Titulo>
      <div className="grid grid-cols-2 gap-2.5">
        {OPCOES_QUER.map((o) => {
          const Icone = ICONE_DO_QUER[o.icone];
          const on = quer === o.chave;
          return (
            <button
              key={o.chave}
              type="button"
              onClick={() => setQuer(o.chave)}
              aria-pressed={on}
              className={`glass flex min-h-[118px] flex-col items-start gap-3.5 rounded-[22px] p-3.5 text-left transition-colors ${on ? "!border-accent !bg-accent-soft shadow-[inset_0_0_0_1px_var(--color-accent)]" : ""}`}
            >
              <Bolinha>
                <Icone size={19} strokeWidth={1.8} />
              </Bolinha>
              <b className="text-[15px] font-semibold leading-tight">{o.titulo}</b>
            </button>
          );
        })}
      </div>
      <Nota>Isso muda o que eu te mostro primeiro.</Nota>
      <Pe>
        <BotaoPrincipal onClick={onSeguir} disabled={!quer}>
          Continuar
        </BotaoPrincipal>
      </Pe>
    </>
  );
}

const CSS_DOS_CARTOES = cssDosCartoesDosTemas();

function PerguntaTema({ tema, setTema, onSeguir }: { tema: TemaDoComeco; setTema: (t: TemaDoComeco) => void; onSeguir: () => void }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_DOS_CARTOES }} />
      <Titulo sub="combina com você?">Qual cara</Titulo>
      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Tema">
        {TEMAS_DO_COMECO.map((t) => {
          const on = tema === t.chave;
          return (
            <button
              key={t.chave}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTema(t.chave)}
              className={`cartao-tema-${t.chave} grid min-h-[76px] grid-cols-[minmax(0,1fr)_28px] items-center gap-3 rounded-[22px] px-[18px] py-3.5 text-left transition-shadow`}
              style={{
                background: "var(--ct-fundo)",
                color: "var(--ct-tinta)",
                boxShadow: on ? "0 0 0 2.5px var(--ct-destaque), 0 0 0 5px var(--color-canvas), 0 0 0 6.5px var(--ct-destaque)" : "var(--ct-fio), 0 1px 2px rgba(0, 0, 0, 0.06)",
              }}
            >
              <span className="flex min-w-0 flex-col">
                <b className="cartao-tema-nome text-[19px] font-semibold leading-tight">{t.nome}</b>
                <small className="text-[13.5px] font-medium" style={{ color: "var(--ct-suave)" }}>
                  {[profileTheme(t.chave).nomeDaVoz, t.frase].filter(Boolean).join(", ")}
                </small>
              </span>
              <span
                className="flex size-7 items-center justify-center rounded-full"
                style={on ? { background: "var(--ct-destaque)", color: "var(--ct-check)" } : { boxShadow: "inset 0 0 0 1.5px var(--ct-suave)" }}
                aria-hidden
              >
                {on && <Check size={16} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <Nota>Dá para trocar quando quiser, em Configurações.</Nota>
      <Pe>
        <BotaoPrincipal onClick={onSeguir}>Pronto</BotaoPrincipal>
      </Pe>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// O primeiro lançamento
// ---------------------------------------------------------------------------------------------

function Porta({ nome, mes, onEscolher }: { nome: string; mes: string; onEscolher: (p: "extrato" | "digitar") => void }) {
  return (
    <>
      <Titulo sub={`o seu ${mes}.`}>Agora, {nome},</Titulo>
      <button type="button" onClick={() => onEscolher("extrato")} className="relative text-left">
        <HeroiDoTema className="min-h-[168px] !p-[18px]">
          <span className="heroi-veu absolute right-3.5 top-3.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold">1 minuto</span>
          <span className="heroi-veu flex size-11 items-center justify-center rounded-full" aria-hidden>
            <FileText size={21} strokeWidth={1.8} />
          </span>
          <span className="mt-auto flex flex-col">
            <b className="text-xl font-semibold">Enviar o extrato</b>
            <small className="text-sm font-medium text-heroi-suave">O app lê e separa sozinho</small>
          </span>
        </HeroiDoTema>
      </button>
      <button type="button" onClick={() => onEscolher("digitar")} className="glass flex min-h-[168px] flex-col items-start gap-3 rounded-3xl p-[18px] text-left">
        <Bolinha tamanho={44}>
          <Keyboard size={21} strokeWidth={1.8} />
        </Bolinha>
        <span className="mt-auto flex flex-col">
          <b className="text-xl font-semibold">Digitar um gasto</b>
          <small className="text-sm font-medium text-ink-muted">Um gasto agora, rápido</small>
        </span>
      </button>
    </>
  );
}

function LogoDoBanco({ banco, tamanho = 44 }: { banco: BancoDoComeco; tamanho?: 40 | 44 | 48 }) {
  if (!banco.marca)
    return (
      <span className="flex shrink-0 items-center justify-center rounded-[13px] bg-surface-2 text-ink-muted" style={{ width: tamanho, height: tamanho }} aria-hidden>
        <Building2 size={22} strokeWidth={1.7} />
      </span>
    );
  return <LogoDoLancamento descricao={banco.marca} icon={Building2} size={tamanho} />;
}

function EscolhaDoBanco({ marcados, onSeguir }: { marcados: string[]; onSeguir: (lista: string[]) => void }) {
  const [lista, setLista] = useState<string[]>(marcados);
  const alternar = (b: string) => setLista((l) => (l.includes(b) ? l.filter((x) => x !== b) : [...l, b]));
  const cartao = (chave: string, on: boolean) =>
    `glass relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-[18px] px-1.5 pb-2.5 pt-3 ${on ? "!border-accent shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : ""}`;
  return (
    <>
      <Titulo sub="seu banco?">Qual é o</Titulo>
      <Nota>Pode marcar mais de um. Eu te mostro um de cada vez.</Nota>
      <div className="grid grid-cols-3 gap-2">
        {[...BANCOS_DO_COMECO, BANCO_OUTRO].map((b) => {
          const on = lista.includes(b.chave);
          return (
            <button key={b.chave} type="button" onClick={() => alternar(b.chave)} aria-pressed={on} aria-label={b.chave === "outro" ? "Outro banco" : b.nome} className={cartao(b.chave, on)}>
              {on && (
                <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              {b.chave === "outro" ? (
                <span className="flex size-11 items-center justify-center rounded-[13px] bg-surface-2 text-ink-muted" aria-hidden>
                  <Plus size={20} />
                </span>
              ) : (
                <LogoDoBanco banco={b} />
              )}
              <small className="text-center text-[12px] font-semibold leading-tight">{b.chave === "outro" ? "Outro banco" : b.nome}</small>
            </button>
          );
        })}
      </div>
      <Nota>Tem cartão em outro banco? Dá para trazer a fatura também, depois.</Nota>
      <div className="sticky bottom-0 -mx-4 mt-auto bg-canvas/95 px-4 pb-[calc(var(--safe-bottom,0px)+12px)] pt-3 backdrop-blur-sm">
        <BotaoPrincipal onClick={() => onSeguir(lista)} disabled={lista.length === 0}>
          {lista.length > 1 ? `Continuar com ${lista.length} bancos` : "Continuar"}
        </BotaoPrincipal>
      </div>
    </>
  );
}

function Tutorial({
  banco,
  volta,
  nome,
  posicao,
  soEste,
  onSoEste,
  onArquivo,
  onDigitar,
}: {
  banco: BancoDoComeco;
  volta: boolean;
  nome: string;
  /** "1 de 3", quando ela marcou mais de um banco. */
  posicao: { atual: number; total: number } | null;
  soEste: boolean;
  onSoEste: () => void;
  onArquivo: (f: File) => void;
  onDigitar: () => void;
}) {
  const [pc, setPc] = useState(false);
  const cor = (banco.marca && marcaDaDescricao(banco.marca)?.cor) || "var(--color-accent)";
  return (
    <>
      {volta && (
        <Titulo sub={`${banco.chave !== "outro" ? `Você escolheu o ${banco.nome}. ` : ""}Falta só isso.`}>
          Oi de novo, {nome}.
        </Titulo>
      )}
      {posicao && (
        <p className="text-[13px] font-semibold text-accent-strong">
          {posicao.atual} de {posicao.total}: {banco.nome}
        </p>
      )}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <LogoDoBanco banco={banco} />
        <span className="flex min-w-0 flex-col">
          <b className="text-[17px] font-semibold">
            No app {banco.artigo} {banco.nome}
          </b>
          <small className="text-[13px] font-medium text-ink-muted">3 toques, e volta aqui</small>
        </span>
      </div>
      <ol className="grid grid-cols-3 gap-2">
        {banco.passos.map(([t, s], i) => (
          <li key={t + i} className="flex flex-col items-center gap-1 text-center">
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
            <b className="text-[13.5px] font-semibold leading-tight">{t}</b>
            <small className="text-[12px] font-medium leading-tight text-ink-muted">{s}</small>
          </li>
        ))}
      </ol>
      <Nota>{notaDoBanco(banco)}</Nota>
      <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-border-strong bg-surface px-4 py-3.5">
        <FileText size={22} className="shrink-0 text-accent-strong" aria-hidden />
        <span className="flex flex-col">
          <b className="text-base font-semibold">Enviar aqui</b>
          <small className="text-[13px] font-medium text-ink-muted">O arquivo que você baixou</small>
        </span>
        <input
          type="file"
          className="sr-only"
          accept=".pdf,.csv,.ofx,.xls,.xlsx,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onArquivo(f);
            e.target.value = "";
          }}
        />
      </label>
      <LinkDiscreto onClick={() => setPc((v) => !v)} aria-expanded={pc}>
        Está no computador? Envia de lá
      </LinkDiscreto>
      {pc && <Nota>Abra o SPI no navegador do computador, entre com o mesmo e-mail e envie o arquivo por lá. Aqui no celular ele aparece sozinho.</Nota>}
      <Pe>
        {posicao && posicao.atual < posicao.total && (
          <label className="mx-auto inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
            <input type="checkbox" checked={soEste} onChange={onSoEste} className="size-5 accent-[var(--color-accent)]" />
            Fazer só este agora (os outros ficam nos Primeiros passos)
          </label>
        )}
        {volta && <LinkDiscreto onClick={onDigitar}>Prefiro digitar um gasto</LinkDiscreto>}
        <a href={`mailto:${EMAIL_FALE_COM_A_GENTE}?subject=${encodeURIComponent("Ajuda com o extrato")}`} className="mx-auto inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-medium text-ink-muted hover:text-ink">
          <Mail size={15} aria-hidden />
          Travou? Fale com a gente
        </a>
      </Pe>
    </>
  );
}

/** "Lendo": os três quadros da lógica do extrato enquanto o arquivo é lido, e depois a revisão. */
function Lendo({ money, onTerminar, onOutroArquivo }: { money: Money; onTerminar: (mes: string | null, revisou: boolean, criados: number) => void; onOutroArquivo: () => void }) {
  const [estado, setEstado] = useState<EstadoParaOComeco | null>(null);
  const [quadro, setQuadro] = useState(0);
  const [revisando, setRevisando] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const aoMudar = useCallback((e: EstadoParaOComeco) => setEstado(e), []);
  const aoImportar = useCallback(
    (r: { mes: { year: number; month: number } | null; revisou: boolean; criados: number }) => {
      setTerminou(true);
      onTerminar(r.mes ? `${r.mes.year}-${String(r.mes.month).padStart(2, "0")}` : null, r.revisou, r.criados);
    },
    [onTerminar],
  );

  // Os quadros andam sozinhos enquanto ela espera (sem animação para quem pediu menos movimento).
  useEffect(() => {
    if (revisando || quadro >= 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setQuadro((q) => Math.min(2, q + 1)), 2600);
    return () => clearTimeout(t);
  }, [quadro, revisando]);

  const lido = !!estado && !estado.lendo && (estado.fase !== "upload" || estado.linhas > 0);
  // Arquivo que não deu (senha, tipo errado, erro de leitura): a tela da importação aparece e explica.
  const precisaDaImportacao = revisando || (!!estado && !estado.lendo && (estado.fase === "password" || (estado.fase === "upload" && estado.erro)));

  return (
    <>
      {!precisaDaImportacao && (
        <>
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink-muted" aria-live="polite">
            <FileText size={16} aria-hidden />
            <span className="min-w-0 flex-1">{lido ? "Extrato lido" : "Lendo o seu extrato"}</span>
            {!lido && <b className="text-[12px] font-semibold text-success">lendo</b>}
          </p>
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
          <Pe>
            <BotaoPrincipal onClick={() => setRevisando(true)} disabled={!lido}>
              {!lido ? "Lendo..." : estado && estado.pendentes > 0 ? "Ver o que precisa de mim" : "Ver o meu mês"}
            </BotaoPrincipal>
          </Pe>
        </>
      )}
      {/* A importação de verdade (a mesma do +): lê o arquivo, faz a revisão um por vez e grava. */}
      <div className={precisaDaImportacao && !terminou ? "" : "hidden"}>
        {revisando && estado && estado.pendentes > 0 && (
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Precisa de você</span>
          </div>
        )}
        <StatementImport onDone={onOutroArquivo} comeco={{ aoMudar, aoImportar, visivel: precisaDaImportacao && !terminou }} />
      </div>
      {terminou && <Nota centro>Montando o seu mês...</Nota>}
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
      <Titulo sub="não é gasto">Pix para você mesma</Titulo>
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
  const lancar = () =>
    startSalvar(async () => {
      setErro(null);
      const r = await primeiroGastoAction({ valor, descricao: a.nome, parentCategory: a.categoria, sub: a.sub, como: "digitado" });
      if (!r.ok) return setErro(r.erro);
      trackEvent("registro_digitado", "/comecar/digitar");
      onLancado(`${valorCurto(money, valor)} em ${categoryLabel(categorias, a.categoria)}, hoje`);
    });
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "apagar"];
  return (
    <>
      <Titulo centro>Um gasto de hoje</Titulo>
      {/* Começa no zero, sem exemplo: nada aqui pode parecer um gasto já lançado. */}
      <div className="flex justify-center" aria-live="polite">
        <ValorDestaque texto={money(valor)} className={`text-[clamp(2.4rem,12vw,2.75rem)] font-light leading-none tracking-[-0.02em] tabular-nums ${digitos ? "" : "text-ink-muted"}`} />
      </div>
      <Nota centro>{digitos ? "O que foi?" : "Digite quanto foi e escolha o que foi."}</Nota>
      <div className="flex flex-wrap justify-center gap-2">
        {ATALHOS_DO_GASTO.map((x, i) => (
          <Pilula key={x.nome} ativa={atalho === i} onClick={() => setAtalho(i)}>
            {marcaDaDescricao(x.nome) ? <LogoDoLancamento descricao={x.nome} icon={categoryIcon(categorias, x.categoria)} size={36} /> : null}
            {x.nome}
          </Pilula>
        ))}
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
  const [entendi, setEntendi] = useState<ParsedVoiceEntry | null>(null);
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
        parentCategory: entendi.parentCategory,
        como: "falado",
      });
      if (!r.ok) return setErro(r.erro);
      trackEvent("registro_voz", "/comecar/falar");
      const onde = entendi.parentCategory ? categoryLabel(categorias, entendi.parentCategory) : entendi.description || "Outros";
      onLancado(`${valorCurto(money, entendi.amount)} em ${onde}, hoje`);
    });
  const iconeDaFala = entendi?.parentCategory ? categoryIcon(categorias, entendi.parentCategory) : Wallet;
  return (
    <>
      <Titulo centro>Falar</Titulo>
      <Nota centro>Segure e fale, do jeito que sai</Nota>
      <p className="text-center text-[17px] font-medium">&quot;Gastei 45 no mercado&quot;</p>
      {entendi ? (
        <>
          <Nota centro>Entendi assim:</Nota>
          <div className="glass grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3.5 py-2.5">
            <LogoDoLancamento descricao={entendi.description} icon={iconeDaFala} size={40} />
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-[15px] font-semibold">{entendi.description || "Gasto"}</b>
              <small className="text-[12.5px] font-medium text-ink-muted">{entendi.parentCategory ? `${categoryLabel(categorias, entendi.parentCategory)} · Hoje` : "Hoje"}</small>
            </span>
            <em className="whitespace-nowrap text-[15px] font-medium not-italic tabular-nums">{entendi.amount ? money(entendi.amount) : "sem valor"}</em>
          </div>
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

/** A confirmação que não deixa dúvida: o check, "Lançado." ou "Pronto.", e o que entrou. */
function Confirmacao({ titulo, linha, proximo, onSeguir, onParar }: { titulo: string; linha: string; proximo: string | null; onSeguir: () => void; onParar: () => void }) {
  const prox = bancoDoComeco(proximo);
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
        <BotaoPrincipal onClick={onSeguir}>{prox ? `Próximo: ${prox.nome}` : "Ver a Visão geral"}</BotaoPrincipal>
        {prox && <LinkDiscreto onClick={onParar}>Deixar o resto para depois</LinkDiscreto>}
      </Pe>
    </>
  );
}
