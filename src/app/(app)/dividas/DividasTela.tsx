"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, CircleCheck, Minus, Plus } from "lucide-react";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { Explica } from "@/components/ui/Explica";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { comparacaoComBolaDeNeve, ehImpossivel, simularQuitacao, type Plano, type PlanoImpossivel } from "@/lib/dividas/plano";
import { ordemDeAtaque, retratoDe } from "@/lib/dividas/tipos";
import { paraResolver, parcelasSobreARenda, saudaveis, type DividaDoSpi } from "@/lib/dividas/saude";
import { CadastroDaDivida } from "./CadastroDaDivida";
import { DetalheDaDivida } from "./DetalheDaDivida";
import { virarMetaAction } from "./actions";
import { CORES_DA_ORDEM, LogoDoCredor, SeloDaSaude, iconeDoTipo, mesAdiante, mesCurto, mesDoBilhete, mesPorExtenso, plural, pct, type Hoje } from "./partes";

type Props = {
  dividas: DividaDoSpi[];
  renda: number;
  sobrou: number;
  selic: number;
  selicDeExemplo: boolean;
  hoje: Hoje;
  perfil: string;
  abrirPlano: boolean;
  abrirNova: boolean;
};

const EXTRA_PADRAO = 200;
const chaveDoExtra = (perfil: string) => `dividas-extra:${perfil}`;

/**
 * A tela inteira das Dívidas: o bilhete (lista) e o Plano. O "a mais por mês" fica guardado no
 * aparelho (por perfil), sem ir ao banco: é uma simulação dela, não um dado.
 */
export function DividasTela({ dividas, renda, sobrou, selic, selicDeExemplo, hoje, perfil, abrirPlano, abrirNova }: Props) {
  const money = useMoney();
  const m0 = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();

  const [vista, setVista] = useState<"lista" | "plano">(abrirPlano ? "plano" : "lista");
  const [extra, setExtraBruto] = useState(EXTRA_PADRAO);
  const [saudaveisAbertas, setSaudaveisAbertas] = useState(false);
  const [ordemAberta, setOrdemAberta] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [cadastro, setCadastro] = useState<{ divida?: DividaDoSpi } | null>(abrirNova ? {} : null);
  const [semDividas, setSemDividas] = useState(false);
  const [arrancando, setArrancando] = useState<string | null>(null);

  // O valor a mais que ela escolheu da última vez (no aparelho). Pode faltar (aba anônima).
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(chaveDoExtra(perfil)));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o aparelho uma vez, depois de montar
      if (localStorage.getItem(chaveDoExtra(perfil)) !== null && Number.isFinite(v) && v >= 0) setExtraBruto(v);
    } catch {}
  }, [perfil]);
  const setExtra = (v: number) => {
    setExtraBruto(v);
    try {
      localStorage.setItem(chaveDoExtra(perfil), String(v));
    } catch {}
  };

  const res = useMemo(() => paraResolver(dividas, selic), [dividas, selic]);
  const sau = useMemo(() => saudaveis(dividas, selic), [dividas, selic]);
  // O motor do Rota devolve a dívida dele; aqui são as do SPI, na mesma ordem.
  const ordem = useMemo(() => ordemDeAtaque(res) as DividaDoSpi[], [res]);
  const plano = useMemo(() => (res.length ? simularQuitacao(res, extra) : null), [res, extra]);
  const parcelas = parcelasSobreARenda(dividas, renda);
  const corDe = (id: string) => CORES_DA_ORDEM[Math.max(0, ordem.findIndex((d) => d.id === id)) % CORES_DA_ORDEM.length];
  const caiEm = (id: string) => {
    const q = plano && !ehImpossivel(plano) ? plano.quitacoes.find((x) => x.id === id) : null;
    return q ? `cai em ${mesCurto(mesAdiante(hoje, q.mes))}` : "sem data ainda";
  };

  const abrirDivida = (id: string) => {
    if (arrancando) return;
    // Tocar no canhoto: ele se solta (é o que vai acontecer quando ela quitar) e a dívida abre.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setAberta(id);
    setArrancando(id);
    setTimeout(() => {
      setAberta(id);
      setTimeout(() => setArrancando(null), 420);
    }, 560);
  };

  const divAberta = dividas.find((d) => d.id === aberta) ?? null;
  const modais = (
    <>
      <CadastroDaDivida
        aberto={cadastro !== null}
        divida={cadastro?.divida}
        selic={selic}
        hoje={hoje}
        dividas={dividas}
        extra={extra}
        onFechar={() => {
          setCadastro(null);
          if (abrirNova) router.replace("/dividas");
        }}
        onSalvo={(editou) => {
          setCadastro(null);
          setSemDividas(false);
          setVista("lista");
          showToast(editou ? "Dívida atualizada" : "Dívida adicionada");
          router.replace("/dividas");
          router.refresh();
        }}
      />
      <DetalheDaDivida
        divida={divAberta}
        selic={selic}
        selicDeExemplo={selicDeExemplo}
        plano={plano}
        hoje={hoje}
        onFechar={() => setAberta(null)}
        onEditar={(d) => {
          setAberta(null);
          setTimeout(() => setCadastro({ divida: d }), 60);
        }}
      />
    </>
  );

  // Sem nenhuma dívida: uma pergunta só, e o estado calmo de quem não tem.
  if (dividas.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {semDividas ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface px-6 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
              <CircleCheck size={26} strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-lg font-medium text-ink">Sem dívidas</p>
            <p className="max-w-xs text-sm text-ink-muted">Se algum dia aparecer, é aqui que você organiza.</p>
            <button type="button" onClick={() => setCadastro({})} className="min-h-11 px-3 text-sm font-medium text-accent-strong">
              Tenho uma dívida
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
            <p className="text-lg font-medium text-ink">Você tem alguma dívida hoje?</p>
            <button type="button" onClick={() => setCadastro({})} className="min-h-12 rounded-full bg-accent-gradient px-5 text-[15px] font-medium text-on-accent">
              Sim, quero mapear
            </button>
            <button type="button" onClick={() => setSemDividas(true)} className="min-h-12 rounded-full border border-border bg-surface-2 px-5 text-[15px] text-ink">
              Não tenho
            </button>
          </div>
        )}
        {modais}
      </div>
    );
  }

  if (vista === "plano") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <button type="button" onClick={() => { setVista("lista"); if (abrirPlano) router.replace("/dividas"); }} className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm text-ink-muted">
          <ChevronLeft size={18} strokeWidth={1.8} aria-hidden /> Dívidas
        </button>
        <h2 className="titulo-tema -mt-2 px-1 text-2xl font-medium text-ink">O plano</h2>
        <PlanoDoBilhete
          res={res}
          ordem={ordem}
          extra={extra}
          setExtra={setExtra}
          sobrou={sobrou}
          hoje={hoje}
          m0={m0}
        />
        {res.length > 0 && (
          <>
            <div className="rounded-3xl border border-border bg-surface px-4">
              <button type="button" onClick={() => setOrdemAberta((v) => !v)} aria-expanded={ordemAberta} className="flex min-h-12 w-full items-center justify-between text-[15px] font-medium text-ink">
                Por que essa ordem?
                <ChevronDown size={18} strokeWidth={1.8} className={`text-ink-muted transition-transform ${ordemAberta ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {ordemAberta && <PorQueEssaOrdem res={res} extra={extra} m0={m0} />}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!plano || ehImpossivel(plano)}
                onClick={() =>
                  plano &&
                  !ehImpossivel(plano) &&
                  startTransition(async () => {
                    const fim = mesAdiante(hoje, plano.meses);
                    const r = await virarMetaAction({ total: Math.round(retratoDe(res).total), meses: plano.meses, ano: fim.ano, mes: fim.mes });
                    if (!r.ok) return showToast(r.erro);
                    showToast(r.jaExistia ? "Você já tem essa meta" : "Meta criada", { label: "Ver", onClick: () => router.push("/planejamento/metas") });
                  })
                }
                className="min-h-12 rounded-full bg-surface-2 px-3 text-[15px] text-ink disabled:opacity-50"
              >
                Virar meta
              </button>
              <Link href="/simuladores/amortizar-vs-investir" className="flex min-h-12 items-center justify-center rounded-full bg-surface-2 px-3 text-center text-[15px] leading-tight text-ink">
                Quitar ou investir?
              </Link>
            </div>
          </>
        )}
        {modais}
      </div>
    );
  }

  const p = plano;
  const ok = p && !ehImpossivel(p) ? p : null;
  const fim = ok ? mesAdiante(hoje, ok.meses) : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section className="bilhete" aria-label="Destino: livre">
        <div className="bilhete-foto">
          <span>Destino: livre</span>
        </div>
        {parcelas?.alerta && (
          <Explica
            rotulo={`Parcelas: ${pct(parcelas.proporcao * 100, 0)}% da renda. Acima de 30% é sinal de alerta`}
            classeDoGatilho="bilhete-carimbo"
            gatilho={
              <>
                <b>{pct(parcelas.proporcao * 100, 0)}%</b>
                <small>da renda</small>
              </>
            }
          >
            As parcelas somam {pct(parcelas.proporcao * 100, 0)}% da renda, contando todas, inclusive as saudáveis: {m0(parcelas.porMes)} de {m0(renda)}. Acima de 30% sobra pouco
            para o resto da vida; evite parcelas novas por agora.
          </Explica>
        )}

        {!res.length ? (
          <div className="flex flex-col gap-1 px-[18px] pb-[18px] pt-[18px] pr-24">
            <b className="text-[1.75rem] font-light leading-tight tracking-[-0.02em] text-ink">Todas saudáveis</b>
            <p className="text-[15px] text-ink-muted">Siga pagando em dia, no ritmo delas.</p>
          </div>
        ) : !ok ? (
          <div className="flex flex-col gap-1 px-[18px] pb-[18px] pt-[18px] pr-24">
            <b className="text-[1.75rem] font-light leading-tight tracking-[-0.02em] text-ink">As dívidas não acabam</b>
            <p className="text-[15px] text-ink-muted">Do jeito que está, os juros passam do que sai por mês. O plano mostra quanto falta.</p>
          </div>
        ) : (
          <>
            <Rota hoje={hoje} plano={ok} corDe={corDe} folgaDoCarimbo={!!parcelas?.alerta} />
            <div className="relative flex items-baseline justify-center gap-2 px-[18px] pt-1.5">
              <small className="text-[15px] text-ink-muted">Faltam</small>
              <ValorDestaque texto={String(ok.meses)} className="text-[clamp(34px,11cqw,44px)] font-light leading-[1.1] tracking-[-0.03em] tabular-nums" />
              <small className="text-[15px] text-ink-muted">{ok.meses === 1 ? "mês" : "meses"}</small>
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Explica rotulo="O que entra nessa data?">
                  Livre em {fim && mesPorExtenso(fim)}. A data conta só as dívidas para resolver, com {m0(extra)} a mais por mês. As saudáveis (planejadas, com juros abaixo da Selic e em
                  dia) seguem no ritmo delas e não entram aqui.
                </Explica>
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 px-[clamp(14px,4.5cqw,18px)] pb-3.5 pt-2">
              <Campo rotulo="Dívidas" valor={String(res.length)} />
              <Campo rotulo="A mais" valor={m0(extra)} />
              <Campo rotulo="Juros até lá" valor={m0(ok.totalJuros)} />
            </dl>
          </>
        )}

        {res.length > 0 && (
          <>
            <div className="bilhete-picote" aria-hidden>
              <i />
              <i />
            </div>
            <div className={`canhotos ${ordem.length > 2 ? "rola" : ""}`}>
              {ordem.map((d, j) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => abrirDivida(d.id)}
                  className={`canhoto ${j === 0 ? "foco" : ""} ${arrancando === d.id ? "arranca" : ""}`}
                  style={{ ["--k" as string]: corDe(d.id) }}
                  aria-label={`${d.nome}: ${m0(d.saldo)}, ${caiEm(d.id)}. Abrir`}
                >
                  <i className="mk" />
                  <small className="pr-3.5 text-xs font-medium opacity-80">{j === 0 ? "Agora, foque em" : "Depois"}</small>
                  <b className="text-[15px] font-medium leading-tight">{d.nome}</b>
                  <ValorDestaque texto={m0(d.saldo)} className="whitespace-nowrap text-[clamp(1.375rem,6.5cqw,1.625rem)] font-light leading-[1.15] tracking-[-0.02em] tabular-nums" />
                  <span className={`text-xs font-medium ${d.atrasada && j > 0 ? "text-danger" : "opacity-80"}`}>
                    {d.atrasada ? "atrasada · " : ""}
                    {caiEm(d.id)}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <p className="px-1 text-center text-[13px] text-ink-muted">As parcelas já estão dentro do seu plano.</p>

      {sau.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setSaudaveisAbertas((v) => !v)}
            aria-expanded={saudaveisAbertas}
            className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-border bg-surface px-3.5 py-3 text-left"
          >
            <span className="flex">
              {sau.slice(0, 2).map((d, i) => {
                const Icone = iconeDoTipo(d.tipo);
                return (
                  <span key={d.id} className={`flex size-9 items-center justify-center rounded-full bg-success-soft text-success ring-2 ring-[var(--color-surface)] ${i ? "-ml-2.5" : ""}`}>
                    <Icone size={18} strokeWidth={1.6} aria-hidden />
                  </span>
                );
              })}
            </span>
            <span className="flex min-w-0 flex-col">
              <b className="text-[15px] font-medium text-ink">Saudáveis · em dia</b>
              <small className="truncate text-[13px] text-ink-muted">{juntar(sau.map((d) => d.nome))}</small>
            </span>
            <ChevronDown size={18} strokeWidth={1.8} className={`text-ink-muted transition-transform ${saudaveisAbertas ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {saudaveisAbertas && (
            <ul className="divide-y divide-border rounded-3xl border border-border bg-surface px-3">
              {sau.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => setAberta(d.id)} className="grid w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left">
                    <LogoDoCredor credor={d.credor} tipo={d.tipo} saude="saudavel" size={36} />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2">
                        <b className="truncate text-[15px] font-medium text-ink">{d.nome}</b>
                        <SeloDaSaude saude="saudavel" />
                      </span>
                      <small className="text-[13px] text-ink-muted">em dia{d.parcelasAbertas ? ` · faltam ${d.parcelasAbertas} parcelas` : ""}</small>
                    </span>
                    <span className="whitespace-nowrap text-[15px] tabular-nums text-ink">{m0(d.saldo)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {res.length > 0 && (
        <button type="button" onClick={() => setVista("plano")} className="inline-flex min-h-11 items-center gap-1 self-center px-3 text-[15px] font-medium text-accent-strong">
          Ver o plano <ChevronRight size={18} strokeWidth={1.8} aria-hidden />
        </button>
      )}
      <button type="button" onClick={() => setCadastro({})} className="flex min-h-11 w-fit items-center justify-center gap-1.5 rounded-full bg-surface-2 px-4 text-[15px] text-ink">
        <Plus size={18} strokeWidth={1.8} aria-hidden /> Adicionar dívida
      </button>
      {modais}
    </div>
  );
}

function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

function Campo({ rotulo, valor, ganho = false }: { rotulo: string; valor: string; ganho?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <dt className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted max-[340px]:tracking-normal">{rotulo}</dt>
      <dd className={`mt-1 whitespace-nowrap text-base font-medium tabular-nums max-[340px]:text-[15px] ${ganho ? "text-success" : "text-ink"}`}>{valor}</dd>
    </div>
  );
}

/** OUT 26 ··•····•·· SET 27: hoje, onde cada dívida cai e o mês em que fica livre. */
function Rota({ hoje, plano, corDe, folgaDoCarimbo }: { hoje: Hoje; plano: Plano; corDe: (id: string) => string; folgaDoCarimbo: boolean }) {
  const ponta = (rotulo: string, m: Hoje, dir = false) => (
    <span className={`flex flex-none flex-col leading-none ${dir ? "items-end" : ""}`}>
      <b className="whitespace-nowrap text-[clamp(1.25rem,6.2cqw,1.5rem)] font-medium uppercase tracking-[-0.01em] text-ink">{mesDoBilhete(m)}</b>
      <small className="mt-[5px] text-xs font-medium text-ink-muted">{rotulo}</small>
    </span>
  );
  return (
    // Com o carimbo dos 30%, a rota desce um pouco em vez de encolher: a linha fica inteira até em 320 px.
    <div className={`flex items-center gap-2 px-[clamp(14px,4.5cqw,18px)] pb-1 ${folgaDoCarimbo ? "pt-[30px]" : "pt-[18px]"}`}>
      {ponta("hoje", hoje)}
      <span className="bilhete-via" aria-label={plano.quitacoes.map((q) => `${q.nome} cai em ${mesPorExtenso(mesAdiante(hoje, q.mes))}`).join(", ")}>
        {plano.quitacoes.map((q) => (
          <b key={q.id} style={{ left: `${((q.mes / plano.meses) * 100).toFixed(1)}%`, ["--k" as string]: corDe(q.id) }} />
        ))}
      </span>
      {ponta("livre", mesAdiante(hoje, plano.meses), true)}
    </div>
  );
}

const ATALHOS = (sobrou: number, m0: (v: number) => string) => [
  [0, m0(0)],
  [200, m0(200)],
  [500, m0(500)],
  ...(sobrou > 0 ? [[sobrou, "O que sobrou"] as [number, string]] : []),
] as [number, string][];

/** O plano: o mesmo bilhete, com o valor a mais por mês entre dois picotes. */
function PlanoDoBilhete({
  res,
  ordem,
  extra,
  setExtra,
  sobrou,
  hoje,
  m0,
}: {
  res: DividaDoSpi[];
  ordem: DividaDoSpi[];
  extra: number;
  setExtra: (v: number) => void;
  sobrou: number;
  hoje: Hoje;
  m0: (v: number) => string;
}) {
  if (!res.length) {
    return (
      <section className="bilhete">
        <p className="p-[18px] text-[15px] text-ink-muted">Nenhuma dívida para resolver. As saudáveis seguem no ritmo delas.</p>
      </section>
    );
  }
  const p = simularQuitacao(res, extra);
  const p0 = simularQuitacao(res, 0);
  const max = Math.ceil(retratoDe(res).total / 50) * 50;
  const muda = (v: number) => setExtra(Math.max(0, Math.min(max, Math.round(v))));
  const cor = (j: number) => CORES_DA_ORDEM[j % CORES_DA_ORDEM.length];
  const corDe = (id: string) => cor(Math.max(0, ordem.findIndex((d) => d.id === id)));

  return (
    <section className="bilhete" aria-label="O plano">
      <div aria-live="polite">
        {ehImpossivel(p) ? (
          <Impossivel p={p} m0={m0} />
        ) : (
          <ResultadoDoPlano p={p} p0={p0} hoje={hoje} corDe={corDe} m0={m0} />
        )}
      </div>
      <div className="bilhete-picote" aria-hidden>
        <i />
        <i />
      </div>
      <div className="flex flex-col items-center gap-2.5 px-3.5 pb-2.5 pt-1.5">
        <span className="text-[15px] text-ink">A mais por mês</span>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => muda(extra - 50)} disabled={extra <= 0} aria-label={`${m0(50)} a menos`} className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-2 text-ink disabled:opacity-40">
            <Minus size={18} strokeWidth={1.8} aria-hidden />
          </button>
          <ValorDestaque texto={m0(extra)} className="min-w-[6ch] text-center text-[2rem] font-light leading-none tracking-[-0.03em] tabular-nums" />
          <button type="button" onClick={() => muda(extra + 50)} disabled={extra >= max} aria-label={`${m0(50)} a mais`} className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-2 text-ink disabled:opacity-40">
            <Plus size={18} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {ATALHOS(sobrou, m0).map(([v, t]) => (
            <button
              key={t}
              type="button"
              onClick={() => muda(v)}
              aria-pressed={extra === v}
              className={`min-h-9 whitespace-nowrap rounded-full px-3.5 text-sm ${extra === v ? "bg-ink text-canvas" : "border border-border bg-surface text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="bilhete-picote" aria-hidden>
        <i />
        <i />
      </div>
      <div className={`canhotos ${ordem.length > 2 ? "rola" : ""}`}>
        {ordem.map((d, j) => {
          const q = !ehImpossivel(p) ? p.quitacoes.find((x) => x.id === d.id) : null;
          return (
            <div key={d.id} className={`canhoto ${j === 0 ? "foco" : ""}`} style={{ ["--k" as string]: cor(j) }}>
              <i className="mk" />
              <small className="pr-3.5 text-xs font-medium opacity-80">{j === 0 ? "Primeiro" : "Depois"}</small>
              <b className="text-[15px] font-medium leading-tight">{d.nome}</b>
              <span className="text-xs font-medium opacity-80">{q ? `cai em ${mesCurto(mesAdiante(hoje, q.mes))}` : "sem data ainda"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResultadoDoPlano({ p, p0, hoje, corDe, m0 }: { p: Plano; p0: Plano | PlanoImpossivel; hoje: Hoje; corDe: (id: string) => string; m0: (v: number) => string }) {
  const antes = !ehImpossivel(p0) ? p0.meses - p.meses : null;
  const economia = !ehImpossivel(p0) ? p0.totalJuros - p.totalJuros : null;
  return (
    <>
      <Rota hoje={hoje} plano={p} corDe={corDe} folgaDoCarimbo={false} />
      <div className="flex items-baseline justify-center gap-2 px-[18px] pt-1.5" aria-label={`Livre em ${mesPorExtenso(mesAdiante(hoje, p.meses))}`}>
        <small className="text-[15px] text-ink-muted">Faltam</small>
        <span className="text-[clamp(34px,11cqw,44px)] font-light leading-[1.1] tracking-[-0.03em] tabular-nums text-ink">{p.meses}</span>
        <small className="text-[15px] text-ink-muted">{p.meses === 1 ? "mês" : "meses"}</small>
      </div>
      <dl className="grid grid-cols-2 gap-2 px-[clamp(14px,4.5cqw,18px)] pb-3.5 pt-2">
        <Campo rotulo="Chega" valor={antes && antes > 0 ? `${plural(antes, "mês", "meses")} antes` : "no ritmo de hoje"} />
        {economia !== null && economia > 0.5 ? <Campo rotulo="Juros a menos" valor={m0(economia)} ganho /> : <Campo rotulo="Juros até lá" valor={m0(p.totalJuros)} />}
      </dl>
    </>
  );
}

function Impossivel({ p, m0 }: { p: PlanoImpossivel; m0: (v: number) => string }) {
  return (
    <div className="flex flex-col gap-2 p-[18px]">
      <b className="text-[17px] font-medium text-ink">Do jeito que está, as dívidas não acabam</b>
      <p className="text-sm text-ink-muted">Para cada uma parar de crescer, falta por mês:</p>
      <dl className="flex flex-col divide-y divide-border">
        {p.travando.map((t) => (
          <div key={t.id} className="flex justify-between gap-3 py-2 text-[15px]">
            <dt className="text-ink">{t.nome}</dt>
            <dd className="tabular-nums text-danger">{m0(t.faltaPorMes)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PorQueEssaOrdem({ res, extra, m0 }: { res: DividaDoSpi[]; extra: number; m0: (v: number) => string }) {
  const c = comparacaoComBolaDeNeve(res, extra);
  const lado = (titulo: string, pl: Plano, vence: boolean) => (
    <div className={`flex min-w-0 flex-col gap-0.5 rounded-2xl p-3 ${vence ? "bg-success-soft" : "bg-surface-2"}`}>
      <small className="text-[13px] text-ink-muted">{titulo}</small>
      <b className={`text-lg font-medium tabular-nums ${vence ? "text-success" : "text-ink"}`}>{m0(pl.totalJuros)}</b>
      <span className="text-[13px] text-ink">de juros · 1ª cai em {plural(pl.primeira?.mes ?? 0, "mês", "meses")}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 pb-4">
      <p className="text-sm leading-relaxed text-ink">
        Primeiro as de juros altos (4% ao mês ou mais), depois as que podem levar um bem, depois as essenciais, depois as outras. No mesmo grupo, a mais cara vem antes. O que já sai por
        mês continua saindo; o extra vai todo para a primeira, e quando uma acaba a parcela dela passa para a próxima.
      </p>
      {c && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {lado("Mais cara primeiro", c.avalanche, c.economia > 0.5)}
            {lado("Menor primeiro", c.bolaDeNeve, false)}
          </div>
          <p className="text-[13px] text-ink-muted">
            {c.economia > 0.5
              ? `A mais cara primeiro economiza ${m0(c.economia)}.`
              : "Nas suas dívidas, as duas ordens dão no mesmo."}
          </p>
        </>
      )}
    </div>
  );
}

