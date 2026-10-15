import type { AuthContext } from "@/lib/auth/session";
import { serverMoney } from "@/lib/money-server";
import { categoriasEssenciais } from "@/lib/categories";
import { previsaoDoMes } from "@/lib/decisoes/foco-semana";
import { cartaoDaPilha, listaDoDecidir, type CartaoDaPilha, type DadosDaPilha, type MetaDaPilha } from "@/lib/decisoes/pilha";
import type { DadosDasPilulas } from "@/lib/decisoes/esferas";
import { extraDeInicio } from "@/lib/decisoes/fluxos";
import { estouGastandoDemais, melhoreiDoMesPassado, porqueAcabouMaisRapido } from "@/lib/decisoes/respostas";
import { quantoPassou } from "@/lib/planning/remanejo";
import { carregarRespostas } from "./pergunta/[slug]/dados";

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "novembro de 2027" vira "nov/2027". */
function curto(longo: string | null): string | null {
  if (!longo) return null;
  const [mes, , ano] = longo.split(" ");
  const i = MESES.indexOf(mes);
  return i >= 0 && ano ? `${MESES_CURTOS[i]}/${ano}` : longo;
}

/**
 * Tudo que a tela do Decidir precisa numa carga: a pilha (os mesmos avisos que o Resumo conta
 * em "Decisões importantes"), o que pode esperar e os números das pílulas das esferas. A base é a
 * mesma do Foco e das respostas, para nenhum número sair diferente entre as telas.
 */
export async function carregarDecidir(ctx: AuthContext) {
  const money = await serverMoney();
  const m = (v: number) => money(v, { round: true });
  const r = await carregarRespostas(ctx);
  const { d, livre } = r;
  const hoje = { ano: d.year, mes: d.month };
  const temLivre = livre.tipo !== "semOrcamento";

  const metas: MetaDaPilha[] = r.metas
    .filter((x) => x.id)
    .map((x) => {
      const k = x.chegaEmMeses ?? null;
      const quando = k !== null ? new Date(hoje.ano, hoje.mes - 1 + k, 1) : null;
      return {
        id: x.id as string,
        nome: x.nome,
        atual: x.atual,
        alvo: x.alvo,
        prazoCurto: curto(x.prazo),
        porMes: x.necessarioPorMes,
        ritmo: x.ritmoPorMes,
        chega: quando ? { curto: `${MESES_CURTOS[quando.getMonth()]}/${quando.getFullYear()}`, ano: quando.getFullYear(), mes: quando.getMonth() + 1 } : null,
        vencida: Boolean(x.vencida),
        apertado: Boolean(x.apertado),
      };
    });

  const fimDoMes = temLivre ? previsaoDoMes(livre.planejado, livre.gastoTotal, livre.decorrido, livre.gastoUnico) : null;
  const fund = d.fund;
  const dados: DadosDaPilha = {
    money: m,
    remanejo: {
      categorias: d.categorias.map((c) => ({ key: c.key, label: c.label, planejado: c.planejado, gasto: c.gasto })),
      essenciais: [...categoriasEssenciais(ctx.categorias?.prefs)],
      livre: temLivre ? livre.restante : null,
      diasRestantes: temLivre ? livre.diasRestantes : 1,
    },
    metas,
    reserva: fund ? { atual: Number(fund.currentAmount), alvo: Number(fund.targetAmount), fimDoMes } : null,
    hrefMes: d.hrefMes,
  };
  const cartoes = (itens: typeof d.foco.atencao) => itens.map((i) => cartaoDaPilha(i, dados)).filter((c): c is CartaoDaPilha => c !== null);

  // As pílulas das esferas: os mesmos números que a resposta de cada pergunta vai mostrar.
  const planejado = d.categorias.reduce((s, c) => s + c.planejado, 0);
  const abertas = r.metas.filter((x) => x.atual < x.alvo && x.necessarioPorMes > 0);
  const guardarAlvo = Math.max(abertas.reduce((s, x) => s + x.necessarioPorMes, 0) + (r.reserva && r.reserva.atual < r.reserva.alvo ? r.reserva.porMes : 0), r.regra90 && r.renda ? r.renda * 0.1 : 0);
  const atrasada = r.metas.find((x) => x.prazo && !x.noPrazo && x.atual < x.alvo);
  const kAtrasada = atrasada?.chegaEmMeses ?? null;
  const passou = d.categorias
    .filter((c) => c.planejado > 0 && c.gasto - c.planejado >= 1)
    .sort((a, b) => b.gasto - b.planejado - (a.gasto - a.planejado))[0];
  const pilulas: Omit<DadosDasPilulas, "money" | "tema"> = {
    livreMes: temLivre ? livre.restante : null,
    // O mesmo "por dia" da resposta "Quanto posso gastar na semana?" (a da semana até domingo).
    // Antes era o livre do MÊS por dia: a esfera dizia R$ 170 e a resposta, R$ 214 (14/10/2026).
    porDia: temLivre ? livre.semana.porDia : null,
    // O mesmo número do Resumo: o que ainda cabe na semana fixa (regra A).
    ateDomingo: temLivre ? Math.max(0, livre.semana.restante) : null,
    // "Como guardar mais?" (protótipo): quanto dá para guardar a mais apertando pela regra de
    // prioridade, o mesmo número do 2 de 3 do caminho guiado.
    guardar: (() => {
      const essenciais = categoriasEssenciais(ctx.categorias?.prefs);
      const extra = extraDeInicio(
        d.categorias.map((c) => ({ key: c.key, label: c.label, planejado: c.planejado, essencial: essenciais.has(c.key) })),
        d.raioxAnual > 0 ? d.raioxAnual / 12 : 0,
      );
      return extra >= 1 ? { porMes: extra, cobre: true } : guardarAlvo >= 1 ? { porMes: guardarAlvo, cobre: (d.aportePlanejado ?? 0) >= guardarAlvo - 1 } : null;
    })(),
    metaAtrasada: atrasada
      ? {
          chegaCurto:
            kAtrasada !== null
              ? (() => {
                  const q = new Date(hoje.ano, hoje.mes - 1 + kAtrasada, 1);
                  return `${MESES_CURTOS[q.getMonth()]}/${q.getFullYear()}`;
                })()
              : null,
        }
      : null,
    metasNoRitmo: r.metas.some((x) => x.prazo && x.noPrazo),
    reserva: r.reserva && r.reserva.custoMensal > 0 ? { meses: r.reserva.atual / r.reserva.custoMensal, minimo: r.reserva.mesesMeta } : null,
    passou: passou ? { label: passou.label, valor: quantoPassou(passou) } : null,
    raioxAnual: d.raioxAnual > 0 ? d.raioxAnual : null,
    respostas: {
      demais: estouGastandoDemais({ money: m, gastoDoMes: d.summary.totalExpense, planejado, decorrido: (d.dia - 1) / d.diasNoMes, renda: r.renda, mesesDaRenda: r.mesesDaRenda, categorias: d.categorias, regra90: r.regra90 }),
      acabou: porqueAcabouMaisRapido({ money: m, atual: r.mesPassado, anterior: r.mesRetrasado, maiores: r.maioresPassado }),
      melhorei: melhoreiDoMesPassado({ money: m, atual: r.mesPassado, anterior: r.mesRetrasado }),
    },
  };

  // A mesma lista que o Resumo conta no "Mais N no Decidir" (lib/decisoes/pilha).
  const lista = listaDoDecidir(d.foco, metas.map((x) => x.id));
  return {
    pilha: cartoes(lista.pilha),
    depois: cartoes(lista.depois),
    pilulas,
    // Para a folha "Resolver agora" das respostas (Onde estou exagerando?).
    remanejo: dados.remanejo,
  };
}
