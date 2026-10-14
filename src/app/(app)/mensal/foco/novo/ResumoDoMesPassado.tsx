import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import type { AuthContext } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { serverMoney } from "@/lib/money-server";
import { acertoDaCasa } from "@/lib/repositories/casa.repo";
import { casaNaTela } from "@/lib/casa/regras";
import { MESES } from "../dados";
import { CartaoAcerto } from "../CartaoAcerto";
import { carregarMesPassado } from "./dados-mes-passado";
import { HeroiDoMesFechado, type CorDoHeroi } from "./Heroi";
import { ListaDeCategorias } from "./ListaDeCategorias";
import type { Mes } from "./regras";

const ENVIAR = "/comecar?passo=volta";
const BOTAO = "inline-flex min-h-11 items-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent";

/**
 * O Resumo de um mês que já passou (14/10/2026): como foi o fechamento dele. O herói do mês
 * fechado, para onde foi o dinheiro contra o mês anterior e a linha do fechamento. Nada do mês de
 * agora (semana, sugestões, próximos meses).
 */
export async function ResumoDoMesPassado({ ctx, mes, agora, cor }: { ctx: AuthContext; mes: Mes; agora: Mes; cor: CorDoHeroi }) {
  const casa = casaNaTela(ctx.casa);
  const [r, moneyR, acerto] = await Promise.all([carregarMesPassado(ctx, mes, agora), serverMoney(), casa ? acertoDaCasa(ctx, mes.ano, mes.mes) : Promise.resolve(null)]);
  const money = (v: number) => moneyR(v, { round: true });
  const nome = MESES[mes.mes - 1];

  if (!r.heroi) {
    return (
      <Card className="flex flex-col items-start gap-3 p-5" data-mes-passado="vazio">
        <p className="text-[17px] font-semibold text-ink">Sem lançamentos em {nome}</p>
        <Link href={ENVIAR} className={BOTAO}>
          Mandar extrato de {nome}
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6" data-mes-passado="cheio">
      <div className="flex min-w-0 flex-col gap-5">
        <HeroiDoMesFechado h={r.heroi} money={money} cor={cor} />
        {r.fechamento?.tipo === "fechar" ? (
          <Link href="/mensal/foco/fechamento" className="-mt-2 flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5" data-fechamento="fechar">
            <CalendarCheck size={18} className="shrink-0 text-accent-strong" aria-hidden />
            <span className="min-w-0 flex-1 text-[14px] text-ink-muted">Não fechado</span>
            <span className="shrink-0 rounded-full bg-pill px-4 py-2 text-[14px] font-semibold text-on-pill">{r.fechamento.rotulo}</span>
          </Link>
        ) : r.fechamento?.tipo === "fechado" ? (
          <p className="-mt-2 flex items-center gap-1.5 px-1 text-[13px] text-ink-muted" data-fechamento="fechado">
            <CalendarCheck size={14} aria-hidden />
            {r.fechamento.rotulo}
          </p>
        ) : null}
        {casa && acerto && <CartaoAcerto acerto={acerto} casa={casa} money={money} href={`/mensal/foco/acerto?mes=${mes.ano}-${mes.mes}`} />}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {r.categorias.length > 0 && (
          <ListaDeCategorias
            titulo={r.comparou ? `Para onde foi, contra ${MESES[r.anterior.mes - 1]}` : "Para onde foi"}
            linhas={r.categorias}
            money={money}
            comparar={r.comparou}
            href={`/mensal/gastos?view=mes&year=${mes.ano}&month=${mes.mes}`}
          />
        )}
      </div>
    </div>
  );
}
