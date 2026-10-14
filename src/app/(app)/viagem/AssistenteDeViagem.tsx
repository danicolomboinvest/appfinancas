"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  BedDouble,
  Building2,
  FerrisWheel,
  Landmark,
  Mountain,
  MountainSnow,
  Palmtree,
  Trees,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Minus,
  Pencil,
  Plane,
  Plus,
  Search,
  Tag,
  Target,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Explica } from "@/components/ui/Explica";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { useMoney, useCurrency } from "@/components/money/MoneyProvider";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { useToast } from "@/components/ui/toast-context";
import { currencySymbol } from "@/lib/money";
import {
  airportCodeFor,
  cleanPlaceLabel,
  clampCategoryValue,
  customKey,
  MAX_EXTRA_CATEGORIES,
  photoFor,
  bankPhotoSrc,
  PLACE_TYPE_LABEL,
  PLACE_TYPES_TO_PICK,
  placeTypeFor,
  resolveLegDestination,
  searchDestinations,
  TRAVEL_REGIONS,
  TRIP_LIMITS,
  TRIP_PHOTOS,
  type PlaceType,
  type TravelDestination,
  type TravelRegion,
  type TripLeg,
} from "@/lib/travel/estimates";
import {
  boardingMonth,
  proximoDestinoDosDias,
  cheaperMonthTip,
  monthFromToday,
  monthsAhead,
  monthlyForTrip,
  monthValue,
  seasonByMonth,
  stepMonthly,
  STYLE_LABEL,
  STYLES,
  TRIP_STEP_SHORT,
  TRIP_STEPS,
  tripValues,
  type FixedKey,
  type TripPlan,
} from "@/lib/travel/assistente";
import { salvarViagemAction, type TravelGoalState } from "./actions";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Quantos meses à frente dá para escolher (o calendário do protótipo ia até 3 anos). */
const MAX_MESES_A_FRENTE = 36;

/** "maio de 2027" */
function nomeDoMes(value: string, maiuscula = false): string {
  const [y, m] = value.split("-").map(Number);
  const nome = MESES[m - 1] ?? "";
  return `${maiuscula ? nome.charAt(0).toUpperCase() + nome.slice(1) : nome} de ${y}`;
}

/** Cada linha do custo com cor e ícone fixos (rodada 17). */
const BLOCOS: { key: FixedKey; label: string; icon: typeof Plane; cor: string }[] = [
  { key: "flights", label: "Passagens", icon: Plane, cor: "var(--color-info)" },
  { key: "lodging", label: "Hospedagem", icon: BedDouble, cor: "var(--color-accent)" },
  { key: "food", label: "Alimentação", icon: UtensilsCrossed, cor: "var(--color-cat-alimentacao)" },
  { key: "activities", label: "Passeios e transporte", icon: Compass, cor: "var(--color-chart-5)" },
];

/** Regiões para "Fora do Brasil" (o Brasil é o outro botão). */
const CONTINENTES = TRAVEL_REGIONS.filter((r) => r !== "Brasil");

type NovoLugar = { label: string; placeType: PlaceType | null; noBrasil: boolean | null; region: TravelRegion | null };

const VAZIO = (hoje: Date): TripPlan => ({
  legs: [],
  travelers: 2,
  style: "medio",
  tripMonth: monthFromToday(hoje, 6),
  overrides: {},
  extras: [],
  photos: {},
});

const ICONE_DO_TIPO: Record<PlaceType, typeof Plane> = {
  praia: Palmtree,
  serra: Mountain,
  neve: MountainSnow,
  historica: Landmark,
  grande: Building2,
  natureza: Trees,
  parque: FerrisWheel,
};

/**
 * Foto do destino. Sem foto (cidade sem foto própria), um quadro neutro com o ícone do tipo de
 * lugar, nunca a foto de outra cidade. As fotos vão como arquivo, com fundo sólido de espera.
 */
function Foto({ src, tipo, className = "", larga = false }: { src: string | null; tipo: PlaceType; className?: string; larga?: boolean }) {
  if (!src) {
    const Icone = ICONE_DO_TIPO[tipo];
    return (
      <span
        aria-hidden
        // Nas fotos largas (cartões com o nome por cima), o ícone fica no alto, longe do nome.
        className={`flex justify-center text-ink-muted ${larga ? "items-start pt-[4%]" : "items-center"} ${className}`}
        style={{ background: "linear-gradient(135deg, var(--color-surface-2), color-mix(in srgb, var(--color-accent) 22%, var(--color-surface-2)))" }}
      >
        <Icone className={larga ? "size-8 opacity-45" : "size-[38%] max-h-12 max-w-12 opacity-70"} strokeWidth={1.5} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" decoding="async" className={`bg-surface-2 object-cover ${className}`} />;
}

function Contador({
  valor,
  unidade,
  rotulo,
  min,
  max,
  onMudar,
  grande = false,
  sobreFoto = false,
  compacto = false,
}: {
  valor: number;
  unidade: string;
  rotulo: string;
  min: number;
  max: number;
  onMudar: (v: number) => void;
  grande?: boolean;
  sobreFoto?: boolean;
  /** Nos cartões empilhados: um pouco menor abaixo de 360 px, para o nome do lugar caber inteiro. */
  compacto?: boolean;
}) {
  const botao = `flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-35 ${grande ? "size-14" : compacto ? "size-11 max-[359px]:size-9" : "size-11"} ${
    sobreFoto ? "bg-white/25 text-white backdrop-blur-sm hover:bg-white/35" : "bg-surface-2 text-ink hover:bg-surface-hover"
  }`;
  return (
    <div className={`flex items-center ${compacto ? "gap-3 max-[359px]:gap-1.5" : "gap-3"}`}>
      <button type="button" className={botao} aria-label={`Menos ${rotulo}`} disabled={valor <= min} onClick={() => onMudar(Math.max(min, valor - 1))}>
        <Minus className={grande ? "size-6" : "size-5"} aria-hidden />
      </button>
      <span className={`flex ${compacto ? "min-w-14 max-[359px]:min-w-10" : "min-w-14"} flex-col items-center leading-none ${sobreFoto ? "text-white" : "text-ink"}`} aria-live="polite">
        <b className={`font-light tabular-nums ${grande ? "text-[3.25rem]" : compacto ? "text-[2.5rem] max-[359px]:text-[2rem]" : "text-[2.5rem]"}`}>{valor}</b>
        <small className={`mt-1 text-caption ${sobreFoto ? "text-white/85" : "text-ink-muted"}`}>{unidade}</small>
      </span>
      <button type="button" className={botao} aria-label={`Mais ${rotulo}`} disabled={valor >= max} onClick={() => onMudar(Math.min(max, valor + 1))}>
        <Plus className={grande ? "size-6" : "size-5"} aria-hidden />
      </button>
    </div>
  );
}

function Pilula({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativa}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${ativa ? "border-accent bg-accent-soft text-accent-strong" : "border-border bg-surface text-ink hover:bg-surface-hover"}`}
    >
      {children}
    </button>
  );
}

/** Campo de valor com o R$ fixo dentro, com centavos (os dígitos entram pela direita). */
function CampoValor({ valor, rotulo, onMudar, placeholder }: { valor: number; rotulo: string; onMudar: (v: number) => void; placeholder?: string }) {
  const currency = useCurrency();
  return (
    <label className="flex w-[8.25rem] shrink-0 items-center gap-1 rounded-xl border border-border bg-surface px-2.5 py-1.5 focus-within:border-accent">
      <span className="text-xs text-ink-faint">{currencySymbol(currency)}</span>
      <CampoDeDinheiro
        aria-label={rotulo}
        placeholder={placeholder}
        valor={valor}
        onValor={(v) => onMudar(clampCategoryValue(v ?? 0))}
        className="w-full min-w-0 bg-transparent text-right text-sm tabular-nums text-ink outline-none placeholder:text-ink-faint"
      />
    </label>
  );
}

export function AssistenteDeViagem({
  annualRate,
  hoje: hojeTexto,
  inicial,
  metaId,
}: {
  annualRate: number;
  /** "AAAA-MM-DD", no calendário do Brasil. */
  hoje: string;
  /** Viagem de uma meta que já existe: abre direto no cartão de embarque. */
  inicial?: TripPlan | null;
  metaId?: string | null;
}) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const currency = useCurrency();
  const usaEstimativas = currency === "BRL";
  const { key: tema } = useProfileTheme();
  const { showToast } = useToast();
  const hoje = useMemo(() => {
    const [y, mo, d] = hojeTexto.split("-").map(Number);
    return new Date(y, mo - 1, d, 12);
  }, [hojeTexto]);

  const [plano, setPlano] = useState<TripPlan>(() => inicial ?? VAZIO(hoje));
  const [passo, setPasso] = useState(inicial ? 7 : 1);
  /** Veio do "Ajustar" do cartão: o botão do passo volta direto ao cartão. */
  const [ajustando, setAjustando] = useState(false);
  const [abreAjustar, setAbreAjustar] = useState(false);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState<NovoLugar | null>(null);
  const [fotoDe, setFotoDe] = useState<number | null>(null);
  const [diaDe, setDiaDe] = useState(0);
  const [anoVisto, setAnoVisto] = useState<number | null>(null);
  const [guarda, setGuarda] = useState<number | null>(null);
  /** O plano como está gravado na meta (para saber se mudou depois de criar ou abrir). */
  const [gravado, setGravado] = useState<string | null>(inicial ? JSON.stringify(inicial) : null);
  const [metaAtual, setMetaAtual] = useState<string | null>(metaId ?? null);
  const topo = useRef<HTMLDivElement>(null);

  const [enviando, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  /** "Criar meta" na primeira vez; depois, "Salvar na meta" atualiza a mesma meta. */
  function salvar() {
    const enviado = JSON.stringify(plano);
    const fd = new FormData();
    fd.set("plano", enviado);
    if (metaAtual) fd.set("goalId", metaAtual);
    iniciar(async () => {
      // Sem internet, a ação recusa: vira o aviso de erro da tela, não a tela de erro do app.
      const r: TravelGoalState = await salvarViagemAction({}, fd).catch(() => ({ error: "Não salvou. Sem internet?" }));
      if (r.error || !r.goalId) return setErro(r.error ?? "Não salvou. Tente de novo.");
      setErro(null);
      // A meta nova vive em Metas, fora desta tela: só ela ganha a pílula (14/10/2026).
      if (!metaAtual) showToast("Meta criada");
      setMetaAtual(r.goalId);
      setGravado(enviado);
    });
  }

  const destinos = useMemo(
    () => plano.legs.map((leg) => resolveLegDestination(leg)).filter((d): d is TravelDestination => d !== null),
    [plano.legs],
  );
  const valores = useMemo(() => tripValues(plano, { usaEstimativas }), [plano, usaEstimativas]);
  const mudou = gravado !== null && gravado !== JSON.stringify(plano);
  const metaEmDia = metaAtual !== null && !mudou;

  function mudar(patch: Partial<TripPlan>) {
    setPlano((p) => ({ ...p, ...patch }));
    setGuarda(null);
  }

  function irPara(p: number) {
    setPasso(p);
    setFotoDe(null);
    setNovo(null);
    topo.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  }

  function seguir() {
    if (passo === 1 && plano.legs.length === 0) return;
    if (ajustando) {
      setAjustando(false);
      setAbreAjustar(false);
      return irPara(7);
    }
    if (passo === 1) setDiaDe(0);
    // Padrão: um destino por vez no passo dos dias (o "Continuar" anda pelos destinos primeiro).
    // Faltava andar: o "Continuar" pulava das primeiras para "Quantas pessoas?" e os outros
    // destinos ficavam nos 3 dias de partida sem ela ver (14/10/2026).
    const proximo = proximoDestinoDosDias(passo, tema, diaDe, destinos.length);
    if (proximo !== null) {
      setDiaDe(proximo);
      topo.current?.scrollIntoView({ block: "start" });
      return window.scrollTo({ top: 0 });
    }
    if (passo === 4) setAnoVisto(null);
    irPara(passo + 1);
  }

  function voltar() {
    if (ajustando) {
      setAjustando(false);
      return irPara(7);
    }
    // E o "Voltar" anda de volta pelos destinos do passo dos dias.
    if (passo === 2 && tema === "padrao" && diaDe > 0) {
      setDiaDe(Math.min(diaDe, destinos.length - 1) - 1);
      return window.scrollTo({ top: 0 });
    }
    if (passo === 3) setDiaDe(Math.max(0, plano.legs.length - 1));
    irPara(Math.max(1, passo - 1));
  }

  // ===== Passo 1: para onde =====
  const sugestoes = useMemo(() => {
    const q = busca.trim();
    if (!q) return [];
    const usados = new Set(plano.legs.map((l) => l.destinationKey));
    return searchDestinations(q, 12)
      .filter((d) => !usados.has(d.key))
      .slice(0, 5);
  }, [busca, plano.legs]);
  const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const nomeDigitado = cleanPlaceLabel(busca);
  const achouExato = sugestoes.some((d) => semAcento(d.label) === semAcento(busca)) || destinos.some((d) => semAcento(d.label) === semAcento(busca));
  const cheio = plano.legs.length >= TRIP_LIMITS.maxLegs;

  function adicionar(leg: TripLeg) {
    if (cheio) return;
    mudar({ legs: [...plano.legs, leg] });
    setBusca("");
  }

  function adicionarNovo() {
    if (!novo?.placeType || novo.noBrasil === null || (!novo.noBrasil && !novo.region)) return;
    const custom = { label: cleanPlaceLabel(novo.label), region: (novo.noBrasil ? "Brasil" : novo.region) as TravelRegion, placeType: novo.placeType };
    const key = customKey(custom);
    if (plano.legs.some((l) => l.destinationKey === key)) return setNovo(null);
    adicionar({ destinationKey: key, days: 3, custom });
    // Sem aviso: o destino novo entra na lista.
    setNovo(null);
  }

  function tirar(i: number) {
    const leg = plano.legs[i];
    const fotos = { ...plano.photos };
    delete fotos[leg.destinationKey];
    mudar({ legs: plano.legs.filter((_, k) => k !== i), photos: fotos });
    setFotoDe(null);
  }

  const fotoDoDestino = (d: TravelDestination) => photoFor(d, plano.photos[d.key]);

  function passo1() {
    return (
      <>
        <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface-2 px-3.5 py-3 focus-within:border-accent">
          <Search className="size-[18px] shrink-0 text-ink-faint" aria-hidden />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setNovo(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && sugestoes[0]) {
                e.preventDefault();
                adicionar({ destinationKey: sugestoes[0].key, days: 3 });
              }
            }}
            disabled={cheio}
            placeholder={cheio ? "Até 8 destinos" : "Cidade, ex.: Paris, NY"}
            aria-label="Buscar destino"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
          />
        </div>

        {busca.trim() && (
          <div role="listbox" aria-label="Destinos" className="flex flex-col rounded-3xl border border-border bg-surface p-2">
            {sugestoes.map((d) => (
              <button
                key={d.key}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => adicionar({ destinationKey: d.key, days: 3 })}
                className="flex items-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-surface-2"
              >
                <Foto src={photoFor(d)} tipo={placeTypeFor(d)} className="size-10 shrink-0 rounded-full" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-medium text-ink">{d.label}</b>
                  <small className="block truncate text-caption text-ink-muted">{d.country}</small>
                </span>
              </button>
            ))}
            {!achouExato && nomeDigitado.length >= 3 && !cheio && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setNovo({ label: nomeDigitado, placeType: null, noBrasil: null, region: null });
                  setBusca("");
                }}
                className="flex items-center gap-3 rounded-xl px-1 py-2.5 text-left text-sm font-medium text-accent-strong hover:bg-surface-2"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                  <Plus className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">Usar &ldquo;{nomeDigitado}&rdquo; mesmo assim</span>
              </button>
            )}
            {sugestoes.length === 0 && nomeDigitado.length < 3 && <p className="px-1 py-2 text-caption text-ink-muted">Continue digitando o nome do lugar.</p>}
          </div>
        )}

        {novo && (
          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <b className="min-w-0 flex-1 truncate text-body font-semibold text-ink">{novo.label}</b>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs text-accent-strong">estimativa</span>
              <button type="button" aria-label="Cancelar" onClick={() => setNovo(null)} className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <p className="text-sm font-medium text-ink">Que tipo de lugar?</p>
            <div className="flex flex-wrap gap-2">
              {PLACE_TYPES_TO_PICK.map((t) => (
                <Pilula key={t} ativa={novo.placeType === t} onClick={() => setNovo({ ...novo, placeType: t })}>
                  {PLACE_TYPE_LABEL[t]}
                </Pilula>
              ))}
            </div>
            <div role="group" aria-label="Onde fica?" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
              {[true, false].map((br) => (
                <button
                  key={String(br)}
                  type="button"
                  aria-pressed={novo.noBrasil === br}
                  onClick={() => setNovo({ ...novo, noBrasil: br, region: br ? null : novo.region })}
                  className={`rounded-full px-3 py-2 text-sm transition-colors ${novo.noBrasil === br ? "bg-pill font-medium text-on-pill shadow-premium-sm" : "text-ink-muted"}`}
                >
                  {br ? "No Brasil" : "Fora do Brasil"}
                </button>
              ))}
            </div>
            {novo.noBrasil === false && (
              <>
                <p className="text-sm font-medium text-ink">Em que continente?</p>
                <div className="flex flex-wrap gap-2">
                  {CONTINENTES.map((r) => (
                    <Pilula key={r} ativa={novo.region === r} onClick={() => setNovo({ ...novo, region: r })}>
                      {r}
                    </Pilula>
                  ))}
                </div>
              </>
            )}
            <p className="text-caption text-ink-muted">O custo vira uma estimativa pela região, e a foto vem do tipo de lugar. Dá para trocar a foto depois.</p>
            <Button type="button" onClick={adicionarNovo} disabled={!novo.placeType || novo.noBrasil === null || (!novo.noBrasil && !novo.region)}>
              Adicionar {novo.label}
            </Button>
          </div>
        )}

        {fotoDe !== null && destinos[fotoDe] && (
          <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <b className="min-w-0 flex-1 truncate text-body font-semibold text-ink">Foto de {destinos[fotoDe].label}</b>
              <button type="button" aria-label="Fechar" onClick={() => setFotoDe(null)} className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(() => {
                const d = destinos[fotoDe];
                const opcoes: { id: string; src: string | null }[] = [
                  { id: "auto", src: photoFor(d) },
                  ...TRIP_PHOTOS.filter((f) => bankPhotoSrc(f) !== photoFor(d)).map((f) => ({ id: f as string, src: bankPhotoSrc(f) })),
                ];
                return opcoes.map(({ id, src }) => {
                  const ativa = (plano.photos[d.key] ?? "auto") === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={ativa}
                      aria-label={id === "auto" ? `Foto de ${d.label}` : `Foto ${id.replace("-", " ")}`}
                      onClick={() => {
                        const fotos = { ...plano.photos };
                        if (id === "auto") delete fotos[d.key];
                        else fotos[d.key] = id;
                        setPlano({ ...plano, photos: fotos });
                        setFotoDe(null);
                      }}
                      className={`relative aspect-square overflow-hidden rounded-2xl ${ativa ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
                    >
                      <Foto src={src} tipo={placeTypeFor(d)} className="size-full" />
                      {ativa && (
                        <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                          <Check className="size-3" aria-hidden />
                        </span>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {destinos.length > 0 ? (
          <div className="flex flex-col gap-2">
            {destinos.map((d, i) => (
              <div key={d.key} className="relative flex h-[84px] items-center gap-3 overflow-hidden rounded-3xl px-3.5">
                <Foto src={fotoDoDestino(d)} tipo={placeTypeFor(d)} className="absolute inset-0 size-full" larga />
                <span className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/35 to-black/15" aria-hidden />
                <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-medium text-white">{i + 1}</span>
                <span className="relative min-w-0 flex-1">
                  <b className="block truncate text-body font-semibold text-white">{d.label}</b>
                  {d.custom && <small className="text-caption text-white/85">estimativa</small>}
                </span>
                <button
                  type="button"
                  aria-label={`Trocar a foto de ${d.label}`}
                  onClick={() => {
                    setFotoDe(fotoDe === i ? null : i);
                    setNovo(null);
                  }}
                  className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/85 text-[#1a1815]"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button type="button" aria-label={`Tirar ${d.label}`} onClick={() => tirar(i)} className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/85 text-[#1a1815]">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            <p className="text-caption text-ink-muted">{cheio ? "Até 8 destinos." : `${destinos.length} de 8 destinos`}</p>
          </div>
        ) : (
          !novo && !busca.trim() && <p className="text-caption text-ink-muted">Busque um destino para começar.</p>
        )}
      </>
    );
  }

  // ===== Passo 2: dias =====
  function mudarDias(i: number, dias: number) {
    mudar({ legs: plano.legs.map((l, k) => (k === i ? { ...l, days: dias } : l)) });
  }
  const totalDias = plano.legs.reduce((s, l) => s + l.days, 0);
  const roteiro = `${totalDias} ${totalDias > 1 ? "dias" : "dia"} em ${destinos.length} ${destinos.length > 1 ? "cidades" : "cidade"}`;

  function passo2() {
    if (tema === "padrao") {
      const i = Math.min(diaDe, destinos.length - 1);
      const d = destinos[i];
      if (!d) return null;
      return (
        <>
          <div className="relative aspect-[4/3.7] overflow-hidden rounded-3xl">
            <Foto src={fotoDoDestino(d)} tipo={placeTypeFor(d)} className="absolute inset-0 size-full" larga />
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" aria-hidden />
            <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-caption text-white">{d.label}</span>
            <div className="absolute inset-x-0 bottom-4 flex justify-center">
              <Contador valor={plano.legs[i].days} unidade={plano.legs[i].days > 1 ? "dias" : "dia"} rotulo={`um dia em ${d.label}`} min={1} max={30} onMudar={(v) => mudarDias(i, v)} sobreFoto />
            </div>
          </div>
          {destinos.length > 1 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {destinos.map((x, k) => (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={k === i}
                  onClick={() => setDiaDe(k)}
                  className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${k === i ? "border-ink text-ink" : "border-border bg-surface text-ink-muted"}`}
                >
                  <Foto src={fotoDoDestino(x)} tipo={placeTypeFor(x)} className="size-7 rounded-full" />
                  {x.label} · {plano.legs[k].days}
                </button>
              ))}
            </div>
          )}
          <p className="flex justify-between gap-3 text-sm text-ink-muted">
            <span>Roteiro</span>
            <b className="font-medium text-ink">{roteiro}</b>
          </p>
        </>
      );
    }
    return (
      <>
        <div className="flex flex-col gap-3">
          {destinos.map((d, i) => (
            <div key={d.key} className="relative flex h-[150px] items-end justify-between gap-3 overflow-hidden rounded-3xl p-3.5">
              <Foto src={fotoDoDestino(d)} tipo={placeTypeFor(d)} className="absolute inset-0 size-full" larga />
              <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" aria-hidden />
              <span className="relative min-w-0 flex-1 self-end">
                <b className="line-clamp-2 break-words text-[1.125rem] font-semibold leading-tight text-white">{d.label}</b>
                <small className="block text-caption text-white/85">{d.custom ? "estimativa" : d.country}</small>
              </span>
              <span className="relative">
                <Contador valor={plano.legs[i].days} unidade={plano.legs[i].days > 1 ? "dias" : "dia"} rotulo={`um dia em ${d.label}`} min={1} max={30} onMudar={(v) => mudarDias(i, v)} sobreFoto compacto />
              </span>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-ink-muted">
          Roteiro: <b className="font-semibold text-ink">{roteiro}</b>
        </p>
      </>
    );
  }

  // ===== Passo 3: pessoas =====
  function passo3() {
    const quartos = Math.ceil(plano.travelers / 2);
    return (
      <>
        <div className="flex justify-center rounded-3xl border border-border bg-surface px-4 py-7">
          <Contador valor={plano.travelers} unidade={plano.travelers > 1 ? "pessoas" : "pessoa"} rotulo="uma pessoa" min={TRIP_LIMITS.minTravelers} max={TRIP_LIMITS.maxTravelers} onMudar={(v) => mudar({ travelers: v })} grande />
        </div>
        <p className="text-center text-sm text-ink-muted">
          Conto um quarto para cada duas pessoas ({quartos} {quartos > 1 ? "quartos" : "quarto"}).
        </p>
      </>
    );
  }

  // ===== Passo 4: quando =====
  const [anoEscolhido, mesEscolhido] = plano.tripMonth.split("-").map(Number);
  const ano = anoVisto ?? anoEscolhido;
  const temporadas = useMemo(() => seasonByMonth(plano), [plano]);
  const dica = useMemo(() => cheaperMonthTip(plano, hoje, usaEstimativas), [plano, hoje, usaEstimativas]);
  const ultimoMes = monthFromToday(hoje, MAX_MESES_A_FRENTE);

  function passo4() {
    const corDoMes = { baixa: "bg-success-soft text-ink", media: "bg-surface text-ink", alta: "bg-danger-soft text-ink" } as const;
    return (
      <>
        <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-3.5">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Ano anterior" disabled={ano <= hoje.getFullYear()} onClick={() => setAnoVisto(ano - 1)} className="flex size-10 items-center justify-center rounded-full border border-border text-ink disabled:opacity-30">
              <ChevronLeft className="size-[18px]" aria-hidden />
            </button>
            <b className="text-body font-semibold tabular-nums text-ink">{ano}</b>
            <button type="button" aria-label="Próximo ano" disabled={ano >= Number(ultimoMes.slice(0, 4))} onClick={() => setAnoVisto(ano + 1)} className="flex size-10 items-center justify-center rounded-full border border-border text-ink disabled:opacity-30">
              <ChevronRight className="size-[18px]" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MESES_CURTOS.map((nome, k) => {
              const valor = monthValue(ano, k + 1);
              const fora = monthsAhead(hoje, valor) < 1 || monthsAhead(hoje, valor) > MAX_MESES_A_FRENTE;
              const ativo = ano === anoEscolhido && k + 1 === mesEscolhido;
              const nivel = temporadas[k];
              return (
                <button
                  key={nome}
                  type="button"
                  disabled={fora}
                  aria-pressed={ativo}
                  aria-label={`${MESES[k]} de ${ano}, temporada ${nivel === "media" ? "média" : nivel}`}
                  onClick={() => mudar({ tripMonth: valor })}
                  className={`rounded-2xl border py-2.5 text-sm transition-colors disabled:opacity-30 ${ativo ? "border-ink bg-ink font-semibold text-[var(--color-canvas)]" : `border-transparent ${corDoMes[nivel]}`}`}
                >
                  {nome}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-caption text-ink-muted">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-success-soft ring-1 ring-success/40" />baixa</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-surface ring-1 ring-border-strong" />média</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-danger-soft ring-1 ring-danger/40" />alta</span>
            <span className="ml-auto">
              <Explica rotulo="O que a cor quer dizer?">A cor de cada mês é a temporada do seu roteiro. Na alta, passagem e hotel sobem; na baixa, descem.</Explica>
            </span>
          </div>
        </div>
        {dica && (
          <div className="flex items-center gap-3 rounded-2xl bg-accent-soft px-3.5 py-3">
            <p className="min-w-0 flex-1 text-sm text-ink">
              Em <b className="font-semibold">{nomeDoMes(dica.monthValue)}</b> a mesma viagem sai <b className="font-semibold">{m(dica.savings)}</b> mais barata
            </p>
            <button
              type="button"
              onClick={() => {
                mudar({ tripMonth: dica.monthValue });
                setAnoVisto(null);
              }}
              className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold text-ink shadow-premium-sm"
            >
              Trocar
            </button>
          </div>
        )}
      </>
    );
  }

  // ===== Passo 5: estilo =====
  function passo5() {
    // Protótipo: a régua de Mais simples a Mais conforto, com o nome do meio e o total da viagem
    // mudando junto (os três estilos de sempre, numa régua só).
    const totais = STYLES.map((s) => tripValues({ ...plano, style: s }, { usaEstimativas }).total);
    const ix = Math.max(0, STYLES.indexOf(plano.style));
    return (
      <div className="flex flex-col gap-4" data-regua-estilo>
        <div className="flex flex-col items-center gap-1 rounded-3xl border border-border bg-surface px-4 py-6 text-center">
          <b className="text-[1.375rem] font-medium text-ink">{STYLE_LABEL[STYLES[ix]]}</b>
          <input
            type="range"
            min={0}
            max={STYLES.length - 1}
            step={1}
            value={ix}
            onChange={(e) => mudar({ style: STYLES[Number(e.target.value)] })}
            aria-label="Estilo da viagem"
            aria-valuetext={STYLE_LABEL[STYLES[ix]]}
            className="mt-3 w-full accent-[var(--color-ink)]"
          />
          <div className="flex w-full justify-between text-sm text-ink-muted">
            <span>{STYLE_LABEL[STYLES[0]]}</span>
            <span>{STYLE_LABEL[STYLES[STYLES.length - 1]]}</span>
          </div>
        </div>
        {usaEstimativas && (
          <div className="flex items-baseline justify-between gap-3 px-1">
            <span className="text-sm text-ink-muted">Total da viagem</span>
            <ValorDestaque texto={m(totais[ix])} className="text-[1.5rem] font-normal tabular-nums text-ink" />
          </div>
        )}
      </div>
    );
  }

  // ===== Passo 6: custo =====
  function trocarValor(key: FixedKey, v: number) {
    setPlano((p) => ({ ...p, overrides: { ...p.overrides, [key]: v } }));
    setGuarda(null);
  }
  function voltarAoEstimado(key: FixedKey) {
    const o = { ...plano.overrides };
    delete o[key];
    mudar({ overrides: o });
  }

  function passo6() {
    const linhas = [...BLOCOS.map((b) => valores.fixed[b.key]), ...plano.extras.map((e) => e.value)];
    const maior = Math.max(1, ...linhas);
    return (
      <>
        <div className="flex flex-col gap-1">
          <small className="flex items-center gap-1 text-sm text-ink-muted">
            Até agora
            <Explica rotulo="Como é a estimativa?">
              É uma estimativa. Cada lugar tem um custo médio por dia (hotel, comida e passeios) e uma passagem média saindo do Brasil. A temporada e o estilo mudam a conta. Toque em qualquer valor para pôr o seu.
            </Explica>
          </small>
          <ValorDestaque texto={m(valores.total)} />
        </div>
        {!usaEstimativas && <p className="rounded-xl bg-accent-soft px-3 py-2 text-caption text-accent-strong">As estimativas são em reais. Ponha os seus valores em {currencySymbol(currency)}.</p>}
        <div className="flex flex-col rounded-3xl border border-border bg-surface px-3.5 py-1.5">
          {BLOCOS.map(({ key, label, icon: Icone, cor }) => {
            const trocado = plano.overrides[key] !== undefined;
            return (
              <div key={key} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                {/* Abaixo de 360 px o ícone sai: sem ele, "Hospedagem" e "Alimentação" cabiam cortados. */}
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full max-[359px]:hidden" style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, color: cor }}>
                  <Icone className="size-[18px]" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <b className="text-sm font-medium text-ink">{label}</b>
                    {trocado && (
                      <button type="button" onClick={() => voltarAoEstimado(key)} className="text-caption text-accent-strong underline-offset-2 hover:underline">
                        Voltar ao estimado
                      </button>
                    )}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full rounded-full" style={{ width: `${(valores.fixed[key] / maior) * 100}%`, background: cor }} />
                  </span>
                </span>
                <CampoValor valor={valores.fixed[key]} rotulo={label} onMudar={(v) => trocarValor(key, v)} />
              </div>
            );
          })}
          {plano.extras.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 border-b border-border py-3 last:border-b-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                <Tag className="size-[18px]" aria-hidden />
              </span>
              <input
                value={e.name}
                maxLength={40}
                placeholder="Ex.: seguro"
                aria-label="Nome do custo"
                onChange={(ev) => mudar({ extras: plano.extras.map((x, k) => (k === i ? { ...x, name: ev.target.value.replace(/[<>&"]/g, "") } : x)) })}
                className="min-w-[7.5rem] flex-1 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-accent"
              />
              <CampoValor valor={e.value} rotulo={`Valor de ${e.name || "outro custo"}`} placeholder="0,00" onMudar={(v) => mudar({ extras: plano.extras.map((x, k) => (k === i ? { ...x, value: v } : x)) })} />
              <button type="button" aria-label="Tirar este custo" onClick={() => mudar({ extras: plano.extras.filter((_, k) => k !== i) })} className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface-2">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {plano.extras.length < MAX_EXTRA_CATEGORIES && (
          <button type="button" onClick={() => mudar({ extras: [...plano.extras, { name: "", value: 0 }] })} className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium text-accent-strong">
            <Plus className="size-4" aria-hidden /> Outro custo
          </button>
        )}
        <p className="flex justify-between gap-3 px-1 text-sm text-ink-muted">
          <span>Imprevistos, 10%</span>
          <b className="font-medium tabular-nums text-ink">{m(valores.buffer)}</b>
        </p>
      </>
    );
  }

  // ===== Passo 7: cartão de embarque =====
  const precisa = monthlyForTrip(valores.total, plano.tripMonth, annualRate, hoje);
  const porMes = guarda ?? Math.max(precisa, 0);
  const embarque = boardingMonth(valores.total, porMes, annualRate, hoje);
  const depoisDaViagem = embarque !== null && monthsAhead(hoje, embarque) > monthsAhead(hoje, plano.tripMonth);

  function passo7() {
    const codigos = [{ c: "GRU", n: "São Paulo" }, ...destinos.map((d) => ({ c: airportCodeFor(d), n: d.label }))];
    const rota = codigos.length <= 4 ? codigos : [codigos[0], codigos[1], { c: `+${codigos.length - 3}`, n: codigos.length - 3 > 1 ? "paradas" : "parada" }, codigos[codigos.length - 1]];
    const d0 = destinos[0];
    return (
      <>
        <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-premium-sm">
          <div className="relative h-[150px]">
            {d0 && <Foto src={fotoDoDestino(d0)} tipo={placeTypeFor(d0)} className="absolute inset-0 size-full" larga />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
            <span className="absolute bottom-3 left-3.5 text-body font-medium text-white">{nomeDoMes(plano.tripMonth, true)}</span>
          </div>
          <div className="flex items-start justify-between gap-1 px-4 pt-4">
            {rota.map((x, i) => (
              <div key={`${x.c}-${i}`} className="contents">
                {i > 0 && <Plane className="mt-2 size-4 shrink-0 text-ink-faint" aria-hidden />}
                <span className={`flex min-w-0 flex-col ${i === rota.length - 1 ? "items-end text-right" : i === 0 ? "" : "items-center text-center"}`}>
                  <b className="text-[1.375rem] font-semibold leading-tight tracking-tight text-ink max-[359px]:text-[1.125rem]">{x.c}</b>
                  <small className="break-words text-xs leading-tight text-ink-muted">{x.n}</small>
                </span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-3">
            {[
              ["Pessoas", String(plano.travelers)],
              ["Dias", String(totalDias)],
              ["Estilo", STYLE_LABEL[plano.style]],
            ].map(([k, v]) => (
              <span key={k} className="flex min-w-0 flex-col">
                <small className="text-xs text-ink-muted">{k}</small>
                <b className="truncate text-body font-medium text-ink">{v}</b>
              </span>
            ))}
          </div>
          {/* O picote do cartão de embarque: a linha tracejada com os dois recortes nas pontas. */}
          <div className="relative mx-0 h-0 border-t-2 border-dashed border-border" aria-hidden>
            <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full bg-[var(--color-canvas)]" />
            <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full bg-[var(--color-canvas)]" />
          </div>
          <div className="flex flex-col gap-3 px-4 pb-4 pt-4">
            <div>
              <small className="text-sm text-ink-muted">Total da viagem</small>
              <div>
                <ValorDestaque texto={m(valores.total)} />
              </div>
              <small className="text-sm text-ink-muted">{m(valores.perPerson)} por pessoa</small>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-muted">Guardando</span>
              <span className="flex items-center gap-1.5">
                <button type="button" aria-label={`Guardar ${m(100)} a menos por mês`} onClick={() => setGuarda(stepMonthly(porMes, -1))} className="flex size-10 items-center justify-center rounded-full border border-border text-ink">
                  <Minus className="size-4" aria-hidden />
                </button>
                <ValorDestaque texto={m(porMes)} className="min-w-[4.75rem] justify-center text-[1.125rem] font-medium tabular-nums text-ink" />
                <button type="button" aria-label={`Guardar ${m(100)} a mais por mês`} onClick={() => setGuarda(stepMonthly(porMes, 1))} className="flex size-10 items-center justify-center rounded-full border border-border text-ink">
                  <Plus className="size-4" aria-hidden />
                </button>
              </span>
            </div>
            <p className="text-sm text-ink">
              {embarque ? (
                <>
                  por mês, você embarca em <b className={`font-semibold ${depoisDaViagem ? "text-[var(--color-atencao)]" : ""}`}>{nomeDoMes(embarque)}</b>
                  {depoisDaViagem && <span className="text-[var(--color-atencao)]">, depois do mês da viagem</span>}
                </>
              ) : (
                <>por mês, a viagem fica para daqui a mais de 10 anos</>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {erro && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{erro}</p>}
          {metaEmDia ? (
            <Link href={`/planejamento/metas/${metaAtual}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent-gradient px-4 py-2.5 text-sm font-semibold text-on-accent shadow-premium-sm">
              <Target className="size-[18px]" aria-hidden /> Ver minha meta
            </Link>
          ) : (
            <Button type="button" onClick={salvar} disabled={enviando || valores.total <= 0}>
              {enviando ? "Salvando" : metaAtual ? "Salvar na meta" : "Criar meta"}
            </Button>
          )}
          <Button type="button" variant="secondary" aria-expanded={abreAjustar} onClick={() => setAbreAjustar(!abreAjustar)}>
            Ajustar
          </Button>
          {abreAjustar && (
            <div className="flex flex-wrap gap-2">
              {TRIP_STEP_SHORT.map((t, i) => (
                <Pilula
                  key={t}
                  ativa={false}
                  onClick={() => {
                    setAjustando(true);
                    setDiaDe(0);
                    setAnoVisto(null);
                    irPara(i + 1);
                  }}
                >
                  {t}
                </Pilula>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  const corpo = [passo1, passo2, passo3, passo4, passo5, passo6, passo7][passo - 1]();
  // No cartão de embarque o "Sua viagem" fica só no topo (como no protótipo), sem pergunta.
  const pergunta = passo === 2 && tema === "padrao" && destinos[diaDe] ? `Quantos dias em ${destinos[diaDe].label}?` : passo === 7 ? null : TRIP_STEPS[passo - 1];
  const podeVoltar = passo > 1 && !(passo === 7 && inicial && !ajustando && !mudou);

  return (
    <div ref={topo} className="flex min-h-[calc(100dvh-9.5rem)] flex-col gap-4">
      <div className="flex min-h-10 items-center justify-between">
        {podeVoltar ? (
          <button type="button" onClick={voltar} className="-ml-1 flex items-center gap-1 rounded-full px-1 py-1.5 text-sm text-ink">
            <ChevronLeft className="size-[18px]" aria-hidden /> Voltar
          </button>
        ) : (
          <span />
        )}
        <span className="text-caption text-ink-muted">{passo < 7 ? `${passo} de 6` : "Sua viagem"}</span>
      </div>
      {passo < 7 && (
        <div className="grid grid-cols-6 gap-1.5" aria-hidden>
          {Array.from({ length: 6 }, (_, k) => (
            <i key={k} className={`h-[3px] rounded-full ${k < passo ? "bg-ink" : "bg-border"}`} />
          ))}
        </div>
      )}
      {pergunta ? <h2 className="text-h2 font-medium tracking-tight text-ink">{pergunta}</h2> : <h2 className="sr-only">Sua viagem</h2>}
      {corpo}
      {passo < 7 && (
        <div className="mt-auto pt-4">
          <Button type="button" className="w-full" onClick={seguir} disabled={passo === 1 && plano.legs.length === 0}>
            {ajustando || passo === 6 ? "Ver minha viagem" : "Continuar"}
          </Button>
        </div>
      )}
    </div>
  );
}
