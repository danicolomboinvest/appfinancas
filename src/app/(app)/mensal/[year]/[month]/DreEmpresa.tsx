import Link from "next/link";
import type { Money } from "@/lib/profiles/voice";
import type { DadosDaEmpresa } from "@/lib/profiles/empresa-dados";
import { MESES_DE_CAIXA_RECOMENDADOS } from "@/lib/profiles/empresa";

/**
 * A DRE simplificada do perfil Empresa, mais três indicadores que o Sebrae põe no básico de
 * qualquer negócio: ponto de equilíbrio, margem e meses de caixa.
 *
 * É a conta que separa uma empresa de uma pessoa: pessoa lê "entrou − gastou = sobrou";
 * empresa lê receita → impostos → custos que variam com a venda → margem de contribuição →
 * despesas fixas → lucro. Cada linha vem das categorias que a pessoa já usa (ver
 * CATEGORIAS_EMPRESA): nada aqui pede cadastro novo.
 */
export function DreEmpresa({ dados, money, periodo, compacto = false }: { dados: DadosDaEmpresa; money: Money; periodo: string; compacto?: boolean }) {
  const { dre, caixa } = dados;
  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
  const vazio = dre.receitaBruta === 0 && dre.despesasFixas === 0 && dre.custosVariaveis === 0 && dre.impostos === 0;
  if (vazio) return null;

  const linhas: { rotulo: string; valor: number; tipo: "entrada" | "saida" | "subtotal" | "total"; nota?: string }[] = [
    { rotulo: "Receita bruta", valor: dre.receitaBruta, tipo: "entrada" },
    { rotulo: "Impostos e taxas", valor: dre.impostos, tipo: "saida" },
    { rotulo: "Receita líquida", valor: dre.receitaLiquida, tipo: "subtotal" },
    { rotulo: "Custos variáveis", valor: dre.custosVariaveis, tipo: "saida", nota: "mercadorias, logística, marketing" },
    { rotulo: "Margem de contribuição", valor: dre.margemContribuicao, tipo: "subtotal" },
    { rotulo: "Despesas fixas", valor: dre.despesasFixas, tipo: "saida", nota: "estrutura, equipe, serviços" },
    { rotulo: "Lucro operacional", valor: dre.lucroOperacional, tipo: "total" },
  ];
  if (dre.retido > 0) {
    linhas.push({ rotulo: "Retido (caixa e reinvestimento)", valor: dre.retido, tipo: "saida" });
    linhas.push({ rotulo: "Ficou no caixa", valor: dre.sobraNoCaixa, tipo: "total" });
  }

  const corDoCaixa = caixa.situacao === "curto" ? "text-danger" : caixa.situacao === "ok" ? "text-accent-strong" : caixa.situacao === "folgado" ? "text-success" : "text-ink-muted";
  const mesesTexto =
    caixa.mesesDeCaixa === null ? "—" : caixa.mesesDeCaixa >= 12 ? "12+ meses" : `${caixa.mesesDeCaixa.toFixed(1).replace(".", ",")} ${caixa.mesesDeCaixa >= 1.95 ? "meses" : "mês"}`;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">DRE de {periodo}</h2>
        <span className="text-caption text-ink-faint">receita → impostos → custos → despesas → lucro</span>
      </div>

      <div className={`mt-3 ${compacto ? "" : "lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-6"}`}>
        <ol className="flex flex-col">
          {linhas.map((l) => {
            const negativo = l.valor < 0;
            const classe =
              l.tipo === "total"
                ? `border-t border-border py-2.5 text-[15px] font-semibold ${negativo ? "text-danger" : "text-success"}`
                : l.tipo === "subtotal"
                  ? "border-t border-border/60 py-2 text-sm font-medium text-ink"
                  : l.tipo === "entrada"
                    ? "py-2 text-sm text-ink"
                    : "py-1.5 text-sm text-ink-muted";
            return (
              <li key={l.rotulo} className={`flex items-baseline justify-between gap-3 ${classe}`}>
                <span className="min-w-0">
                  {l.tipo === "saida" && <span className="mr-1 text-ink-faint">−</span>}
                  {l.rotulo}
                  {l.nota && <span className="ml-1.5 text-caption text-ink-faint">{l.nota}</span>}
                </span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  {negativo ? `−${money(Math.abs(l.valor), { round: true })}` : money(l.valor, { round: true })}
                  {/* O peso de cada linha na receita, como nos painéis de gestão: "impostos 6%, lucro 15%". */}
                  <span className="w-9 text-right text-caption text-ink-faint">{dre.receitaBruta > 0 ? `${Math.round((l.valor / dre.receitaBruta) * 100)}%` : ""}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {/* Os três números que dizem se o negócio para em pé. */}
        <div className={`mt-4 grid gap-2 sm:grid-cols-3 ${compacto ? "" : "lg:mt-0 lg:grid-cols-1 lg:content-start"}`}>
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <p className="text-caption font-medium text-ink-muted">Ponto de equilíbrio</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums text-ink">{dre.pontoDeEquilibrio === null ? "—" : money(dre.pontoDeEquilibrio, { round: true })}</p>
            <p className="mt-0.5 text-caption text-ink-faint">
              {dre.pontoDeEquilibrio === null
                ? dre.receitaBruta === 0
                  ? "Registre a receita pra calcular."
                  : "Cada venda perde dinheiro: os custos variáveis passam da receita."
                : dre.receitaBruta >= dre.pontoDeEquilibrio
                  ? "Faturamento mínimo pra pagar as contas. Já passou ✓"
                  : `Faturamento mínimo pra pagar as contas. Faltam ${money(dre.pontoDeEquilibrio - dre.receitaBruta, { round: true })}.`}
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3.5 py-3">
            <p className="text-caption font-medium text-ink-muted">Margem líquida</p>
            <p className={`mt-0.5 text-[17px] font-semibold tabular-nums ${dre.margemLiquidaPct !== null && dre.margemLiquidaPct < 0 ? "text-danger" : "text-ink"}`}>{pct(dre.margemLiquidaPct)}</p>
            <p className="mt-0.5 text-caption text-ink-faint">De cada {money(100, { round: true })} faturados, quanto vira lucro.</p>
          </div>
          <Link href="/planejamento/reserva-emergencia" className="rounded-xl bg-surface-2 px-3.5 py-3 transition-colors hover:bg-surface-hover">
            <p className="text-caption font-medium text-ink-muted">Caixa de segurança</p>
            <p className={`mt-0.5 text-[17px] font-semibold tabular-nums ${corDoCaixa}`}>{mesesTexto}</p>
            <p className="mt-0.5 text-caption text-ink-faint">
              {caixa.situacao === "sem-dado"
                ? "Marque o caixa da empresa como reserva na carteira."
                : `${money(caixa.caixa, { round: true })} cobre as despesas fixas por esse tempo. Sebrae: ${MESES_DE_CAIXA_RECOMENDADOS.minimo} a ${MESES_DE_CAIXA_RECOMENDADOS.confortavel} meses.`}
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
}
