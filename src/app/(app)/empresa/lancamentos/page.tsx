import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { dentroDoPeriodo, lerGrupo, mesesDoPeriodo, noGrupo, parametrosDoPeriodo, periodoDoTipo } from "@/lib/empresa/periodo";
import { periodoDaTela, nomesDasCategorias } from "@/lib/empresa/periodo-dados";
import { ehForma } from "@/lib/empresa/config";
import type { LancamentoDaEmpresa } from "@/lib/empresa/regras";
import { linhasDaEmpresaNosMeses } from "@/lib/repositories/empresa.repo";
import { perfisDeDestino } from "@/lib/repositories/mover-perfil.repo";
import { dadosDaDivisao, listRecentSubcategories } from "@/lib/repositories/monthly-entry.repo";
import { listCustomCategories } from "@/lib/repositories/custom-category.repo";
import { listGoals } from "@/lib/repositories/goal.repo";
import { valoresOcultos } from "@/lib/money-server";
import { EntryList } from "../../mensal/[year]/[month]/EntryList";
import { linhasDaLista } from "../../mensal/[year]/[month]/linhas";
import { Cartao, Voltar } from "../partes";
import { CabecalhoDaLista } from "./CabecalhoDaLista";

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * "Editar lá" (13/10/2026): tocar num total ou numa categoria da Empresa abre os lançamentos
 * daquele período e daquele grupo (?ver=entradas|despesas|...|cat:X|cliente:Y), na mesma lista das
 * Transações. Cada um abre a folha de editar de sempre: valor, data, categoria, cliente, enviar
 * para outro perfil. O mês "fechado" da Empresa é só o mês que acabou: nada trava a edição.
 */
export default async function LancamentosDaEmpresa(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const dados = await carregarEmpresa(ctx);
  if (!dados.config) redirect("/empresa");
  // Lançamentos abre no mês de hoje (15/10/2026, a Dani): a venda que ela acabou de registrar tem de
  // estar na lista. O último mês fechado continua o padrão da Visão geral e dos Relatórios.
  const periodo = periodoDaTela(sp, dados.hoje, () => periodoDoTipo("mes", dados.hoje));
  const grupo = lerGrupo(um(sp.ver));
  const voltaLida = um(sp.volta);
  const volta = voltaLida && /^\/empresa(\/[a-z-]+)?$/.test(voltaLida) ? voltaLida : "/empresa";

  const [linhas, ocultos, recentSubcategories, customCategories, goals, divisao, perfisDestino, custom] = await Promise.all([
    linhasDaEmpresaNosMeses(ctx, mesesDoPeriodo(periodo)),
    valoresOcultos(),
    listRecentSubcategories(ctx),
    listCustomCategories(ctx),
    listGoals(ctx),
    dadosDaDivisao(ctx),
    perfisDeDestino(ctx),
    nomesDasCategorias(ctx),
  ]);

  // A mesma regra das somas: o que a tela somou é o que aparece aqui.
  const comoNaConta = (l: (typeof linhas)[number]): LancamentoDaEmpresa => ({
    id: l.id,
    year: l.year,
    month: l.month,
    category: l.category,
    parentCategory: l.parentCategory,
    customCategoryId: l.customCategoryId,
    subcategory: l.subcategory,
    description: l.description,
    amount: Number(l.amount),
    entryDate: iso(l.entryDate),
    cliente: l.cliente,
    forma: ehForma(l.formaDeRecebimento) ? l.formaDeRecebimento : null,
    externalId: l.externalId,
  });
  const naConta = linhas.map((l) => ({ l, c: comoNaConta(l) })).filter(({ c }) => dentroDoPeriodo(c, periodo) && (!grupo || noGrupo(c, grupo)));
  const entra = (c: LancamentoDaEmpresa) => (c.category === "INCOME" ? c.amount : -c.amount);
  const total = Math.round(naConta.reduce((s, { c }) => s + (grupo === "lucro" || !grupo ? entra(c) : c.amount), 0) * 100) / 100;

  return (
    <>
      <Voltar href={`${volta}?${parametrosDoPeriodo(periodo)}`}>{dados.nome}</Voltar>
      <CabecalhoDaLista grupo={grupo} periodo={periodo} hoje={dados.hoje} total={total} n={naConta.length} ehMei={dados.config.tipo === "MEI"} custom={custom} />
      {naConta.length === 0 ? (
        <Cartao className="px-6 py-8 text-center text-sm text-ink-muted">Nada neste período.</Cartao>
      ) : (
        <EntryList
          year={Number(periodo.ate.slice(0, 4))}
          month={Number(periodo.ate.slice(5, 7))}
          recentSubcategories={recentSubcategories}
          customCategories={customCategories}
          goals={goals.map((g) => ({ id: g.id, name: g.name }))}
          pessoasDaDivisao={divisao.pessoas}
          perfisDestino={perfisDestino}
          entries={linhasDaLista(
            naConta.map(({ l }) => l),
            ocultos,
            ctx,
            null,
          )}
        />
      )}
    </>
  );
}
