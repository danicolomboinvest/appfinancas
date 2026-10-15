import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ParentCategory } from "@prisma/client";
import { getRequiredSession } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/categories";
import { sumExpensesBetweenDates } from "@/lib/repositories/monthly-entry.repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { carregarFoco } from "../dados";
import { Ritual, SemanaQuePassou, type DadosRitual } from "./Ritual";
import { semanaPassadaDoDiaADia } from "./semana-passada";

const DIA_MS = 86_400_000;

/** Segunda a domingo da semana que terminou antes de `hoje`, e as 4 anteriores a ela (pra média). */
function semanasAnteriores(hoje: Date) {
  const diaSemana = hoje.getDay() || 7;
  const inicioDestaSemana = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (diaSemana - 1));
  return Array.from({ length: 5 }, (_, i) => {
    const de = new Date(inicioDestaSemana.getTime() - (i + 1) * 7 * DIA_MS);
    const ate = new Date(de.getTime() + 6 * DIA_MS);
    return { de: new Date(Date.UTC(de.getFullYear(), de.getMonth(), de.getDate())), ate: new Date(Date.UTC(ate.getFullYear(), ate.getMonth(), ate.getDate())) };
  });
}

/** O ritual da semana: 4 cartões, uma decisão. É a rotina de segunda da aula, dentro do app. Abre
 * em qualquer dia pelo menu ("Ritual da semana"). */
export default async function RitualPage() {
  const ctx = await getRequiredSession();
  const d = await carregarFoco(ctx);
  const semanas = semanasAnteriores(d.now);
  const somas = await Promise.all(semanas.map((s) => sumExpensesBetweenDates(ctx, s.de, s.ate)));
  const passada = semanaPassadaDoDiaADia(somas);
  const maior = passada.maior;

  const livre = d.foco.livre;
  const diasRestantes = livre.tipo === "semOrcamento" ? Math.max(1, d.diasNoMes - d.dia + 1) : livre.diasRestantes;
  // A mesma semana do Foco (regra A, 13/10/2026): cada categoria leva a parte dela do que ainda
  // cabe na semana, e a soma da lista bate com o número de cima.
  const fatorDaSemana = livre.tipo === "semOrcamento" || livre.restante <= 0 ? 0 : Math.max(0, livre.semana.restante) / livre.restante;
  const porSemana = (v: number) => v * fatorDaSemana;
  // O mesmo alvo que a aba Foco põe em primeiro: o ritual nunca contradiz o Foco (ordem por
  // estouro em reais, "correndo rápido" só antes de 70% do mês, conta fixa fora).
  // Categoria que já tem teto está decidida: fica fora ANTES de escolher, senão o primeiro aviso
  // (com teto) virava "nada pedindo atenção" e escondia a próxima categoria estourada.
  const chaveDoAviso = (id: string) => id.replace(/^(estouro|ritmo)-/, "");
  const itemAlvo = [...d.foco.atencao, ...d.foco.depois].find(
    (i) => /^(estouro|ritmo)-/.test(i.id) && !d.tetos.some((x) => x.categoria === chaveDoAviso(i.id)),
  );
  const chaveAlvo = itemAlvo ? chaveDoAviso(itemAlvo.id) : undefined;
  const categoriaAlvo = d.categorias.find((c) => c.key === chaveAlvo);
  const alvo = categoriaAlvo ? { ...categoriaAlvo, uso: categoriaAlvo.gasto / categoriaAlvo.planejado } : undefined;

  const dados: DadosRitual = {
    semana: d.semana,
    semanaPassada: {
      total: passada.total,
      media: passada.media,
      maior: maior ? { label: categoryLabel(ctx.categorias ?? ctx.profileKind, maior.parentCategory as ParentCategory), valor: maior.spent } : null,
    },
    alvo: alvo && itemAlvo ? { key: alvo.key, label: alvo.label, uso: alvo.uso, gasto: alvo.gasto, planejado: alvo.planejado, sobra: Math.max(0, alvo.planejado - alvo.gasto), diasRestantes, avisoId: itemAlvo.id } : null,
    aporteFaltando: d.aportePlanejado && d.aportePlanejado - d.summary.totalInvestment >= 1 ? d.aportePlanejado - d.summary.totalInvestment : 0,
    livreSemana: livre.tipo === "semOrcamento" ? null : livre.porSemana,
    // Dividido a partir do mesmo "livre" do Foco: a soma da lista bate com o número de cima.
    porCategoria: livre.tipo === "semOrcamento" ? [] : livre.porCategoria.filter((c) => c.restante >= 1).map((c) => ({ key: c.key, label: c.label, semana: porSemana(c.restante) })),
  };

  // Segunda e terça, o ritual inteiro (como a sugestão do Resumo). Nos outros dias, ou com o desta
  // semana já feito, a tela abre (pelo menu, 15/10/2026) na semana que passou.
  const diaDaSemana = d.now.getDay();
  const diaDoRitual = diaDaSemana === 1 || diaDaSemana === 2;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link href="/mensal/foco" className="flex min-h-11 w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} aria-hidden /> Resumo
      </Link>
      <PageHeader title={d.t.ritTitulo} />
      {diaDoRitual && !d.ritualFeito ? <Ritual d={dados} /> : <SemanaQuePassou d={dados} feito={d.ritualFeito} textoFeito={d.t.focoRitualFeito} />}
    </div>
  );
}
