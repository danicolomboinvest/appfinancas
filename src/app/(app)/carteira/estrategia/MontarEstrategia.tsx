"use client";

import { CampoDeDinheiro } from "@/components/ui/CampoDeDinheiro";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { StrategyAssetClass } from "@prisma/client";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { useToast } from "@/components/ui/toast-context";
import { useCurrency, useMoney } from "@/components/money/MoneyProvider";
import { currencySymbol } from "@/lib/money";
import {
  estrategiaDaVersaoNova,
  experienciaPelasEscolhas,
  exteriorNoLongoPrazo,
  faixaDoSonho,
  misturaDoLongo,
  ONDE_JA_INVESTIU,
  perfilPeloComportamento,
  type Faixa,
  type GostoPorProventos,
  type PlanoForaDoBrasil,
  type Sonho,
} from "@/lib/portfolio/estrategia-pelos-sonhos";
import { mesesDeReserva, regraDosAportes } from "@/lib/planning/savings-split";
import { STRATEGY_ASSET_CLASS_COLOR } from "@/lib/portfolio/strategy";
import { confirmarReservaAction, salvarEstrategiaAction } from "./actions";
import { redistribuir } from "@/lib/portfolio/ajuste-da-estrategia";
import { NOME_DA_LINHA, NOME_DO_PERFIL, ORDEM_DAS_LINHAS } from "./nomes";

/**
 * "Montar minha estratégia" (rodada 22, estrategia-proposta.html), uma pergunta por tela:
 * 1. os prazos já estão nas metas; 2. a queda de 15%; 3. onde já investiu (fundo de renda fixa
 * não é renda variável); 4. a reserva, confirmando o VALOR ("Certo?" / "Tenho mais") e mostrando
 * os meses e a regra dos aportes; 5. planos em outra moeda; 6. proventos; 7. a estratégia, com
 * "Usar essa estratégia" e "Ajustar" (as outras classes se ajustam e a soma fica em 100).
 * Nunca sugere guardar a viagem em moeda estrangeira: o exterior é só do longo prazo.
 */
const FAIXA: Record<Faixa, string> = { curto: "Até 2 anos", medio: "2 a 5 anos", longo: "Mais de 5" };

export function MontarEstrategia({
  sonhos,
  totalDaCarteira,
  reserva,
  podeCancelar,
}: {
  sonhos: Sonho[];
  totalDaCarteira: number;
  reserva: { atual: number; meta: number; custoDeVida: number } | null;
  podeCancelar: boolean;
}) {
  const money = useMoney();
  const moedaDoApp = useCurrency();
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [p, setP] = useState(1);
  const [queda, setQueda] = useState<0 | 1 | 2 | null>(null);
  const [onde, setOnde] = useState<string[]>([]);
  const [res, setRes] = useState(reserva?.atual ?? 0);
  const [resOk, setResOk] = useState(false);
  const [tenhoMais, setTenhoMais] = useState(false);
  const [fora, setFora] = useState<PlanoForaDoBrasil | null>(null);
  const [prov, setProv] = useState<GostoPorProventos | null>(null);
  const [ajuste, setAjuste] = useState<Record<StrategyAssetClass, number> | null>(null);
  const [pendente, start] = useTransition();

  const experiencia = experienciaPelasEscolhas(onde);
  const perfil = perfilPeloComportamento({ queda: queda ?? 1, experiencia });
  const sonhosAgora = useMemo(() => sonhos.map((s) => (s.tipo === "reserva" && reserva ? { ...s, falta: Math.max(0, reserva.meta - res) } : s)), [sonhos, reserva, res]);
  const resultado = useMemo(() => estrategiaDaVersaoNova(perfil.profile, sonhosAgora, fora ?? "nao", prov ?? "tanto"), [perfil.profile, sonhosAgora, fora, prov]);
  const meses = reserva ? mesesDeReserva(res, reserva.custoDeVida) : null;
  const regra = reserva ? regraDosAportes(meses, res >= reserva.meta && reserva.meta > 0) : null;
  const longo = misturaDoLongo(perfil.profile, fora ?? "nao", prov ?? "tanto");
  const temReserva = reserva !== null;
  const passos = temReserva ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 5, 6];
  const indice = passos.indexOf(p);

  const avancar = () => setP(indice < passos.length - 1 ? passos[indice + 1] : 7);
  const voltar = () => {
    if (p === 8) return setP(7);
    if (p === 7) return setP(passos[passos.length - 1]);
    if (indice <= 0) return podeCancelar ? router.push("/carteira/estrategia") : null;
    setP(passos[indice - 1]);
  };

  const salvar = (valores: Record<StrategyAssetClass, number>, nomePerfil: string) =>
    start(async () => {
      const r = await salvarEstrategiaAction(valores, nomePerfil);
      if (!r.ok) return showError(r.erro ?? "Não consegui salvar.");
      showToast("Estratégia salva");
      router.push("/carteira/estrategia");
      router.refresh();
    });

  let corpo: React.ReactNode = null;
  let ok = true;
  let botao = "Continuar";
  if (p === 1) {
    botao = "Está certo";
    corpo = (
      <>
        <HeroiDoTema>
          <p className="text-[14px] text-heroi-suave">Sua estratégia começa aqui</p>
          <p className="titulo-tema text-[24px] font-light leading-tight">Seus prazos já estão nas suas metas</p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {(["curto", "medio", "longo"] as Faixa[]).map((f) => (
              <div key={f} className="vidro-heroi flex min-w-0 flex-col gap-1.5 rounded-2xl p-2.5">
                <span className="text-[12px] text-heroi-suave">{FAIXA[f]}</span>
                {sonhosAgora.filter((s) => faixaDoSonho(s) === f).map((s) => (
                  <span key={s.id} className="break-words text-[13px] font-medium leading-tight">
                    {s.nome}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </HeroiDoTema>
        <p className="px-1 text-[13px] text-ink-muted">Meta sem data fica em 2 a 5 anos. Para mudar uma data, ajuste a meta em Metas.</p>
      </>
    );
  } else if (p === 2) {
    ok = queda !== null;
    corpo = (
      <>
        <HeroiDoTema>
          <p className="text-[14px] text-heroi-suave">Se a sua carteira caísse 15% num mês</p>
          <p className="text-[2.25rem] font-light leading-none tracking-[-0.03em] tabular-nums">{money(totalDaCarteira * 0.85, { round: true })}</p>
          <p className="text-[14px] text-heroi-suave">era {money(totalDaCarteira, { round: true })}</p>
        </HeroiDoTema>
        <p className="px-1 text-[18px] text-ink">O que você faria?</p>
        <div className="flex flex-col gap-2">
          {(["Venderia tudo", "Seguraria, tensa", "Aproveitaria para comprar mais"] as const).map((t, v) => (
            <Cartao key={t} titulo={t} on={queda === v} onClick={() => { setQueda(v as 0 | 1 | 2); setP(3); }} />
          ))}
        </div>
      </>
    );
  } else if (p === 3) {
    ok = onde.length > 0;
    const rv = ONDE_JA_INVESTIU.find((o) => o.rendaVariavel && onde.includes(o.chave));
    corpo = (
      <>
        <HeroiDoTema>
          <p className="text-[14px] text-heroi-suave">Pode marcar mais de um</p>
          <p className="titulo-tema text-[24px] font-light leading-tight">Onde você já investiu?</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {ONDE_JA_INVESTIU.map((o) => {
              const on = onde.includes(o.chave);
              return (
                <button
                  key={o.chave}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setOnde(o.chave === "nunca" ? (on ? [] : ["nunca"]) : on ? onde.filter((k) => k !== o.chave) : [...onde.filter((k) => k !== "nunca"), o.chave])}
                  className={`min-h-10 rounded-full px-3.5 text-[14px] ${on ? "bg-ink font-medium text-surface" : "heroi-veu"}`}
                >
                  {o.nome}
                </button>
              );
            })}
          </div>
        </HeroiDoTema>
        <p className="px-1 text-[13px] text-ink-muted">{rv ? `${rv.nome} conta como renda variável. Seu perfil pode subir.` : onde.includes("fundorf") ? "Fundo de renda fixa não é renda variável." : "Marque o que você já teve, mesmo que pouco."}</p>
      </>
    );
  } else if (p === 4 && reserva) {
    ok = resOk || tenhoMais;
    const pc = reserva.meta > 0 ? Math.min(1, res / reserva.meta) : 0;
    const C = 2 * Math.PI * 44;
    corpo = (
      <>
        <HeroiDoTema>
          <p className="text-[14px] text-heroi-suave">Você tem guardado de reserva</p>
          {tenhoMais ? (
            <label className="flex items-baseline gap-2">
              <span className="text-[15px] text-heroi-suave">{currencySymbol(moedaDoApp)}</span>
              <CampoDeDinheiro
                autoFocus
                aria-label="Quanto você tem de reserva"
                placeholder="0,00"
                valor={res}
                onValor={(v) => setRes(v ?? 0)}
                className="min-w-0 flex-1 bg-transparent text-[2.25rem] font-light tabular-nums outline-none"
              />
            </label>
          ) : (
            <p className="text-[2.25rem] font-light leading-none tracking-[-0.03em] tabular-nums">{money(res, { round: true })}</p>
          )}
          {!tenhoMais && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[15px]">Certo?</span>
              <button type="button" onClick={() => { setResOk(true); avancar(); }} className="min-h-11 rounded-full bg-surface px-4 text-[14px] font-medium text-ink">
                Sim, é isso
              </button>
              <button type="button" onClick={() => setTenhoMais(true)} className="min-h-11 rounded-full bg-surface px-4 text-[14px] font-medium text-ink">
                Tenho mais
              </button>
            </div>
          )}
        </HeroiDoTema>
        <div className="glass flex items-center gap-4 rounded-3xl p-4">
          <svg viewBox="0 0 100 100" className="size-20 shrink-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-surface-2)" strokeWidth="9" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--color-dinheiro-guardou)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${C * pc} ${C}`} />
          </svg>
          <div className="min-w-0">
            <p className="text-[13px] text-ink-muted">Isso cobre</p>
            <p className="text-[20px] font-medium tabular-nums text-ink">{meses === null ? "?" : `${meses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${meses >= 1.95 ? "meses" : "mês"}`}</p>
            <p className="flex items-center gap-1 text-[13px] text-ink-muted">
              dos seus gastos
              <Explica>{`Seu gasto do mês, na sua reserva: ${money(reserva.custoDeVida, { round: true })}. A reserva completa é a sua meta: ${money(reserva.meta, { round: true })}.`}</Explica>
            </p>
          </div>
        </div>
        {regra && (
          <div className="glass flex flex-col gap-2 rounded-3xl p-4">
            <p className="text-[15px] font-medium text-ink">Seus próximos aportes</p>
            <span className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              {regra.reserva > 0 && <span className="h-full" style={{ flexGrow: regra.reserva, background: "var(--color-dinheiro-guardou)" }} />}
              {regra.sonhos > 0 && <span className="h-full" style={{ flexGrow: regra.sonhos, background: "var(--color-strat-acoes)" }} />}
            </span>
            <div className="flex justify-between text-[13px] text-ink-muted">
              <span>
                Reserva <b className="font-medium text-ink">{regra.reserva}%</b>
              </span>
              <span>
                Metas e liberdade <b className="font-medium text-ink">{regra.sonhos}%</b>
              </span>
            </div>
            <p className="text-[12.5px] text-ink-muted">
              {regra.faixa === "curta" ? "Até 3 meses, tudo vai para a reserva." : regra.faixa === "completa" ? "Sua reserva já está completa. Agora o dinheiro vai para os seus sonhos." : "De 3 meses até a meta, 70% reserva e 30% sonhos."}
            </p>
          </div>
        )}
      </>
    );
  } else if (p === 5) {
    ok = fora !== null;
    corpo = (
      <>
        <HeroiDoTema>
          <p className="text-[14px] text-heroi-suave">Na sua Liberdade</p>
          <p className="titulo-tema text-[24px] font-light leading-tight">Você tem planos em outra moeda?</p>
          <div className="flex justify-between text-[14px]">
            <span>
              Brasil <b className="font-medium">{100 - longo.EXTERIOR}%</b>
            </span>
            <span>
              Exterior <b className="font-medium">{longo.EXTERIOR}%</b>
            </span>
          </div>
          <span className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            <span className="h-full heroi-veu-forte" style={{ flexGrow: 100 - longo.EXTERIOR }} />
            <span className="h-full" style={{ flexGrow: longo.EXTERIOR, background: STRATEGY_ASSET_CLASS_COLOR.EXTERIOR }} />
          </span>
        </HeroiDoTema>
        <div className="flex flex-col gap-2">
          {([["morar", "Morar ou estudar fora"], ["viajar", "Viajar com frequência"], ["nao", "Não"]] as [PlanoForaDoBrasil, string][]).map(([k, t]) => (
            <Cartao key={k} titulo={t} sub={`${exteriorNoLongoPrazo(perfil.profile, k)}% fora do Brasil no longo prazo`} on={fora === k} onClick={() => setFora(k)} />
          ))}
        </div>
      </>
    );
  } else if (p === 6) {
    ok = prov !== null;
    botao = "Ver minha estratégia";
    corpo = (
      <>
        <HeroiDoTema>
          <p className="text-[14px] text-heroi-suave">FIIs pagam quase todo mês</p>
          <p className="titulo-tema text-[24px] font-light leading-tight">Quer que parte do dinheiro pague você todo mês?</p>
        </HeroiDoTema>
        <div className="flex flex-col gap-2">
          <Cartao titulo="Sim, gosto de proventos" sub="Mais FIIs no longo prazo" on={prov === "sim"} onClick={() => setProv("sim")} />
          <Cartao titulo="Tanto faz" sub="Fica como o perfil" on={prov === "tanto"} onClick={() => setProv("tanto")} />
        </div>
      </>
    );
  } else if (p === 7) {
    const v = resultado.valores;
    corpo = (
      <>
        <HeroiDoTema>
          <p className="text-[14px] text-heroi-suave">Perfil</p>
          <p className="titulo-tema text-[34px] font-light leading-none">{NOME_DO_PERFIL[perfil.profile]}</p>
          <Barra v={v} />
          <div className="flex justify-between text-[14px]">
            <span>
              Brasil <b className="font-medium">{100 - v.EXTERIOR}%</b>
            </span>
            <span>
              Exterior <b className="font-medium">{v.EXTERIOR}%</b>
            </span>
          </div>
        </HeroiDoTema>
        <ul className="glass flex flex-col rounded-3xl px-4">
          {ORDEM_DAS_LINHAS.filter((c) => v[c] > 0).map((c) => (
            <li key={c} className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0">
              <span className="size-2.5 rounded-full" style={{ background: STRATEGY_ASSET_CLASS_COLOR[c] }} aria-hidden />
              <span className="flex-1 text-[15px] text-ink">{NOME_DA_LINHA[c]}</span>
              <span className="text-[15px] font-medium tabular-nums text-ink">{v[c]}%</span>
            </li>
          ))}
        </ul>
        <p className="px-1 text-[14px] text-ink-muted">{perfil.reason}</p>
        {regra && (
          <div className="glass rounded-3xl p-4">
            <p className="text-[13px] text-ink-muted">Seus aportes</p>
            <p className="text-[15px] font-medium text-ink">{regra.faixa === "curta" ? "100% para a reserva, até 3 meses" : regra.faixa === "completa" ? "100% para os seus sonhos" : "70% reserva, 30% sonhos"}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" disabled={pendente} onClick={() => salvar(v, perfil.profile)} className="min-h-12 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-40">
            Usar essa estratégia
          </button>
          <button type="button" onClick={() => { setAjuste({ ...v }); setP(8); }} className="min-h-12 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
            Ajustar
          </button>
        </div>
      </>
    );
  } else if (p === 8 && ajuste) {
    corpo = (
      <>
        <section className="glass flex flex-col gap-3 rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-[16px] font-medium text-ink">Sua mistura</p>
            <span className="text-[13px] text-success">Soma {ORDEM_DAS_LINHAS.reduce((s, c) => s + ajuste[c], 0)}%</span>
          </div>
          {ORDEM_DAS_LINHAS.filter((c) => c !== "OUTROS" || ajuste.OUTROS > 0).map((c) => (
            <label key={c} className="flex flex-col gap-1">
              <span className="flex justify-between text-[14px] text-ink">
                <span className="flex items-center gap-2">
                  <i className="size-2.5 rounded-full" style={{ background: STRATEGY_ASSET_CLASS_COLOR[c] }} />
                  {NOME_DA_LINHA[c]}
                </span>
                <b className="font-medium tabular-nums">{ajuste[c]}%</b>
              </span>
              <input type="range" min={0} max={100} step={1} value={ajuste[c]} onChange={(e) => setAjuste(redistribuir(ajuste, c, Number(e.target.value)))} aria-label={NOME_DA_LINHA[c]} className="w-full" style={{ accentColor: STRATEGY_ASSET_CLASS_COLOR[c] }} />
            </label>
          ))}
        </section>
        <div className="flex flex-col gap-2">
          <button type="button" disabled={pendente} onClick={() => salvar(ajuste, "personalizado")} className="min-h-12 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-40">
            Salvar estratégia
          </button>
          <button type="button" onClick={() => setAjuste({ ...resultado.valores })} className="min-h-12 rounded-full bg-surface-2 text-[15px] font-medium text-ink">
            Voltar ao sugerido
          </button>
        </div>
      </>
    );
  }

  const noFluxo = p <= 6;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {indice > 0 || p >= 7 || podeCancelar ? (
          <button type="button" onClick={voltar} className="-ml-1 inline-flex min-h-11 items-center gap-1 text-[14px] text-ink-muted">
            <ChevronLeft size={18} /> {indice === 0 && p <= 6 ? "Cancelar" : "Voltar"}
          </button>
        ) : (
          <span />
        )}
        <span className="text-[13px] tabular-nums text-ink-muted">{noFluxo ? `Sua estratégia · ${indice + 1} de ${passos.length}` : p === 7 ? "Sua estratégia" : "Ajustar"}</span>
      </div>
      {noFluxo && (
        <div className="flex gap-1" aria-hidden>
          {passos.map((x, k) => (
            <span key={x} className={`h-1 flex-1 rounded-full ${k <= indice ? "bg-ink" : "bg-surface-2"}`} />
          ))}
        </div>
      )}
      {corpo}
      {noFluxo && p !== 2 && !(p === 4 && !tenhoMais) && (
        <button
          type="button"
          disabled={!ok}
          onClick={() => {
            if (p === 4 && tenhoMais) void confirmarReservaAction(res);
            avancar();
          }}
          className="min-h-12 rounded-full bg-accent-gradient text-[15px] font-medium text-on-accent disabled:opacity-40"
        >
          {botao}
        </button>
      )}
    </div>
  );
}


function Barra({ v }: { v: Record<StrategyAssetClass, number> }) {
  return (
    <span className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
      {ORDEM_DAS_LINHAS.filter((c) => v[c] > 0).map((c) => (
        <span key={c} className="h-full" style={{ flexGrow: v[c], background: STRATEGY_ASSET_CLASS_COLOR[c] }} />
      ))}
    </span>
  );
}

function Cartao({ titulo, sub, on, onClick }: { titulo: string; sub?: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`flex min-h-14 w-full flex-col justify-center rounded-2xl border px-4 py-3 text-left ${on ? "border-transparent bg-ink text-surface" : "glass border-transparent text-ink"}`}>
      <span className="text-[15px] font-medium">{titulo}</span>
      {sub && <span className={`text-[12.5px] ${on ? "opacity-80" : "text-ink-muted"}`}>{sub}</span>}
    </button>
  );
}
