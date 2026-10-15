import Link from "next/link";
import type { ReactNode } from "react";
import { CircleDollarSign, CreditCard, PiggyBank, Receipt, Repeat, ShieldCheck, Target } from "lucide-react";
import type { AuthContext } from "@/lib/auth/session";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { semanaDasContas } from "@/lib/contas/semana-das-contas";
import { vencimentosDaJanela } from "@/lib/contas/recorrentes";
import { listarContasAPagar } from "@/lib/repositories/conta-a-pagar.repo";
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

export async function carregarCartoesNovos(ctx: AuthContext, r: Dados, opcoes: { assinaturas: boolean }): Promise<CartaoNaTela[]> {
  const m = r.foco.m;
  const hoje = hojeEmBrasilia();
  const [metas, dividas, contas, gastoCartao, limite, fundo, assinaturas] = await Promise.all([
    seguro(() => listarMetasDaTela(ctx, new Date())),
    seguro(() => listarDividas(ctx)),
    seguro(() => listarContasAPagar(ctx)),
    seguro(() => gastoNoCartao(ctx, r.mes.ano, r.mes.mes)),
    seguro(() => lerLimiteDoCartao(ctx)),
    seguro(() => getEmergencyFund(ctx)),
    opcoes.assinaturas ? seguro(() => cartaoDeAssinaturas(ctx, r)) : Promise.resolve(undefined),
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
