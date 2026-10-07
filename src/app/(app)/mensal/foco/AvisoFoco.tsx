"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, ChevronRight, Clock, Handshake, Lock, Pencil, PiggyBank, Plus, Receipt, ScanSearch, ShieldCheck, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { isParentCategoryKey } from "@/lib/categories";
import type { FocoCombinado, FocoItem } from "@/lib/decisoes/foco";
import { faltamDias } from "@/lib/profiles/textos/foco";
import { ajustarOrcamentoAction, classificarGastoAction, definirTetoAction, desfazerTetoAction, dispensarAvisoAction, registrarAporteDoMesAction, renomearGastoAction } from "./actions";

export type GastoDaLista = {
  id: string;
  descricao: string;
  dia: number | null;
  valor: number;
  categoria: string | null;
};
type Opcao = { key: string; label: string };
/** Quantos gastos a lista tem ao todo e quanto somam: ela mostra só os maiores. */
type ResumoDaLista = { n: number; total: number };

const arredonda10 = (v: number) => Math.ceil(v / 10) * 10;

/**
 * Um aviso do Foco. "Ver o que fazer" abre a resposta ali mesmo, em formato de painel: o número
 * grande, a barra do gasto contra o plano e os botões que resolvem (teto, subir o plano, "já
 * transferi", "foi pontual"). Antes era um parágrafo de texto, e ninguém lia.
 *
 * Todo texto vem da voz do tema (`aviso*` em textos/foco.ts): escrito aqui, o Girly abria a
 * janela de um aviso que dizia "combinado" e lia "Plano" e "aplicação" logo embaixo.
 */
export function AvisoFoco({ item, hrefMes, gastos = [], resumo, opcoes = [] }: { item: FocoItem; hrefMes?: string; gastos?: GastoDaLista[]; resumo?: ResumoDaLista; opcoes?: Opcao[] }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const t = useProfileTheme().voz.titulos;
  const [aberto, setAberto] = useState(false);
  const [salvando, start] = useTransition();
  const { showToast, showError } = useToast();
  const d = item.detalhe;

  // A confirmação vai num toast: resolvido, o aviso sai da lista e o cartão (com a janela) some.
  const fazer = (acao: () => Promise<unknown>, mensagem: string) =>
    start(async () => {
      try {
        await acao();
        setAberto(false);
        showToast(mensagem);
        router.refresh();
      } catch {
        showError(t.avisoErroSalvar);
      }
    });
  const pontual =
    (quando: "mes" | "semana" = "mes", mensagem = t.avisoAnotado) =>
    () =>
      fazer(() => dispensarAvisoAction(item.id, quando), mensagem);

  let corpo: React.ReactNode = null;
  if (d?.tipo === "estouro") {
    // O plano novo cabe no resto do mês (ver planoQueCabe); aviso de antes desta versão não traz.
    const planoNovo = d.planoNovo ?? arredonda10(d.gasto);
    corpo = (
      <>
        <Numero valor={`+${m(d.gasto - d.planejado)}`} legenda={t.avisoAcimaDoPlano(d.label)} cor="text-danger" />
        <Barra gasto={d.gasto} planejado={d.planejado} decorrido={d.decorrido} />
        <Rodape esquerda={t.avisoRodapeGasto(m(d.gasto))} direita={t.avisoRodapePlano(m(d.planejado))} />
        <Selo icone={Clock}>{faltamDias(d.dias)}</Selo>
        <Botoes>
          <Botao
            icone={Ban}
            destaque
            disabled={salvando}
            titulo={t.avisoNadaMaisT}
            sub={t.avisoNadaMaisSub(d.label)}
            onClick={() => fazer(() => definirTetoAction({ categoria: d.categoria, valor: 0 }), t.avisoNadaMaisFeito(d.label))}
          />
          {isParentCategoryKey(d.categoria) && (
            <Botao
              icone={TrendingUp}
              disabled={salvando}
              titulo={t.avisoPlanoBaixoT}
              sub={t.avisoPlanoBaixoSub(d.label, m(planoNovo))}
              onClick={() => fazer(() => ajustarOrcamentoAction(d.categoria, planoNovo), t.avisoPlanoBaixoFeito(d.label, m(planoNovo)))}
            />
          )}
          <Botao icone={Check} disabled={salvando} titulo={t.avisoPontualT} sub={t.avisoPontualSub} onClick={pontual()} />
        </Botoes>
        <ListaDeGastos titulo={t.avisoOndeFoi(d.label)} gastos={gastos} resumo={resumo} hrefMes={hrefMes} opcoes={opcoes.filter((o) => o.key !== d.categoria)} />
      </>
    );
  } else if (d?.tipo === "ritmo") {
    corpo = (
      <>
        <Numero valor={m(d.sobra)} legenda={t.avisoSobramEm(d.label, d.dias)} cor="text-accent-strong" />
        <Barra gasto={d.gasto} planejado={d.planejado} decorrido={d.decorrido} />
        <Rodape esquerda={t.avisoRodapeGasto(m(d.gasto))} direita={t.avisoRodapePlano(m(d.planejado))} />
        <Selo icone={TrendingUp}>{t.avisoRitmoSelo}</Selo>
        <Botoes>
          <Botao
            icone={Lock}
            destaque
            disabled={salvando}
            titulo={t.avisoTetoT(m(d.sobra))}
            sub={t.avisoTetoSub(d.label)}
            onClick={() => fazer(() => definirTetoAction({ categoria: d.categoria, valor: d.sobra }), t.avisoTetoFeito(m(d.sobra), d.label))}
          />
          <Botao icone={Check} disabled={salvando} titulo={t.avisoPontualT} sub={t.avisoPontualSub} onClick={pontual()} />
        </Botoes>
        <ListaDeGastos titulo={t.avisoOndeFoi(d.label)} gastos={gastos} resumo={resumo} hrefMes={hrefMes} opcoes={opcoes.filter((o) => o.key !== d.categoria)} />
      </>
    );
  } else if (d?.tipo === "fora") {
    corpo = (
      <>
        <Numero valor={m(d.valor)} legenda={t.avisoForaLegenda} cor="text-danger" />
        <Selo icone={PiggyBank}>{t.avisoForaSelo(m(d.livre))}</Selo>
        <ListaDeGastos
          titulo={t.avisoForaLista(resumo?.n ?? gastos.length)}
          gastos={gastos}
          resumo={resumo}
          hrefMes={hrefMes}
          opcoes={opcoes}
          jaAberta
        />
        <Botoes>
          <Botao icone={Plus} href="/orcamento" titulo={t.avisoCriarCategoriaT} sub={t.avisoCriarCategoriaSub} />
          <Botao icone={Check} disabled={salvando} titulo={t.avisoEntendiT} sub={t.avisoEntendiSub} onClick={pontual()} />
        </Botoes>
      </>
    );
  } else if (d?.tipo === "aporte") {
    corpo = (
      <>
        <Numero valor={m(d.falta)} legenda={t.avisoGuardarLegenda} cor="text-accent-strong" />
        <Barra gasto={d.guardado} planejado={d.planejado} boa />
        <Rodape esquerda={t.avisoRodapeGuardado(m(d.guardado))} direita={t.avisoRodapePlano(m(d.planejado))} />
        <Selo icone={PiggyBank}>{t.avisoGuardarSelo}</Selo>
        <Botoes>
          <Botao icone={Check} destaque disabled={salvando} titulo={t.fechAporteFeito} sub={t.avisoGuardarFeitoSub(m(d.falta))} onClick={() => fazer(() => registrarAporteDoMesAction(), t.avisoGuardarFeito(m(d.falta)))} />
          <Botao icone={Clock} disabled={salvando} titulo={t.fechAporteDepois} sub={t.avisoGuardarDepoisSub} onClick={pontual("semana", t.avisoGuardarDepoisFeito)} />
        </Botoes>
      </>
    );
  } else if (d?.tipo === "meta") {
    corpo = (
      <>
        {d.vencida ? (
          <Numero valor={t.avisoMetaPrazoPassou} legenda={t.avisoMetaNaoChegou(d.nome)} cor="text-danger" />
        ) : (
          // Prazo neste mês: o número é tudo que falta, não "por mês" (como o texto do aviso).
          <Numero valor={d.ultimoMes ? m(d.porMes) : `${m(d.porMes)}/mês`} legenda={d.ultimoMes ? t.avisoMetaFaltamUltimoMes(d.nome) : t.avisoMetaChegaEm(d.nome, d.quando)} cor="text-accent-strong" />
        )}
        <Selo icone={Target}>{t.avisoMetaSelo(Boolean(d.ultimoMes))}</Selo>
        <Botoes>
          <Botao icone={Target} destaque href={`/planejamento/metas/${d.metaId}`} titulo={t.avisoMetaAjustarT} sub={t.avisoMetaAjustarSub} />
          <Botao icone={Check} disabled={salvando} titulo={t.avisoEntendiT} sub={t.avisoEntendiSub} onClick={pontual()} />
        </Botoes>
      </>
    );
  } else if (d?.tipo === "reserva") {
    corpo = (
      <>
        <Numero valor={d.meses < 1 ? "< 1 mês" : `${d.meses.toLocaleString("pt-BR")} ${d.meses === 1 ? "mês" : "meses"}`} legenda={t.avisoReservaLegenda(d.minimo)} cor="text-accent-strong" />
        <Barra gasto={d.meses} planejado={d.minimo} boa />
        <Selo icone={ShieldCheck}>{t.avisoReservaSelo}</Selo>
        <Botoes>
          <Botao icone={ShieldCheck} destaque href="/planejamento/reserva-emergencia" titulo={t.avisoReservaVerT} sub={t.avisoReservaVerSub} />
          <Botao icone={Check} disabled={salvando} titulo={t.avisoEntendiT} sub={t.avisoEntendiSub} onClick={pontual()} />
        </Botoes>
      </>
    );
  }

  // A frente do cartão (01/10/2026): ícone, título, um desenho no lugar do parágrafo e o botão que
  // resolve. O parágrafo continua dentro da janela; na frente, ninguém lia.
  const Icone: LucideIcon = !d ? Target : d.tipo === "estouro" ? Ban : d.tipo === "ritmo" ? TrendingUp : d.tipo === "aporte" ? PiggyBank : d.tipo === "meta" ? Target : d.tipo === "reserva" ? ShieldCheck : d.tipo === "raiox" ? ScanSearch : Receipt;
  const tomIcone = item.nivel === 1 ? "bg-danger-soft text-danger" : item.nivel === 2 ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-ink-muted";
  // A frente do aviso em uma linha (06/10/2026, como as linhas do YNAB e as sugestões do Nubank):
  // ícone, o título, o número numa linha curta, uma barra fina quando há régua e um botão com o
  // verbo do que dá para fazer. Antes eram cartões grandes, todos com o mesmo "Ver o que fazer".
  // A janela atrás do verbo é a mesma, com o teto e o "já guardei" de um toque.
  let curto: string | null = null;
  let barra: React.ReactNode = null;
  if (d?.tipo === "estouro" || d?.tipo === "ritmo") {
    curto = `${t.avisoRodapeGasto(m(d.gasto))} · ${t.avisoRodapePlano(m(d.planejado))}`;
    barra = <Barra gasto={d.gasto} planejado={d.planejado} decorrido={d.decorrido} fina />;
  } else if (d?.tipo === "aporte") {
    curto = `${t.avisoRodapeGuardado(m(d.guardado))} · ${t.avisoRodapePlano(m(d.planejado))}`;
    barra = <Barra gasto={d.guardado} planejado={d.planejado} boa fina />;
  } else if (d?.tipo === "reserva") {
    curto = `${d.meses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de ${d.minimo} meses`;
    barra = <Barra gasto={d.meses} planejado={d.minimo} boa fina />;
  } else if (d?.tipo === "meta") {
    curto = d.vencida ? t.avisoMetaNaoChegou(d.nome) : d.ultimoMes ? `${m(d.porMes)} · ${t.avisoMetaFaltamUltimoMes(d.nome)}` : `${m(d.porMes)}/mês · ${t.avisoMetaChegaEm(d.nome, d.quando)}`;
  } else if (d?.tipo === "fora") {
    curto = m(d.valor);
  } else if (d?.tipo === "raiox") {
    curto = `${m(d.anual)} por ano`;
  }
  const verbo = t.focoVerbo[d?.tipo ?? "outro"] ?? item.acao;
  const botaoVerbo = "inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-accent-soft px-4 text-caption font-semibold text-accent-strong";

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tomIcone}`} aria-hidden>
          <Icone size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-ink">{item.titulo}</p>
          {curto && <p className="mt-0.5 text-caption tabular-nums text-ink-muted">{curto}</p>}
        </div>
        {d && d.tipo !== "raiox" ? (
          <button type="button" onClick={() => setAberto(true)} className={botaoVerbo}>
            {verbo}
          </button>
        ) : (
          <Link href={item.href} className={botaoVerbo}>
            {verbo}
          </Link>
        )}
      </div>
      {barra && <div className="pl-[52px]">{barra}</div>}
      <Modal open={aberto} onClose={() => setAberto(false)} title={item.titulo}>
        <div className="flex flex-col gap-3">
          <p className="text-caption text-ink-muted">{item.texto}</p>
          {corpo}
        </div>
      </Modal>
    </div>
  );
}

/**
 * O que ela já decidiu num aviso. Antes o aviso sumia (ou voltava igual, com o mesmo "Bora ver");
 * agora vira o combinado, e mostra se está sendo cumprido: nada entrou depois, ou quanto entrou.
 */
export function CombinadoFoco({ c, hrefMes, gastos = [], resumo, opcoes = [] }: { c: FocoCombinado; hrefMes?: string; gastos?: GastoDaLista[]; resumo?: ResumoDaLista; opcoes?: Opcao[] }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const t = useProfileTheme().voz.titulos;
  const { showToast, showError } = useToast();
  const [salvando, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const desfazer = () =>
    start(async () => {
      try {
        await desfazerTetoAction(c.categoria);
        showToast(t.avisoDesfeito);
        router.refresh();
      } catch {
        showError(t.avisoDesfazerFalhou);
      }
    });

  const status = c.quebrou
    ? c.teto > 0
      ? t.avisoPassouTeto(m(c.depois), m(c.teto))
      : t.avisoEntraramDepois(m(c.depois))
    : c.teto > 0
      ? t.avisoUsadosDesde(m(c.depois), m(c.teto))
      : c.depois >= 1
        ? t.avisoDentroDaMargem(m(c.depois))
        : t.avisoNadaEntrou;

  return (
    <Card className="flex gap-4 p-5">
      <span className={`w-1 shrink-0 rounded-full ${c.quebrou ? "bg-danger" : "bg-success"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">
          <Handshake size={14} aria-hidden /> {t.avisoVoceCombinou}
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">{c.titulo}</p>
        {c.teto > 0 && <Barra gasto={c.depois} planejado={c.teto} className="mt-3" />}
        <p className={`mt-2 flex items-center gap-1.5 text-caption font-semibold ${c.quebrou ? "text-danger" : "text-success"}`}>
          {c.quebrou ? <Ban size={14} aria-hidden /> : <Check size={14} aria-hidden />}
          {status}
        </p>
        <p className="mt-0.5 text-caption text-ink-faint">
          {t.avisoNoMes(c.label, m(c.gasto), m(c.planejado))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {gastos.length > 0 && (
            <button type="button" onClick={() => setAberto(true)} className="inline-flex min-h-11 items-center rounded-xl bg-accent-soft px-4 py-2 text-caption font-semibold text-accent-strong">
              {t.avisoVerGastos}
            </button>
          )}
          <button type="button" disabled={salvando} onClick={desfazer} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-caption font-semibold text-ink-muted disabled:opacity-60">
            {t.uiDesfazer}
          </button>
        </div>
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title={t.avisoGastosDe(c.label)}>
        <div className="flex flex-col gap-3">
          <Barra gasto={c.gasto} planejado={c.planejado} />
          <Rodape esquerda={t.avisoRodapeGasto(m(c.gasto))} direita={t.avisoRodapePlano(m(c.planejado))} />
          <ListaDeGastos titulo={t.avisoOndeFoi(c.label)} gastos={gastos} resumo={resumo} hrefMes={hrefMes} opcoes={opcoes.filter((o) => o.key !== c.categoria)} />
        </div>
      </Modal>
    </Card>
  );
}

/** O número que responde a pergunta do aviso, grande, com uma legenda curta embaixo. */
function Numero({ valor, legenda, cor }: { valor: string; legenda: string; cor: string }) {
  return (
    <div>
      <p className={`text-3xl font-bold tabular-nums tracking-tight ${cor}`}>{valor}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{legenda}</p>
    </div>
  );
}

/**
 * Gasto contra o plano. Até o plano, a barra é dourada (ou verde, se `boa`: guardar mais é bom);
 * o que passa do plano aparece em vermelho, depois de um corte. A marca fina é o "hoje" no mês.
 */
function Barra({ gasto, planejado, decorrido, boa, fina, className = "" }: { gasto: number; planejado: number; decorrido?: number; boa?: boolean; fina?: boolean; className?: string }) {
  const teto = Math.max(gasto, planejado, 1);
  const dentro = (Math.min(gasto, planejado) / teto) * 100;
  const passou = gasto > planejado ? ((gasto - planejado) / teto) * 100 : 0;
  const hoje = decorrido !== undefined ? ((planejado * Math.min(1, Math.max(0, decorrido))) / teto) * 100 : null;
  return (
    <div className={`relative ${fina ? "h-1.5" : "h-3"} w-full overflow-hidden rounded-full bg-surface-2 ${className}`} role="img" aria-label={`${Math.round((gasto / Math.max(planejado, 1)) * 100)}% do plano`}>
      <div className={`absolute inset-y-0 left-0 ${boa ? "bg-success" : "bg-accent"}`} style={{ width: `${dentro}%` }} />
      {passou > 0 && (
        <div
          className="absolute inset-y-0 bg-danger"
          style={{
            left: `calc(${dentro}% + 2px)`,
            width: `calc(${passou}% - 2px)`,
          }}
        />
      )}
      {hoje !== null && <div className="absolute inset-y-0 w-0.5 bg-ink/70" style={{ left: `${hoje}%` }} title="hoje" />}
    </div>
  );
}

function Rodape({ esquerda, direita }: { esquerda: string; direita: string }) {
  return (
    <div className="-mt-1 flex justify-between text-caption tabular-nums text-ink-muted">
      <span>{esquerda}</span>
      <span>{direita}</span>
    </div>
  );
}

function Selo({ icone: Icone, children }: { icone: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 self-start rounded-2xl bg-surface-2 px-3 py-1.5 text-caption font-medium text-ink-muted">
      <Icone size={14} className="shrink-0" aria-hidden />
      {children}
    </p>
  );
}

function Botoes({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 flex flex-col gap-2">{children}</div>;
}

/** Botão de decisão: ícone grande, o que acontece em poucas palavras, e o detalhe menor embaixo. */
function Botao({ icone: Icone, titulo, sub, destaque, onClick, href, disabled }: { icone: LucideIcon; titulo: string; sub: string; destaque?: boolean; onClick?: () => void; href?: string; disabled?: boolean }) {
  const classe = `flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left disabled:opacity-60 ${destaque ? "bg-pill text-on-pill" : "border border-border text-ink"}`;
  const conteudo = (
    <>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${destaque ? "bg-white/15" : "bg-accent-soft text-accent-strong"}`}>
        <Icone size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className={`block text-caption ${destaque ? "opacity-80" : "text-ink-muted"}`}>{sub}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 opacity-50" aria-hidden />
    </>
  );
  if (href) {
    return (
      <Link href={href} className={classe}>
        {conteudo}
      </Link>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={classe}>
      {conteudo}
    </button>
  );
}

/**
 * Os gastos por trás de um aviso, com uma barra do tamanho de cada um. Tocar num gasto abre a
 * edição ali mesmo: mudar a categoria ("Guardei esse dinheiro" tira do gasto) ou escrever uma descrição
 * melhor que a do extrato ("PIX 1234 JOAO" → "Aluguel"). A lista começa fechada, só com o título, o
 * total e "Revisar": aberta de cara, junto com os botões, a janela virava um paredão. `jaAberta`:
 * nos gastos fora do orçamento, revisar é o motivo de abrir a janela.
 */
function ListaDeGastos({ titulo, gastos, resumo, hrefMes, opcoes, jaAberta = false }: { titulo: string; gastos: GastoDaLista[]; resumo?: ResumoDaLista; hrefMes?: string; opcoes: Opcao[]; jaAberta?: boolean }) {
  const money = useMoney();
  const router = useRouter();
  const t = useProfileTheme().voz.titulos;
  const { showToast, showError } = useToast();
  const [salvando, start] = useTransition();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(jaAberta);
  if (gastos.length === 0) return null;
  const maior = Math.max(...gastos.map((g) => Math.abs(g.valor)), 1);
  // A lista vem cortada nos maiores: a contagem e o total são os de verdade (o `resumo`), senão
  // "15 gastos · R$ 620" ficava do lado de "Gasto R$ 1.140" e os números não batiam.
  const cortada = resumo !== undefined && resumo.n > gastos.length;
  const total = resumo?.total ?? gastos.reduce((s, g) => s + g.valor, 0);
  const contagem = t.avisoContagem(gastos.length, cortada ? resumo.n : gastos.length);

  const salvar = (g: GastoDaLista, acao: () => Promise<boolean>, mensagem: string) => {
    setEmAndamento(g.id);
    start(async () => {
      try {
        if (await acao()) {
          showToast(mensagem);
          setEditando(null);
        } else showError(t.avisoNaoMudou);
        router.refresh();
      } catch {
        showError(t.avisoErroSalvar);
      } finally {
        setEmAndamento(null);
      }
    });
  };
  const classificar = (g: GastoDaLista, destino: string) => {
    const mensagem = destino === "aplicacao" ? t.avisoVirouGuardado(g.descricao) : t.avisoFoiPara(g.descricao, opcoes.find((o) => o.key === destino)?.label ?? "");
    salvar(g, () => classificarGastoAction(g.id, destino), mensagem);
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
      <button type="button" onClick={() => setRevisando((v) => !v)} aria-expanded={revisando} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{titulo}</span>
          <span className="block text-caption text-ink-faint">
            {contagem} · {money(total, { round: true })}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">
          {revisando ? t.avisoFechar : t.avisoRevisar}
          <ChevronRight size={14} className={`transition-transform ${revisando ? "-rotate-90" : "rotate-90"}`} aria-hidden />
        </span>
      </button>
      {revisando && (
        <>
          <p className="text-caption text-ink-faint">{t.avisoToqueNumGasto}</p>
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
            {gastos.map((g) => {
              const aberto = editando === g.id;
              const seletor = (
                <select
                  aria-label={`Categoria de ${g.descricao}`}
                  disabled={salvando}
                  defaultValue=""
                  onChange={(e) => {
                    const destino = e.target.value;
                    e.target.value = "";
                    if (destino) classificar(g, destino);
                  }}
                  className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-ink disabled:opacity-60"
                >
                  <option value="" disabled>
                    {g.categoria ? t.avisoMoverPra : t.avisoClassificar}
                  </option>
                  {opcoes.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                  <option value="aplicacao">{t.avisoEhGuardado}</option>
                </select>
              );
              return (
                <li key={g.id} className={`flex flex-col gap-2 px-3 py-2.5 ${emAndamento === g.id ? "opacity-50" : ""}`}>
                  <button type="button" onClick={() => setEditando(aberto ? null : g.id)} aria-expanded={aberto} className="flex w-full flex-col gap-1.5 text-left">
                    <span className="flex w-full items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                          <span className="truncate">{g.descricao}</span>
                          <Pencil size={12} className="shrink-0 text-ink-faint" aria-hidden />
                        </span>
                        <span className="block text-caption text-ink-faint">
                          {g.dia ? `dia ${g.dia} · ` : ""}
                          {g.categoria ?? <span className="font-semibold text-accent-strong">{t.avisoSemCategoria}</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{money(g.valor, { round: Math.abs(g.valor) >= 100 })}</span>
                    </span>
                    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span
                        className="block h-full rounded-full bg-accent/70"
                        style={{
                          width: `${Math.max(2, (Math.abs(g.valor) / maior) * 100)}%`,
                        }}
                      />
                    </span>
                  </button>
                  {aberto && (
                    <form
                      className="flex flex-col gap-2 rounded-xl bg-surface-2 p-2.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const texto = String(new FormData(e.currentTarget).get("descricao") ?? "").trim();
                        if (!texto || texto === g.descricao) return setEditando(null);
                        salvar(g, () => renomearGastoAction(g.id, texto), t.avisoDescricaoSalva(texto));
                      }}
                    >
                      <label className="text-caption font-semibold text-ink-muted" htmlFor={`desc-${g.id}`}>
                        {t.avisoDescricao}
                      </label>
                      <div className="flex gap-2">
                        <input
                          id={`desc-${g.id}`}
                          name="descricao"
                          defaultValue={g.descricao}
                          maxLength={120}
                          autoComplete="off"
                          className="min-w-0 flex-1 rounded-xl border border-border-strong bg-surface px-3 py-2 text-base text-ink sm:text-sm"
                        />
                        <button type="submit" disabled={salvando} className="shrink-0 rounded-xl bg-pill px-3 py-2 text-sm font-semibold text-on-pill disabled:opacity-60">
                          {t.formSalvar}
                        </button>
                      </div>
                      <span className="text-caption font-semibold text-ink-muted">{t.avisoCategoria}</span>
                      {seletor}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {cortada && hrefMes && (
            <Link href={hrefMes} className="self-start text-caption font-semibold text-accent-strong underline-offset-2 hover:underline">
              {t.avisoVerTodos(resumo.n)}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
