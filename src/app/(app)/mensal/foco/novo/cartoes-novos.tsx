import { after } from "next/server";
import Link from "next/link";
import type { ReactNode } from "react";
import { CircleDollarSign, CreditCard, PiggyBank, Receipt, Repeat, ShieldCheck, Target, TrendingUp } from "lucide-react";
import type { AuthContext } from "@/lib/auth/session";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { semanaDasContas } from "@/lib/contas/semana-das-contas";
import { vencimentosDaJanela } from "@/lib/contas/recorrentes";
import { listarContasAPagar } from "@/lib/repositories/conta-a-pagar.repo";
import { rendimentoDoMes } from "@/lib/carteira/rendimento";
import { resumirCarteira } from "@/lib/portfolio/resumo-carteira";
import { lerCarteiraDosDias, registrarCarteiraDoDia } from "@/lib/repositories/decisao.repo";
import { listAssets } from "@/lib/repositories/asset.repo";
import { getEmergencyFund } from "@/lib/repositories/emergency-fund.repo";
import { listarDividas } from "@/lib/repositories/divida.repo";
import { gastoNoCartao, lerLimiteDoCartao } from "@/lib/repositories/limite-cartao.repo";
import { listarMetasDaTela } from "@/lib/repositories/metas.repo";
import { PREFIXO_DA_META, NOMES_DOS_CARTOES } from "@/lib/resumo/cartoes";
import { montarAssinaturas } from "@/lib/assinaturas/montar";
import { carregarRespostasDeAssinatura } from "@/lib/assinaturas/respostas";
import { gastosDoMesParaAssinaturas, listarAssinaturasDela } from "@/lib/repositories/assinaturas.repo";
import { carregarRaioX } from "@/app/(app)/mensal/foco/dados";
import { carregarDinheiroPerdido } from "@/app/(app)/orcamento/contas/perdido/dados";
import { serializarConta } from "@/app/(app)/orcamento/contas/serializar";
import type { CartaoNaTela } from "./ResumoEditavel";
import type { ResumoNovo as Dados } from "./dados";

/**
 * Os cartões quadrados do Resumo (15/10/2026): um número só, uma cor suave e o toque que leva à
 * página daquilo. Cada um só existe quando há dado de verdade (sem dívida cadastrada não há cartão
 * de dívidas); um dado que falha ao carregar tira o cartão em vez de quebrar o Resumo.
 */

type Tom = "accent" | "success" | "danger" | "info" | "neutro";
const FUNDO: Record<Tom, string> = {
  accent: "bg-accent-soft",
  success: "bg-success-soft",
  danger: "bg-danger-soft",
  info: "bg-info-soft",
  neutro: "bg-surface-2",
};

function Quadrado({ href, tom, icone, nome, numero, legenda, barra }: { href: string; tom: Tom; icone: ReactNode; nome: string; numero: ReactNode; legenda: string; barra?: number }) {
  return (
    <Link href={href} className={`flex h-full min-h-[8.5rem] flex-col gap-1.5 rounded-3xl p-3.5 transition-transform active:scale-[0.98] ${FUNDO[tom]}`} data-cartao-quadrado>
      <span className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface/70 text-ink">{icone}</span>
        <span className="text-[13px] font-semibold leading-tight text-ink">{nome}</span>
      </span>
      <span className="mt-1 text-[26px] font-light leading-none tabular-nums text-ink">{numero}</span>
      {barra !== undefined ? (
        <span className="h-2 overflow-hidden rounded-full bg-surface/70" aria-hidden>
          <span className="block h-full rounded-full bg-ink/80" style={{ width: `${Math.round(Math.min(1, Math.max(0, barra)) * 100)}%` }} />
        </span>
      ) : null}
      <span className="text-[12.5px] leading-snug text-ink">{legenda}</span>
    </Link>
  );
}

async function seguro<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch {
    return null;
  }
}

/**
 * O total das assinaturas pelo mesmo cálculo da tela de Recorrentes (lib/assinaturas/montar). É o
 * único cartão pesado (varre os lançamentos atrás de cobranças que se repetem), por isso só carrega
 * quando a pessoa já ligou o cartão; se não, vem sem conteúdo e aparece depois do "Pronto".
 */
async function cartaoDeAssinaturas(ctx: AuthContext, r: Dados): Promise<CartaoNaTela["node"] | null> {
  const m = r.foco.m;
  const { ano, mes } = r.mes;
  const [dela, raiox, perdido, respostas, lancamentosDoMes, contas] = await Promise.all([
    listarAssinaturasDela(ctx),
    carregarRaioX(ctx, ano, mes),
    carregarDinheiroPerdido(ctx),
    carregarRespostasDeAssinatura(ctx),
    gastosDoMesParaAssinaturas(ctx, ano, mes),
    listarContasAPagar(ctx),
  ]);
  const lista = montarAssinaturas({ dela, raiox, vivos: perdido?.vivos ?? [], contas, respostas, lancamentosDoMes });
  if (lista.length === 0) return null;
  const total = lista.reduce((s, a) => s + a.mensal, 0);
  return (
    <Quadrado
      href="/orcamento/contas"
      tom="accent"
      icone={<Repeat size={17} aria-hidden />}
      nome="Assinaturas"
      numero={m(total)}
      legenda={`por mês, em ${lista.length === 1 ? "1 assinatura" : `${lista.length} assinaturas`}`}
    />
  );
}

/**
 * A Carteira e o que rendeu no mês. O app só guardava o valor de hoje, então o rendimento nasce de
 * um registro por dia (ganho e total, ver lib/carteira/rendimento): o ganho não muda quando a pessoa
 * aporta, só quando o preço muda. Sem registro do começo do mês o cartão não inventa número: diz que
 * está juntando o histórico. O registro de hoje é gravado aqui, para todo mundo, para o histórico
 * já existir no dia em que a pessoa ligar o cartão.
 */
async function carteiraDoResumo(ctx: AuthContext): Promise<{ total: number; ganho: number | null; rendimento: ReturnType<typeof rendimentoDoMes> } | null> {
  const ativos = await listAssets(ctx);
  if (ativos.length === 0) return null;
  const resumo = resumirCarteira(
    ativos.map((a) => ({
      id: a.id,
      assetClass: a.assetClass,
      fixedIncomeIndex: a.fixedIncomeIndex,
      currency: a.currency,
      tipoEscolhido: a.tipoEscolhido,
      ondeEscolhido: a.ondeEscolhido,
      currentValue: Number(a.currentValue),
      investedValue: a.investedValue !== null ? Number(a.investedValue) : null,
      nativeCurrentValue: a.nativeCurrentValue !== null ? Number(a.nativeCurrentValue) : null,
      exchangeRate: a.exchangeRate !== null ? Number(a.exchangeRate) : null,
    })),
  );
  if (resumo.total <= 0) return null;
  const hoje = hojeEmBrasilia().toISOString().slice(0, 10);
  const comeco = new Date(Date.parse(`${hoje.slice(0, 7)}-01T12:00:00Z`) - 10 * 86_400_000).toISOString().slice(0, 10);
  const registros = await lerCarteiraDosDias(ctx, comeco);
  after(() => registrarCarteiraDoDia(ctx, hoje, resumo.ganho, resumo.total).catch(() => {}));
  return { total: resumo.total, ganho: resumo.ganho, rendimento: rendimentoDoMes(registros, hoje, { ganho: resumo.ganho, total: resumo.total }) };
}

export async function carregarCartoesNovos(ctx: AuthContext, r: Dados, opcoes: { assinaturas: boolean }): Promise<CartaoNaTela[]> {
  const m = r.foco.m;
  const hoje = hojeEmBrasilia();
  const [metas, dividas, contas, gastoCartao, limite, fundo, assinaturas, carteira] = await Promise.all([
    seguro(() => listarMetasDaTela(ctx, new Date())),
    seguro(() => listarDividas(ctx)),
    seguro(() => listarContasAPagar(ctx)),
    seguro(() => gastoNoCartao(ctx, r.mes.ano, r.mes.mes)),
    seguro(() => lerLimiteDoCartao(ctx)),
    seguro(() => getEmergencyFund(ctx)),
    opcoes.assinaturas ? seguro(() => cartaoDeAssinaturas(ctx, r)) : Promise.resolve(undefined),
    seguro(() => carteiraDoResumo(ctx)),
  ]);
  const saida: CartaoNaTela[] = [];
  const dado = (id: keyof typeof NOMES_DOS_CARTOES, node: ReactNode) => saida.push({ id, ...NOMES_DOS_CARTOES[id], tam: "q", node });

  const guardado = r.diaADia?.guardadoNoAno;
  if (guardado && guardado.valor > 0) {
    dado(
      "guardado",
      <Quadrado
        href="/mensal/foco/ano"
        tom="success"
        icone={<PiggyBank size={17} aria-hidden />}
        nome={`Guardado em ${r.mes.ano}`}
        numero={m(guardado.valor)}
        legenda={guardado.pct === null ? "no ano" : guardado.pct < 1 ? "menos de 1% do que entrou" : `${guardado.pct}% do que entrou`}
      />,
    );
  }

  if (fundo && Number(fundo.monthlyExpenseBase) > 0) {
    const meses = Number(fundo.currentAmount) / Number(fundo.monthlyExpenseBase);
    const meta = fundo.targetMonths > 0 ? fundo.targetMonths : 6;
    dado(
      "reserva",
      <Quadrado
        href="/planejamento/reserva-emergencia"
        tom="success"
        icone={<ShieldCheck size={17} aria-hidden />}
        nome="Reserva"
        numero={`${meses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${Math.round(meses * 10) === 10 ? "mês" : "meses"}`}
        legenda={`A meta é ${meta} meses`}
        barra={meta > 0 ? meses / meta : 0}
      />,
    );
  }

  const emAberto = (dividas ?? []).filter((d) => d.saldo > 0);
  if (emAberto.length > 0) {
    const total = emAberto.reduce((s, d) => s + d.saldo, 0);
    dado(
      "divida",
      <Quadrado
        href="/dividas"
        tom="danger"
        icone={<CircleDollarSign size={17} aria-hidden />}
        nome="Dívidas"
        numero={m(total)}
        legenda={emAberto.length === 1 ? "falta pagar, em 1 dívida" : `faltam pagar, em ${emAberto.length} dívidas`}
      />,
    );
  }

  if (contas && contas.length > 0) {
    const iso = hoje.toISOString().slice(0, 10);
    const venc = vencimentosDaJanela(contas.map(serializarConta), hoje, 7).map((v) => ({ chave: v.chave, id: v.id, nome: v.nome, valor: v.valor, aproximado: v.aproximado, vencimento: v.dia }));
    const semana = semanaDasContas(venc, iso, 0);
    const quantas = semana.dias.reduce((s, d) => s + d.contas.length, 0);
    dado(
      "contas",
      <Quadrado
        href="/orcamento/contas"
        tom="info"
        icone={<Receipt size={17} aria-hidden />}
        nome="Contas da semana"
        numero={quantas === 0 ? "Nenhuma" : quantas === 1 ? "1 conta" : `${quantas} contas`}
        legenda={quantas === 0 ? "vence nos próximos 7 dias" : `${semana.aproximado ? "Somam cerca de" : "Somam"} ${m(semana.total)}`}
      />,
    );
  }

  if ((gastoCartao ?? 0) > 0 || (limite ?? 0) > 0) {
    const gasto = gastoCartao ?? 0;
    dado(
      "cartao",
      <Quadrado
        href="/orcamento/cartao"
        tom="neutro"
        icone={<CreditCard size={17} aria-hidden />}
        nome="No cartão"
        numero={m(gasto)}
        legenda={limite ? `de um limite de ${m(limite)} no mês` : "neste mês"}
        barra={limite ? gasto / limite : undefined}
      />,
    );
  }

  if (carteira) {
    const rend = carteira.rendimento;
    const pct = rend?.pct == null ? "" : ` (${(Math.abs(rend.pct) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`;
    const desde = rend ? `${rend.desde.slice(8, 10)}/${rend.desde.slice(5, 7)}` : "";
    dado(
      "carteira",
      <Quadrado
        href="/carteira"
        tom="success"
        icone={<TrendingUp size={17} aria-hidden />}
        nome="Carteira"
        numero={m(carteira.total)}
        legenda={
          !rend
            ? "Guardando o histórico. O rendimento do mês aparece a partir de amanhã"
            : rend.valor === 0
              ? `Sem variação desde ${desde}`
              : `${rend.valor > 0 ? "Rendeu" : "Perdeu"} ${m(Math.abs(rend.valor))}${pct} desde ${desde}`
        }
      />,
    );
  }

  // Desligado: o cartão aparece na lista de adicionar, mas só ganha número depois do "Pronto".
  if (opcoes.assinaturas ? assinaturas : true) dado("assin", assinaturas ?? null);

  for (const meta of (metas ?? []).slice(0, 12)) {
    const falta = Math.max(0, meta.alvo - meta.guardado);
    saida.push({
      id: `${PREFIXO_DA_META}${meta.id}`,
      nome: meta.nome,
      desc: falta > 0 ? `Faltam ${m(falta)}` : "Meta alcançada",
      tam: "q",
      grupo: "meta",
      node: (
        <Quadrado
          href={`/planejamento/metas/${meta.id}`}
          tom="accent"
          icone={<Target size={17} aria-hidden />}
          nome={meta.nome}
          numero={falta > 0 ? m(falta) : "Pronta"}
          legenda={falta > 0 ? `faltam, de ${m(meta.alvo)}` : `você chegou aos ${m(meta.alvo)}`}
          barra={meta.alvo > 0 ? meta.guardado / meta.alvo : 0}
        />
      ),
    });
  }
  return saida;
}
