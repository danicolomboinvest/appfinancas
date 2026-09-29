"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, ChevronRight, Clock, Handshake, Lock, Pencil, PiggyBank, Plus, ShieldCheck, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useMoney } from "@/components/money/MoneyProvider";
import { useToast } from "@/components/ui/toast-context";
import { isParentCategoryKey } from "@/lib/categories";
import type { FocoCombinado, FocoItem } from "@/lib/decisoes/foco";
import { ajustarOrcamentoAction, classificarGastoAction, definirTetoAction, desfazerTetoAction, dispensarAvisoAction, registrarAporteDoMesAction, renomearGastoAction } from "./actions";

export type GastoDaLista = {
  id: string;
  descricao: string;
  dia: number | null;
  valor: number;
  categoria: string | null;
};
type Opcao = { key: string; label: string };

const arredonda10 = (v: number) => Math.ceil(v / 10) * 10;
const faltam = (dias: number) => (dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`);

/**
 * Um aviso do Foco. "Ver o que fazer" abre a resposta ali mesmo, em formato de painel: o número
 * grande, a barra do gasto contra o plano e os botões que resolvem (teto, subir o plano, "já
 * transferi", "foi pontual"). Antes era um parágrafo de texto, e ninguém lia.
 */
export function AvisoFoco({ item, gastos = [], opcoes = [] }: { item: FocoItem; hrefMes?: string; gastos?: GastoDaLista[]; opcoes?: Opcao[] }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, start] = useTransition();
  const { showToast, showError } = useToast();
  const faixa = item.nivel === 1 ? "bg-danger" : item.nivel === 2 ? "bg-accent" : "bg-ink-faint";
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
        showError("Não consegui salvar agora. Tenta de novo em instantes.");
      }
    });
  const pontual =
    (quando: "mes" | "semana" = "mes", mensagem = "Anotado. Esse aviso some até o mês que vem.") =>
    () =>
      fazer(() => dispensarAvisoAction(item.id, quando), mensagem);

  let corpo: React.ReactNode = null;
  if (d?.tipo === "estouro") {
    corpo = (
      <>
        <Numero valor={`+${m(d.gasto - d.planejado)}`} legenda={`acima do plano em ${d.label}`} cor="text-danger" />
        <Barra gasto={d.gasto} planejado={d.planejado} decorrido={d.decorrido} />
        <Rodape esquerda={`Gasto ${m(d.gasto)}`} direita={`Plano ${m(d.planejado)}`} />
        <Selo icone={Clock}>{faltam(d.dias)}</Selo>
        <Botoes>
          <Botao
            icone={Ban}
            destaque
            disabled={salvando}
            titulo="Não gastar mais nada"
            sub={`em ${d.label} até o mês virar`}
            onClick={() => fazer(() => definirTetoAction({ categoria: d.categoria, valor: 0 }), `Combinado: nada mais em ${d.label} até o fim do mês.`)}
          />
          {isParentCategoryKey(d.categoria) && (
            <Botao
              icone={TrendingUp}
              disabled={salvando}
              titulo="O plano estava baixo"
              sub={`subir ${d.label} pra ${m(arredonda10(d.gasto))}`}
              onClick={() => fazer(() => ajustarOrcamentoAction(d.categoria, arredonda10(d.gasto)), `${d.label} agora tem ${m(arredonda10(d.gasto))} este mês.`)}
            />
          )}
          <Botao icone={Check} disabled={salvando} titulo="Foi pontual" sub="sigo o plano" onClick={pontual()} />
        </Botoes>
        <ListaDeGastos titulo={`Onde foi o dinheiro de ${d.label}`} gastos={gastos} opcoes={opcoes.filter((o) => o.key !== d.categoria)} />
      </>
    );
  } else if (d?.tipo === "ritmo") {
    corpo = (
      <>
        <Numero valor={m(d.sobra)} legenda={`sobram em ${d.label} pra ${d.dias === 1 ? "1 dia" : `${d.dias} dias`}`} cor="text-accent-strong" />
        <Barra gasto={d.gasto} planejado={d.planejado} decorrido={d.decorrido} />
        <Rodape esquerda={`Gasto ${m(d.gasto)}`} direita={`Plano ${m(d.planejado)}`} />
        <Selo icone={TrendingUp}>nesse ritmo, estoura antes do mês acabar</Selo>
        <Botoes>
          <Botao
            icone={Lock}
            destaque
            disabled={salvando}
            titulo={`Teto de ${m(d.sobra)}`}
            sub={`em ${d.label} até o fim do mês`}
            onClick={() => fazer(() => definirTetoAction({ categoria: d.categoria, valor: d.sobra }), `Teto de ${m(d.sobra)} em ${d.label} até o fim do mês.`)}
          />
          <Botao icone={Check} disabled={salvando} titulo="Foi pontual" sub="sigo o plano" onClick={pontual()} />
        </Botoes>
        <ListaDeGastos titulo={`Onde foi o dinheiro de ${d.label}`} gastos={gastos} opcoes={opcoes.filter((o) => o.key !== d.categoria)} />
      </>
    );
  } else if (d?.tipo === "fora") {
    corpo = (
      <>
        <Numero valor={m(d.valor)} legenda="em gastos sem categoria no orçamento" cor="text-danger" />
        <Selo icone={PiggyBank}>{`saem do mesmo dinheiro: o livre caiu pra ${m(d.livre)}`}</Selo>
        <ListaDeGastos titulo={gastos.length === 1 ? "O gasto fora do orçamento" : `Os ${gastos.length} gastos fora do orçamento`} gastos={gastos} opcoes={opcoes} jaAberta />
        <Botoes>
          <Botao icone={Plus} href="/orcamento" titulo="Criar uma categoria nova" sub="no orçamento" />
          <Botao icone={Check} disabled={salvando} titulo="Entendi" sub="esconder até o mês que vem" onClick={pontual()} />
        </Botoes>
      </>
    );
  } else if (d?.tipo === "aporte") {
    corpo = (
      <>
        <Numero valor={m(d.falta)} legenda="faltam guardar este mês" cor="text-accent-strong" />
        <Barra gasto={d.guardado} planejado={d.planejado} boa />
        <Rodape esquerda={`Guardado ${m(d.guardado)}`} direita={`Plano ${m(d.planejado)}`} />
        <Selo icone={PiggyBank}>primeiro você se paga, depois o resto do mês</Selo>
        <Botoes>
          <Botao icone={Check} destaque disabled={salvando} titulo="Já transferi" sub={`lançar ${m(d.falta)} guardados`} onClick={() => fazer(() => registrarAporteDoMesAction(), `${m(d.falta)} guardados. Entrou no seu mês.`)} />
          <Botao icone={Clock} disabled={salvando} titulo="Vou transferir essa semana" sub="me lembra de novo" onClick={pontual("semana", "Combinado. Eu lembro de novo na semana que vem.")} />
        </Botoes>
      </>
    );
  } else if (d?.tipo === "meta") {
    corpo = (
      <>
        {d.vencida ? (
          <Numero valor="Prazo passou" legenda={`${d.nome} ainda não chegou lá`} cor="text-danger" />
        ) : (
          <Numero valor={`${m(d.porMes)}/mês`} legenda={d.ultimoMes ? `faltam pra ${d.nome}, e o prazo é este mês` : `pra ${d.nome} chegar em ${d.quando}`} cor="text-accent-strong" />
        )}
        <Selo icone={Target}>guardar mais por mês, ou escolher uma data que caiba</Selo>
        <Botoes>
          <Botao icone={Target} destaque href={`/planejamento/metas/${d.metaId}`} titulo="Ajustar a meta" sub="valor por mês ou data" />
          <Botao icone={Check} disabled={salvando} titulo="Entendi" sub="esconder até o mês que vem" onClick={pontual()} />
        </Botoes>
      </>
    );
  } else if (d?.tipo === "reserva") {
    corpo = (
      <>
        <Numero valor={d.meses < 1 ? "< 1 mês" : `${d.meses.toLocaleString("pt-BR")} ${d.meses === 1 ? "mês" : "meses"}`} legenda={`de reserva, a sua meta é ${d.minimo} meses`} cor="text-accent-strong" />
        <Barra gasto={d.meses} planejado={d.minimo} boa />
        <Selo icone={ShieldCheck}>segura um imprevisto sem virar dívida</Selo>
        <Botoes>
          <Botao icone={ShieldCheck} destaque href="/planejamento/reserva-emergencia" titulo="Ver minha reserva" sub="quanto falta e como chegar" />
          <Botao icone={Check} disabled={salvando} titulo="Entendi" sub="esconder até o mês que vem" onClick={pontual()} />
        </Botoes>
      </>
    );
  }

  return (
    <Card className="flex gap-4 p-5">
      <span className={`w-1 shrink-0 rounded-full ${faixa}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{item.titulo}</p>
        <p className="mt-1 text-caption text-ink-muted">{item.texto}</p>
        {d && d.tipo !== "raiox" ? (
          <button type="button" onClick={() => setAberto(true)} className="mt-3 inline-flex rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">
            {item.acao}
          </button>
        ) : (
          <Link href={item.href} className="mt-3 inline-flex rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">
            {item.acao}
          </Link>
        )}
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title={item.titulo}>
        <div className="flex flex-col gap-3">{corpo}</div>
      </Modal>
    </Card>
  );
}

/**
 * O que ela já decidiu num aviso. Antes o aviso sumia (ou voltava igual, com o mesmo "Bora ver");
 * agora vira o combinado, e mostra se está sendo cumprido: nada entrou depois, ou quanto entrou.
 */
export function CombinadoFoco({ c, gastos = [], opcoes = [] }: { c: FocoCombinado; gastos?: GastoDaLista[]; opcoes?: Opcao[] }) {
  const money = useMoney();
  const m = (v: number) => money(v, { round: true });
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [salvando, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const desfazer = () =>
    start(async () => {
      try {
        await desfazerTetoAction(c.categoria);
        showToast("Combinado desfeito.");
        router.refresh();
      } catch {
        showError("Não consegui desfazer agora. Tenta de novo em instantes.");
      }
    });

  const status = c.quebrou
    ? c.teto > 0
      ? `Passou do teto: ${m(c.depois)} de ${m(c.teto)}`
      : `Depois do combinado entraram ${m(c.depois)}`
    : c.teto > 0
      ? `${m(c.depois)} de ${m(c.teto)} usados desde o combinado`
      : c.depois >= 1
        ? `${m(c.depois)} entraram depois, dentro da margem`
        : "Nada entrou depois do combinado";

  return (
    <Card className="flex gap-4 p-5">
      <span className={`w-1 shrink-0 rounded-full ${c.quebrou ? "bg-danger" : "bg-success"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">
          <Handshake size={14} aria-hidden /> Você combinou
        </p>
        <p className="mt-1 text-sm font-semibold text-ink">{c.titulo}</p>
        {c.teto > 0 && <Barra gasto={c.depois} planejado={c.teto} className="mt-3" />}
        <p className={`mt-2 flex items-center gap-1.5 text-caption font-semibold ${c.quebrou ? "text-danger" : "text-success"}`}>
          {c.quebrou ? <Ban size={14} aria-hidden /> : <Check size={14} aria-hidden />}
          {status}
        </p>
        <p className="mt-0.5 text-caption text-ink-faint">
          {c.label} no mês: {m(c.gasto)} de {m(c.planejado)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {gastos.length > 0 && (
            <button type="button" onClick={() => setAberto(true)} className="inline-flex rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">
              Ver os gastos
            </button>
          )}
          <button type="button" disabled={salvando} onClick={desfazer} className="inline-flex rounded-xl border border-border px-3 py-1.5 text-caption font-semibold text-ink-muted disabled:opacity-60">
            Desfazer
          </button>
        </div>
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title={`Gastos de ${c.label}`}>
        <div className="flex flex-col gap-3">
          <Barra gasto={c.gasto} planejado={c.planejado} />
          <Rodape esquerda={`Gasto ${m(c.gasto)}`} direita={`Plano ${m(c.planejado)}`} />
          <ListaDeGastos titulo={`Onde foi o dinheiro de ${c.label}`} gastos={gastos} opcoes={opcoes.filter((o) => o.key !== c.categoria)} />
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
function Barra({ gasto, planejado, decorrido, boa, className = "" }: { gasto: number; planejado: number; decorrido?: number; boa?: boolean; className?: string }) {
  const teto = Math.max(gasto, planejado, 1);
  const dentro = (Math.min(gasto, planejado) / teto) * 100;
  const passou = gasto > planejado ? ((gasto - planejado) / teto) * 100 : 0;
  const hoje = decorrido !== undefined ? ((planejado * Math.min(1, Math.max(0, decorrido))) / teto) * 100 : null;
  return (
    <div className={`relative h-3 w-full overflow-hidden rounded-full bg-surface-2 ${className}`} role="img" aria-label={`${Math.round((gasto / Math.max(planejado, 1)) * 100)}% do plano`}>
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
 * edição ali mesmo: mudar a categoria ("É aplicação" tira do gasto) ou escrever uma descrição
 * melhor que a do extrato ("PIX 1234 JOAO" → "Aluguel"). A lista começa fechada, só com o título, o
 * total e "Revisar": aberta de cara, junto com os botões, a janela virava um paredão. `jaAberta`:
 * nos gastos fora do orçamento, revisar é o motivo de abrir a janela.
 */
function ListaDeGastos({ titulo, gastos, opcoes, jaAberta = false }: { titulo: string; gastos: GastoDaLista[]; opcoes: Opcao[]; jaAberta?: boolean }) {
  const money = useMoney();
  const router = useRouter();
  const { showToast, showError } = useToast();
  const [salvando, start] = useTransition();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(jaAberta);
  if (gastos.length === 0) return null;
  const maior = Math.max(...gastos.map((g) => Math.abs(g.valor)), 1);
  const total = gastos.reduce((s, g) => s + g.valor, 0);

  const salvar = (g: GastoDaLista, acao: () => Promise<boolean>, mensagem: string) => {
    setEmAndamento(g.id);
    start(async () => {
      try {
        if (await acao()) {
          showToast(mensagem);
          setEditando(null);
        } else showError("Não consegui mudar esse gasto.");
        router.refresh();
      } catch {
        showError("Não consegui salvar agora. Tenta de novo em instantes.");
      } finally {
        setEmAndamento(null);
      }
    });
  };
  const classificar = (g: GastoDaLista, destino: string) => {
    const nome = destino === "aplicacao" ? "guardado (aplicação)" : (opcoes.find((o) => o.key === destino)?.label ?? "");
    salvar(g, () => classificarGastoAction(g.id, destino), `${g.descricao} foi pra ${nome}.`);
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
      <button type="button" onClick={() => setRevisando((v) => !v)} aria-expanded={revisando} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{titulo}</span>
          <span className="block text-caption text-ink-faint">
            {gastos.length === 1 ? "1 gasto" : `${gastos.length} gastos`} · {money(total, { round: true })}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-xl bg-accent-soft px-3 py-1.5 text-caption font-semibold text-accent-strong">
          {revisando ? "Fechar" : "Revisar"}
          <ChevronRight size={14} className={`transition-transform ${revisando ? "-rotate-90" : "rotate-90"}`} aria-hidden />
        </span>
      </button>
      {revisando && (
        <>
          <p className="text-caption text-ink-faint">Toque num gasto pra mudar a categoria ou a descrição.</p>
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
                    {g.categoria ? "Mover pra…" : "Classificar…"}
                  </option>
                  {opcoes.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                  <option value="aplicacao">É aplicação (guardei, não é gasto)</option>
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
                          {g.categoria ?? <span className="font-semibold text-accent-strong">sem categoria</span>}
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
                        salvar(g, () => renomearGastoAction(g.id, texto), `Descrição salva: ${texto}.`);
                      }}
                    >
                      <label className="text-caption font-semibold text-ink-muted" htmlFor={`desc-${g.id}`}>
                        Descrição
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
                          Salvar
                        </button>
                      </div>
                      <span className="text-caption font-semibold text-ink-muted">Categoria</span>
                      {seletor}
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
