"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText, FileUp, MoreHorizontal, PencilLine, PiggyBank, Plus, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { NUMERO_DESTAQUE, PrefixoPequeno, separarPrefixo } from "@/components/ui/ValorDestaque";
import { useToast } from "@/components/ui/toast-context";
import { useMoney } from "@/components/money/MoneyProvider";
import { PortfolioImport } from "@/components/import/PortfolioImport";
import { IrpfImport } from "@/components/import/IrpfImport";
import type { AssetClass, AssetObjective, FixedIncomeIndex } from "@prisma/client";
import type { ResumoDaCarteira } from "@/lib/portfolio/resumo-carteira";
import { pesoInteiro } from "@/lib/portfolio/resumo-carteira";
import type { Onde, Tipo } from "@/lib/portfolio/classificacao";
import type { EstadoDaAssessoria } from "@/lib/assessoria/estado";
import { AssetForm } from "./AssetForm";
import { ABRIR_NOVO_ATIVO } from "./novo-ativo";
import { updatePortfolioQuotesAction } from "./quotes-actions";
import { LogoDoAtivo } from "@/components/ui/LogoDoAtivo";
import { COR_DO_GRUPO } from "./cores-dos-grupos";
import { ConviteDaAssessoria } from "./ConviteDaAssessoria";
import { DetalheDoAtivo } from "./DetalheDoAtivo";
import { NovoAtivo, type TituloParaBusca } from "./NovoAtivo";
import type { NumeroDeFora, PrecoDoTitulo } from "./dados";

export type AtivoDaTela = {
  id: string;
  name: string;
  ticker: string | null;
  assetClass: AssetClass;
  objective: AssetObjective;
  goalId: string | null;
  quantity: number | null;
  currentUnitPrice: number | null;
  investedValue: number | null;
  currentValue: number;
  fixedIncomeIndex: FixedIncomeIndex | null;
  currency: string;
  nativeCurrentValue: number | null;
  nativeInvestedValue: number | null;
  exchangeRate: number | null;
  tipoEscolhido: string | null;
  ondeEscolhido: string | null;
  /** Taxa da compra em fração, lida com o indexador (ver lib/portfolio/taxa-compra.ts). */
  taxaCompra: number | null;
  /** "Renda fixa pós · Brasil". */
  classificacao: string;
  classificacaoEscolhida: boolean;
  tipo: Tipo;
  onde: Onde;
  atualizadoEm: string;
};

export type SugestaoDeAporte = { chave: string; nome: string; ativo: string | null; valor: number; cor: string };

type Aportes = {
  mes: string;
  guardou: number;
  planejado: number;
  pendente: number;
  sugestao: SugestaoDeAporte[];
  regra: "curta" | "montando" | "completa" | null;
  registrar: ReactNode;
};

/** "R$ 41.569,51" com os centavos pequenos, como no protótipo. */
function ValorComCentavos({ texto, className = NUMERO_DESTAQUE }: { texto: string; className?: string }) {
  const [prefixo, numero] = separarPrefixo(texto);
  const i = numero.lastIndexOf(",");
  return (
    <span className={`inline-flex items-baseline ${className}`}>
      {prefixo && <PrefixoPequeno>{prefixo}</PrefixoPequeno>}
      {i > 0 ? numero.slice(0, i) : numero}
      {i > 0 && <span className="text-[0.45em] tracking-normal opacity-80">{numero.slice(i)}</span>}
    </span>
  );
}

/** A linha fina da evolução (12 meses): só com pelo menos dois meses de verdade. */
function LinhaDaEvolucao({ serie }: { serie: { rotulo: string; valor: number }[] }) {
  if (serie.length < 2) return null;
  const min = Math.min(...serie.map((p) => p.valor));
  const max = Math.max(...serie.map((p) => p.valor));
  const faixa = max - min || 1;
  const pts = serie.map((p, i) => [(i / (serie.length - 1)) * 300, 34 - ((p.valor - min) / faixa) * 30] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ux, uy] = pts[pts.length - 1];
  return (
    <div className="flex flex-col gap-1">
      <svg viewBox="-2 0 304 40" className="h-10 w-full overflow-visible" preserveAspectRatio="none" aria-label={`Evolução de ${serie[0].rotulo} até hoje`} role="img">
        <path d={d} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        <circle cx={ux} cy={uy} r={2.6} fill="var(--color-heroi-destaque, currentColor)" />
      </svg>
      <div className="flex justify-between text-[12px] text-heroi-suave">
        <span>{serie[0].rotulo}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

export function MeusAtivos({
  ativos,
  resumo,
  serie,
  metas,
  empresa,
  comAporteRecente,
  aportes,
  proventosDoAtivo,
  caiuHoje,
  titulos,
  cdi,
  novoAtivo,
  assessoria,
}: {
  ativos: AtivoDaTela[];
  resumo: ResumoDaCarteira;
  serie: { rotulo: string; valor: number }[];
  metas: { id: string; nome: string }[];
  empresa: boolean;
  comAporteRecente: string[];
  aportes: Aportes;
  proventosDoAtivo: Record<string, { colunas: number[]; total: number }>;
  caiuHoje: { ticker: string; valor: number }[];
  titulos: Record<string, PrecoDoTitulo>;
  cdi: NumeroDeFora | null;
  novoAtivo: { titulos: TituloParaBusca[]; cdi: NumeroDeFora | null; cdiFracao: number | null; ipca: NumeroDeFora | null; ipcaFracao: number | null };
  assessoria: EstadoDaAssessoria | null;
}) {
  const money = useMoney();
  const { showToast, showError } = useToast();
  const [grupoAberto, setGrupoAberto] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [folha, setFolha] = useState<null | "aportes" | "novo" | "importar" | "mais" | "irpf" | "manual">(null);
  const [registrando, setRegistrando] = useState(false);
  const [atualizando, startAtualizar] = useTransition();
  const porId = useMemo(() => new Map(ativos.map((a) => [a.id, a])), [ativos]);
  const vazia = ativos.length === 0;

  // O cartão do aporte ("o ativo ainda não está aqui? Cadastre primeiro") pede o Novo ativo.
  // "Já aportei" (Estratégia › Seus próximos aportes) chega com ?aportes=1: abre a folha Aportes.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("aportes") !== "1") return;
    const id = setTimeout(() => {
      setFolha("aportes");
      setRegistrando(Boolean(aportes.registrar));
    }, 0);
    window.history.replaceState(null, "", "/carteira");
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na chegada
  }, []);

  useEffect(() => {
    const abrir = () => setFolha("novo");
    window.addEventListener(ABRIR_NOVO_ATIVO, abrir);
    return () => window.removeEventListener(ABRIR_NOVO_ATIVO, abrir);
  }, []);

  const ganho = resumo.ganho;
  const perdeu = ganho !== null && ganho < 0;
  const dolar = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function atualizarCotacoes() {
    startAtualizar(async () => {
      const r = await updatePortfolioQuotesAction();
      if (!r.ok) return showError(r.error);
      showToast(r.failed.length > 0 ? `${r.updated} atualizadas. Não achei: ${r.failed.join(", ")}` : `${r.updated} cotações atualizadas`);
    });
  }

  const atalhos = [
    { chave: "aportes" as const, rotulo: "Aportes", icone: PiggyBank, extra: aportes.pendente > 0 ? money(aportes.pendente, { round: true }) : null },
    { chave: "novo" as const, rotulo: "Novo ativo", icone: Plus, extra: null },
    { chave: "importar" as const, rotulo: "Importar", icone: FileUp, extra: null },
    { chave: "mais" as const, rotulo: "Mais", icone: MoreHorizontal, extra: null },
  ];

  const aberto = detalhe ? porId.get(detalhe) ?? null : null;

  return (
    <div className="flex flex-col gap-5">
      {vazia ? (
        <HeroiDoTema>
          <p className="text-[15px] text-heroi-suave">Sua carteira</p>
          <p className="titulo-tema text-[26px] font-light leading-tight">Comece pelo que você já tem</p>
          <p className="text-[14px] text-heroi-suave">Tesouro, CDB, caixinha, ações ou fundos. Você procura pelo nome e o app separa sozinho.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => setFolha("novo")} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-gradient px-5 text-[15px] font-medium text-on-accent">
              <Plus size={16} /> Adicionar investimento
            </button>
            <button type="button" onClick={() => setFolha("importar")} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium heroi-veu">
              Importar da B3
            </button>
          </div>
        </HeroiDoTema>
      ) : (
        <HeroiDoTema>
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] text-heroi-suave">Sua carteira</p>
            <Explica noHeroi>
              {resumo.exterior > 0 && resumo.cambio
                ? `O total soma o Brasil e o Exterior, já convertido em reais pela cotação do dólar (US$ 1 = ${money(resumo.cambio)}). O ganho compara com o que você investiu.`
                : "O total soma todos os seus investimentos. O ganho compara com o que você investiu."}
            </Explica>
          </div>
          <ValorComCentavos texto={money(resumo.total)} />
          {ganho !== null && resumo.ganhoPct !== null && (
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px]">
              <span
                className="rounded-full px-2.5 py-0.5 text-[13px] font-medium tabular-nums"
                style={{ background: `color-mix(in srgb, var(${perdeu ? "--color-danger" : "--color-success"}) 14%, var(--color-surface))`, color: `var(${perdeu ? "--color-danger" : "--color-success"})` }}
              >
                {(Math.abs(resumo.ganhoPct) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%
              </span>
              <span>{perdeu ? `Perda de ${money(Math.abs(ganho))} desde a compra` : `Ganho de ${money(ganho)} desde a compra`}</span>
            </p>
          )}
          <LinhaDaEvolucao serie={serie} />
          {resumo.exterior > 0 && (
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="vidro-heroi flex min-w-0 flex-col gap-1.5 rounded-2xl p-3.5">
                <span className="text-[13px] text-heroi-suave">Brasil</span>
                <span className="text-[19px] font-medium tabular-nums leading-tight">{money(resumo.brasil, { round: true })}</span>
              </div>
              <div className="vidro-heroi flex min-w-0 flex-col gap-1 rounded-2xl p-3.5">
                <span className="flex items-center justify-between gap-2 text-[13px] text-heroi-suave">
                  Exterior
                  <Explica noHeroi>
                    {resumo.cambio
                      ? `Seus investimentos fora do Brasil, em dólar. Em reais pela cotação de hoje: US$ 1 = ${money(resumo.cambio)}.`
                      : "Seus investimentos fora do Brasil, já somados no total em reais."}
                  </Explica>
                </span>
                <span className="text-[19px] font-medium tabular-nums leading-tight">{resumo.exteriorEmDolar !== null ? dolar(resumo.exteriorEmDolar) : money(resumo.exterior, { round: true })}</span>
                {resumo.exteriorEmDolar !== null && <span className="text-[12.5px] tabular-nums text-heroi-suave">≈ {money(resumo.exterior, { round: true })}</span>}
              </div>
            </div>
          )}
        </HeroiDoTema>
      )}

      {!vazia && (
        <div className="grid grid-cols-4 gap-1">
          {atalhos.map(({ chave, rotulo, icone: Icone, extra }) => (
            <button key={chave} type="button" onClick={() => setFolha(chave)} className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl py-1 text-center">
              <span className="glass flex size-12 items-center justify-center rounded-full text-accent-strong">
                <Icone size={20} strokeWidth={1.7} />
              </span>
              <span className="text-[13px] leading-tight text-ink">{rotulo}</span>
              {extra && <span className="-mt-1 text-[12px] font-medium tabular-nums text-accent-strong">{extra}</span>}
            </button>
          ))}
        </div>
      )}

      {caiuHoje.length > 0 && (
        <a href="/carteira/proventos" className="flex min-h-11 items-center justify-between gap-3 rounded-2xl px-1 text-[14px] text-ink">
          <span>
            Caiu {money(caiuHoje.reduce((s, c) => s + c.valor, 0))} de {caiuHoje.map((c) => c.ticker).join(" e ")} hoje
          </span>
          <ChevronRight size={16} className="shrink-0 text-ink-faint" />
        </a>
      )}

      {!vazia && (
        <section className="glass rounded-3xl px-4 pt-4 pb-1.5" aria-label="Por tipo">
          <div className="flex items-center justify-between gap-3 px-0.5">
            <h2 className="text-[17px] font-medium text-ink">Por tipo</h2>
            <Explica>Cada tipo com quanto você tem e o peso na carteira. Toque para ver os ativos. Se o app classificou algo errado, abra o ativo e toque em Trocar.</Explica>
          </div>
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded" aria-hidden>
            {resumo.grupos.map((g) => (
              <span key={g.grupo} className="h-full rounded-[4px] opacity-85 transition-[flex-grow] duration-700" style={{ flexGrow: Math.max(g.peso, 0.005), background: COR_DO_GRUPO[g.grupo] }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-col">
            {resumo.grupos.map((g) => {
              const abertoG = grupoAberto === g.grupo;
              const sub =
                g.grupo === "exterior" && g.emDolar > 0 && g.naB3 > 0
                  ? `${g.emDolar} em dólar · ${g.naB3} na B3`
                  : `${g.ativos.length} ${g.ativos.length === 1 ? "ativo" : "ativos"}`;
              return (
                <li key={g.grupo} className="border-t border-border first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setGrupoAberto(abertoG ? null : g.grupo)}
                    aria-expanded={abertoG}
                    className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto_16px] items-center gap-3 py-[11px] text-left"
                  >
                    <span className="flex size-8 items-center justify-center rounded-[10px]" style={{ background: `color-mix(in srgb, ${COR_DO_GRUPO[g.grupo]} 14%, var(--color-surface))` }} aria-hidden>
                      <span className="size-2.5 rounded-[3px]" style={{ background: COR_DO_GRUPO[g.grupo] }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-ink">{g.nome}</span>
                      <span className="block truncate text-[12.5px] text-ink-muted">{sub}</span>
                    </span>
                    <span className="text-right">
                      <span className="block whitespace-nowrap text-[15px] font-medium tabular-nums text-ink">
                        <ValorSemCentavos texto={money(g.valor, { round: true })} />
                      </span>
                      <span className="block text-[12.5px] font-medium tabular-nums text-ink-muted">{pesoInteiro(g.peso)}</span>
                    </span>
                    {abertoG ? <ChevronDown size={14} className="text-ink-muted" /> : <ChevronRight size={14} className="text-ink-muted" />}
                  </button>
                  {abertoG && (
                    <ul className="mb-2 ml-11 flex flex-col">
                      {g.ativos.map((id) => {
                        const a = porId.get(id)!;
                        const lucro = a.investedValue !== null && a.investedValue > 0 ? (a.currentValue - a.investedValue) / a.investedValue : null;
                        return (
                          <li key={id} className="border-t border-border">
                            <button type="button" onClick={() => setDetalhe(id)} className="flex w-full items-center gap-2.5 py-2 text-left">
                              <LogoDoAtivo nome={a.name} ticker={a.ticker} rendaFixa={a.assetClass === "TESOURO_DIRETO" || a.assetClass === "RENDA_FIXA"} cor={COR_DO_GRUPO[g.grupo]} tamanho={28} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-ink">{nomeCurto(a)}</span>
                                {a.investedValue !== null && a.investedValue > 0 && (
                                  <span className="block text-[12px] leading-tight text-ink-muted">investiu <span className="whitespace-nowrap">{money(a.investedValue, { round: true })}</span></span>
                                )}
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block whitespace-nowrap text-[14px] font-medium tabular-nums text-ink">
                                  <ValorSemCentavos texto={money(a.currentValue, { round: true })} pequeno />
                                </span>
                                {lucro !== null && Math.abs(lucro) >= 0.0005 && (
                                  <span className={`block whitespace-nowrap text-[12px] font-medium tabular-nums ${lucro < 0 ? "text-danger" : "text-success"}`}>
                                    {lucro < 0 ? "perda" : "ganho"} de {(Math.abs(lucro) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {assessoria && <ConviteDaAssessoria estado={assessoria} />}

      <Modal open={aberto !== null} onClose={() => setDetalhe(null)} title={aberto ? (aberto.ticker ?? nomeCurto(aberto)) : ""}>
        {aberto && (
          <DetalheDoAtivo
            ativo={aberto}
            metas={metas}
            proventos={aberto.ticker ? (proventosDoAtivo[aberto.ticker.toUpperCase()] ?? null) : null}
            titulo={titulos[aberto.id] ?? null}
            cdi={cdi}
            temAporteRecente={comAporteRecente.includes(aberto.id)}
            onFechar={() => setDetalhe(null)}
          />
        )}
      </Modal>

      <Modal open={folha === "aportes"} onClose={() => { setFolha(null); setRegistrando(false); }} title="Aportes">
        <FolhaDeAportes aportes={aportes} registrando={registrando} onRegistrar={() => setRegistrando(true)} onFechar={() => setFolha(null)} />
      </Modal>

      <Modal open={folha === "novo"} onClose={() => setFolha(null)} title="Novo ativo">
        <NovoAtivo
          metas={metas}
          totalAntes={resumo.total}
          {...novoAtivo}
          onImportar={() => setFolha("importar")}
          onManual={() => setFolha("manual")}
          onFechar={() => setFolha(null)}
        />
      </Modal>

      <Modal open={folha === "manual"} onClose={() => setFolha(null)} title="Adicionar do meu jeito">
        <AssetForm goals={metas.map((m) => ({ id: m.id, name: m.nome }))} submitLabel="Adicionar" onSuccess={() => setFolha(null)} />
      </Modal>

      <Modal open={folha === "importar"} onClose={() => setFolha(null)} title="Importar da B3">
        <PortfolioImport onDone={() => setFolha(null)} />
      </Modal>

      <Modal open={folha === "mais"} onClose={() => setFolha(null)} title="Mais">
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {ativos.some((a) => a.ticker) && (
            <button type="button" onClick={() => { setFolha(null); atualizarCotacoes(); }} disabled={atualizando} className="flex min-h-12 items-center gap-3 px-4 py-3 text-left text-[15px] text-ink hover:bg-surface-2 disabled:opacity-60">
              <RefreshCw size={18} strokeWidth={1.7} className={`text-accent-strong ${atualizando ? "animate-spin" : ""}`} aria-hidden />
              <span className="flex-1">{atualizando ? "Atualizando..." : "Atualizar cotações"}</span>
            </button>
          )}
          <button type="button" onClick={() => setFolha("irpf")} className="flex min-h-12 items-center gap-3 px-4 py-3 text-left text-[15px] text-ink hover:bg-surface-2">
            <FileText size={18} strokeWidth={1.7} className="text-accent-strong" aria-hidden />
            <span className="flex-1">Preço médio pela declaração do IR</span>
            <ChevronRight size={16} className="text-ink-faint" aria-hidden />
          </button>
          <button type="button" onClick={() => setFolha("manual")} className="flex min-h-12 items-center gap-3 px-4 py-3 text-left text-[15px] text-ink hover:bg-surface-2">
            <PencilLine size={18} strokeWidth={1.7} className="text-accent-strong" aria-hidden />
            <span className="flex-1">Adicionar do meu jeito</span>
            <ChevronRight size={16} className="text-ink-faint" aria-hidden />
          </button>
        </div>
        {empresa && <p className="mt-3 text-[13px] text-ink-muted">No perfil da empresa, a Carteira mostra só os ativos e o total.</p>}
      </Modal>

      <Modal open={folha === "irpf"} onClose={() => setFolha(null)} title="Preço médio pela declaração">
        <IrpfImport onDone={() => setFolha(null)} />
      </Modal>
    </div>
  );
}

/** "CDB Banco Inter" (a taxa fica no detalhe do ativo, rodada 43). */
export function nomeCurto(a: { name: string; ticker: string | null }): string {
  if (a.ticker && a.ticker.toUpperCase() !== a.name.toUpperCase() && /^[A-Z0-9.]{3,7}$/.test(a.ticker)) return a.ticker;
  return a.name.replace(/\s+\d{2,3}([,.]\d+)?\s*%\s*(do\s+)?cdi\b/i, "").trim();
}

/** "R$ 10.380" com o R$ pequeno e cinza (rodada 43). */
function ValorSemCentavos({ texto }: { texto: string; pequeno?: boolean }) {
  const [prefixo, numero] = separarPrefixo(texto);
  return (
    <>
      {prefixo && <span className={`mr-0.5 font-normal text-ink-muted text-[12px]`}>{prefixo}</span>}
      {numero}
    </>
  );
}

function FolhaDeAportes({ aportes, registrando, onRegistrar, onFechar }: { aportes: Aportes; registrando: boolean; onRegistrar: () => void; onFechar: () => void }) {
  const money = useMoney();
  const base = aportes.guardou > 0 ? aportes.guardou : aportes.planejado;
  const total = aportes.sugestao.reduce((s, x) => s + x.valor, 0);
  if (registrando && aportes.registrar) return <div className="flex flex-col gap-3">{aportes.registrar}</div>;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl p-4" style={{ background: "color-mix(in srgb, var(--color-dinheiro-guardou) 12%, var(--color-surface))" }}>
        <p className="text-[14px] text-ink-muted">{aportes.guardou > 0 ? `Em ${aportes.mes} você guardou` : base > 0 ? `Seu plano de ${aportes.mes} é guardar` : `Em ${aportes.mes} você ainda não guardou`}</p>
        {base > 0 && (
          <p className="mt-1 text-ink">
            <ValorComCentavos texto={money(base, { round: true })} className="text-[2rem] font-light leading-none tracking-[-0.02em] tabular-nums" />
          </p>
        )}
        {aportes.guardou > 0 && <p className="mt-1 text-[13px] text-ink-muted">pelo orçamento</p>}
      </div>
      {aportes.sugestao.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-[14px] text-ink">Se quiser uma sugestão de onde pôr:</p>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded" aria-hidden>
            {aportes.sugestao.map((s) => (
              <span key={s.chave} className="h-full rounded-[4px]" style={{ flexGrow: s.valor / (total || 1), background: s.cor }} />
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {aportes.sugestao.map((s) => (
              <li key={s.chave} className="flex items-center gap-3 py-2">
                <span className="size-2 shrink-0 rounded-full" style={{ background: s.cor }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">{s.nome}</span>
                  {s.ativo && <span className="block truncate text-[12.5px] text-ink-muted">{s.ativo} · {Math.round((s.valor / (total || 1)) * 100)}%</span>}
                </span>
                <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">{money(s.valor, { round: true })}</span>
              </li>
            ))}
          </ul>
          {aportes.regra && (
            <p className="text-[12.5px] text-ink-muted">
              {aportes.regra === "curta" ? "Até a reserva cobrir 3 meses, tudo vai para ela." : aportes.regra === "montando" ? "De 3 meses até a meta da reserva: 70% reserva, 30% metas." : "Sua reserva já está completa: o dinheiro vai para os seus sonhos."}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {aportes.registrar ? (
          <button type="button" onClick={onRegistrar} className="min-h-12 rounded-full bg-accent-gradient px-4 text-[15px] font-medium text-on-accent">
            Registrar aporte
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onFechar} className="min-h-12 rounded-full bg-surface-2 px-4 text-[15px] font-medium text-ink">
          Agora não
        </button>
      </div>
      {!aportes.registrar && aportes.guardou > 0 && <p className="text-[12.5px] text-ink-muted">Os aportes deste mês já estão nos seus ativos.</p>}
    </div>
  );
}
