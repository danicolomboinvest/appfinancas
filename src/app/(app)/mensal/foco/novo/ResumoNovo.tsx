import Link from "next/link";
import { ChevronRight, CreditCard, Receipt } from "lucide-react";
import type { AuthContext } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ConquistasDeMetas } from "@/components/conquista/ConquistasDeMetas";
import { ProximosMeses } from "@/components/previsao/MesesPrevistos";
import { carregarMesesPrevistos } from "@/lib/repositories/previsao.repo";
import { paraParametro } from "@/lib/visao-geral/periodo";
import { lerComecoDaConta } from "@/lib/repositories/comeco.repo";
import { mostrarPerguntaDoSegundoDia, mostrarPrimeirosPassos } from "@/lib/onboarding/comeco";
import { acertoDaCasa } from "@/lib/repositories/casa.repo";
import { casaNaTela } from "@/lib/casa/regras";
import { MESES } from "../dados";
import { ContaDoLivre } from "../ContaDoLivre";
import { ComoChegamos } from "../ComoChegamos";
import { CartaoAcerto } from "../CartaoAcerto";
import { PerguntaDoSegundoDia, PrimeirosPassos } from "../DepoisDoComeco";
import { carregarResumoNovo, type InfoDaCategoria, type ResumoNovo as Dados } from "./dados";
import { CartaoSugestao } from "./CartaoSugestao";
import { HeroiDaPrimeiraVez, HeroiDoDiaADia, HeroiDoDigitou, HeroiDoMesFechado, HeroiDoNada, type CorDoHeroi } from "./Heroi";
import { direcao, type Mes } from "./regras";

const ENVIAR = "/comecar?passo=volta";
const nome = (m: Mes) => MESES[m.mes - 1];
const BOTAO = "inline-flex min-h-11 items-center rounded-full bg-accent-gradient px-5 text-[15px] font-semibold text-on-accent";

/**
 * O Resumo novo (proposta de 14/10/2026, para todos desde 15/10): um número grande e até 3 blocos.
 * O número é o que o dado dela diz com certeza (ver regras.ts); os blocos são UMA sugestão, as 4
 * categorias que mais mudaram e a linha da semana. Os próximos meses ficam abaixo da dobra.
 * Saem daqui o "Faltou", o gráfico de 6 meses e o Money Reset (continuam nos lugares deles); as
 * Decisões importantes e o "Para hoje" viram a fila da sugestão.
 */
export async function ResumoNovo({ ctx, cor, hojeDeTeste }: { ctx: AuthContext; cor: CorDoHeroi; hojeDeTeste: Date | null }) {
  const r = await carregarResumoNovo(ctx, hojeDeTeste);
  const casa = casaNaTela(ctx.casa);
  const seguinte = r.mes.mes === 12 ? { ano: r.mes.ano + 1, mes: 1 } : { ano: r.mes.ano, mes: r.mes.mes + 1 };
  const [comeco, acerto, proximos] = await Promise.all([
    lerComecoDaConta(ctx.userId),
    casa ? acertoDaCasa(ctx, r.mes.ano, r.mes.mes) : Promise.resolve(null),
    r.caso === "dia-a-dia" || r.caso === "mes-fechado" ? carregarMesesPrevistos(ctx, r.mes, seguinte, 3) : Promise.resolve([]),
  ]);
  const m = r.foco.m;
  const temDado = r.caso !== "nada";
  const hojeIso = `${r.hoje.getFullYear()}-${String(r.hoje.getMonth() + 1).padStart(2, "0")}-${String(r.hoje.getDate()).padStart(2, "0")}`;
  // Primeiros passos e a pergunta do segundo dia ocupam o lugar da sugestão enquanto existirem.
  const passos = comeco && temDado && mostrarPrimeirosPassos(comeco);
  const pergunta = temDado && mostrarPerguntaDoSegundoDia(comeco, hojeIso);

  const heroi =
    r.caso === "dia-a-dia" && r.diaADia ? (
      <HeroiDoDiaADia h={r.diaADia} mes={r.mes} passado={r.passado} money={m} cor={cor} />
    ) : r.caso === "mes-fechado" && r.mesFechado ? (
      <HeroiDoMesFechado h={r.mesFechado} money={m} cor={cor} />
    ) : r.primeiraVez ? (
      <HeroiDaPrimeiraVez h={r.primeiraVez} money={m} cor={cor} />
    ) : r.digitou ? (
      <HeroiDoDigitou h={r.digitou} mes={r.mes} money={m} cor={cor} />
    ) : (
      <HeroiDoNada passado={r.passado} cor={cor} enviar={ENVIAR} money={m} />
    );

  const primeira = r.caso === "extrato" || r.caso === "extrato-fatura" || r.caso === "fatura" || r.caso === "digitou";
  const titulo =
    r.caso === "extrato" ? `Pronto. Esse é o seu ${nome(r.primeiraVez!.mes)}.` : r.caso === "extrato-fatura" ? "Pronto. Agora com o cartão aberto." : r.caso === "fatura" ? `Pronto. Esse é o seu cartão em ${nome(r.primeiraVez!.mes)}.` : r.caso === "digitou" && r.digitou?.n === 1 ? "Primeiro gasto anotado." : null;

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6" data-resumo-novo={r.caso}>
      <div className="flex min-w-0 flex-col gap-5">
        <ConquistasDeMetas ctx={ctx} />
        {titulo && <h2 className="titulo-tema px-1 text-[1.45rem] font-normal leading-tight text-ink">{titulo}</h2>}
        {heroi}
        {r.caso === "extrato-fatura" && <p className="-mt-3 px-1 text-[13px] font-medium text-ink-muted">Fatura aberta. Nada contado duas vezes.</p>}

        {/* Bloco 1: uma sugestão (ou o próximo passo da primeira vez). */}
        {primeira ? (
          <ProximoPasso r={r} money={m} />
        ) : passos && comeco ? (
          <PrimeirosPassos ctx={ctx} comeco={comeco} hrefMes={r.foco.hrefMes} />
        ) : pergunta ? (
          <PerguntaDoSegundoDia />
        ) : r.sugestao ? (
          <CartaoSugestao key={`${r.sugestao.tipo}|${r.sugestao.id}`} sugestao={r.sugestao} marca={r.marca} maisNoDecidir={r.maisNoDecidir} />
        ) : r.maisNoDecidir > 0 ? (
          <Link href="/decidir" className="px-1 text-[13px] font-medium text-ink-muted underline-offset-4 hover:underline">
            {r.maisNoDecidir === 1 ? "1 decisão no Decidir" : `${r.maisNoDecidir} decisões no Decidir`}
          </Link>
        ) : null}

        {casa && acerto && <CartaoAcerto acerto={acerto} casa={casa} money={m} href={`/mensal/foco/acerto?mes=${r.mes.ano}-${r.mes.mes}`} />}
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {/* Bloco 2: as categorias que mais mudaram (a primeira vez mostra "para onde foi"). */}
        {r.categorias.length > 0 && <Categorias r={r} money={m} />}
        {r.primeiraVez && <ParaOndeFoi r={r} money={m} />}
        {/* Bloco 3: a semana numa linha. */}
        {(r.caso === "dia-a-dia" || r.caso === "mes-fechado") && <LinhaDaSemana r={r} money={m} />}
        {/* Abaixo da dobra: os próximos meses (parcelas, contas e assinaturas contra a renda média). */}
        {proximos.length > 0 && <ProximosMeses meses={proximos} money={m} href={(p) => `/mensal/foco?mes=${paraParametro(p)}${cor !== "a" ? `&cor=${cor}` : ""}`} />}
      </div>
    </div>
  );
}

function IconeDa({ c }: { c: InfoDaCategoria }) {
  return <CategoryIcon icon={c.icone} color={c.cor} size={40} />;
}

function Categorias({ r, money }: { r: Dados; money: (v: number) => string }) {
  const topo = Math.max(1, ...r.categorias.flatMap((c) => [c.atual, c.passado]));
  return (
    <section className="flex flex-col gap-2.5" data-bloco-categorias>
      <h2 className="px-1 text-base font-semibold text-ink">Contra {nome(r.passado)}, no mesmo dia</h2>
      <Card className="flex flex-col p-1.5">
        {r.categorias.map((c) => {
          const d = direcao(c.diferenca);
          return (
            <Link key={c.chave} href="/mensal/gastos" className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-surface-2">
              <IconeDa c={c} />
              <span className="flex min-w-0 flex-col gap-1">
                <b className="truncate text-[15px] font-semibold text-ink">{c.nome}</b>
                <span className="text-[12.5px] text-ink-muted">{c.compras === 1 ? "1 compra" : `${c.compras} compras`}</span>
                <span className="flex flex-col gap-[3px]" aria-hidden>
                  <i className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (c.atual / topo) * 100)}%`, background: c.cor }} />
                  <i className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (c.passado / topo) * 100)}%`, background: c.cor, opacity: 0.38 }} />
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <b className="text-[15px] font-semibold tabular-nums text-ink">{money(c.atual)}</b>
                <span className={`whitespace-nowrap text-[12.5px] font-medium ${d === "menos" ? "text-success" : d === "mais" ? "text-accent-strong" : "text-ink-muted"}`}>
                  {d === "igual" ? "igual" : `${money(Math.abs(c.diferenca))} a ${d}`}
                </span>
              </span>
            </Link>
          );
        })}
        <Link href="/mensal/gastos" className="flex min-h-11 items-center justify-center gap-1 text-[14px] font-semibold text-ink">
          Ver todas as categorias <ChevronRight size={15} aria-hidden />
        </Link>
      </Card>
      <p className="px-1 text-[12.5px] text-ink-muted">A barra cheia é {nome(r.mes)}; a clara, {nome(r.passado)} até o mesmo dia.</p>
    </section>
  );
}

function LinhaDaSemana({ r, money }: { r: Dados; money: (v: number) => string }) {
  const livre = r.foco.foco.livre;
  if (livre.tipo === "semOrcamento") {
    return (
      <Card className="flex items-center justify-between gap-3 p-4">
        <span className="text-[15px] font-medium text-ink">Para gastar nesta semana</span>
        <Link href="/orcamento" className="text-[14px] font-semibold text-accent-strong">
          Montar o mês
        </Link>
      </Card>
    );
  }
  const passou = livre.semana.passou >= 1;
  return (
    <Card className="flex flex-col p-1.5" data-linha-semana>
      <ContaDoLivre titulo={r.foco.t.focoComoCheguei} conta={<ComoChegamos livre={livre} money={money} rendaSoOQueEntrou={r.foco.rendaSoOQueEntrou} />}>
        <span className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2.5">
          <span className="text-[15px] font-medium text-ink">{passou ? "Passou da semana" : "Para gastar nesta semana"}</span>
          <span className="flex items-center gap-1">
            <b className="text-[17px] font-semibold tabular-nums text-ink">{money(passou ? livre.semana.passou : Math.max(0, livre.semana.restante))}</b>
            <ChevronRight size={15} className="text-ink-muted" aria-hidden />
          </span>
        </span>
      </ContaDoLivre>
      <span className="px-2.5 pb-2 text-[12.5px] text-ink-muted">
        {r.dataDoDado} ·{" "}
        {/* "atualizar" sozinho não dizia o quê (15/10/2026): o número só fica certo com o extrato novo. */}
        <Link href={ENVIAR} className="font-semibold text-ink underline underline-offset-2">
          mandar extrato novo
        </Link>
      </span>
    </Card>
  );
}

function ProximoPasso({ r, money }: { r: Dados; money: (v: number) => string }) {
  const p = r.primeiraVez;
  let texto: string;
  let botoes: { rotulo: string; href: string }[];
  if (r.caso === "fatura" && p) {
    texto = `Quanto ficou com você em ${nome(p.mes)}? Mande o extrato da conta e eu conto o que entrou.`;
    botoes = [{ rotulo: "Mandar o extrato", href: ENVIAR }];
  } else if (r.caso === "digitou") {
    texto = `Quer ver o mês inteiro? Com o extrato de ${nome(r.passado)}, eu mostro quanto ficou com você.`;
    botoes = [
      { rotulo: "Mandar o extrato", href: ENVIAR },
      { rotulo: "Anotar outro", href: "/comecar?passo=digitar" },
    ];
  } else if (p?.faturaUmGasto) {
    texto = `A fatura de ${money(p.faturaUmGasto)} entrou como um gasto só. Mande a fatura e eu abro por categoria.`;
    botoes = [{ rotulo: "Mandar a fatura", href: ENVIAR }];
  } else {
    texto = `Com o extrato de ${nome(r.mes)}, eu comparo com ${p ? nome(p.mes) : nome(r.passado)} no mesmo dia.`;
    botoes = [{ rotulo: "Mandar o extrato", href: ENVIAR }];
  }
  return (
    <Card className="flex flex-col gap-3 p-4" data-proximo-passo>
      <p className="text-[12.5px] font-semibold text-ink-muted">Próximo passo</p>
      <p className="-mt-1 text-[15px] font-medium leading-snug text-ink">{texto}</p>
      <div className="flex flex-wrap gap-2">
        {botoes.map((b, i) => (
          <Link key={b.rotulo} href={b.href} className={i === 0 ? BOTAO : "inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold text-ink underline underline-offset-4"}>
            {b.rotulo}
          </Link>
        ))}
      </div>
    </Card>
  );
}

function ParaOndeFoi({ r, money }: { r: Dados; money: (v: number) => string }) {
  const p = r.primeiraVez!;
  const linha = (chave: string, icone: React.ReactNode, titulo: string, sub: string, valor: string) => (
    <div key={chave} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-2.5 py-2.5">
      {icone}
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px] font-semibold text-ink">{titulo}</b>
        <span className="text-[12.5px] text-ink-muted">{sub}</span>
      </span>
      <b className="text-[15px] font-semibold tabular-nums text-ink">{valor}</b>
    </div>
  );
  const redondo = (Icone: typeof Receipt) => (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong" aria-hidden>
      <Icone size={18} />
    </span>
  );
  const proximo = (m: Mes) => MESES[m.mes % 12];
  return (
    <section className="flex flex-col gap-2.5" data-para-onde-foi>
      <h2 className="px-1 text-base font-semibold text-ink">{p.cartao ? `Os ${p.paraOndeFoi.length} maiores` : "Para onde foi"}</h2>
      <Card className="flex flex-col p-1.5">
        {p.faturaUmGasto && linha("fatura", redondo(CreditCard), "Fatura do cartão", "um valor só, por enquanto", money(p.faturaUmGasto))}
        {p.paraOndeFoi.map((c) => linha(c.chave, <IconeDa c={c} />, c.nome, p.cartao ? `${c.compras === 1 ? "1 compra" : `${c.compras} compras`} · ${c.pct}%` : `${c.compras === 1 ? "1 compra" : `${c.compras} compras`}`, money(c.valor)))}
        {p.parcelas && linha("parcelas", redondo(CreditCard), p.parcelas.n === 1 ? "1 parcela" : `${p.parcelas.n} parcelas`, `por mês, até ${nome(p.parcelas.acabaEm)}; em ${proximo(p.parcelas.acabaEm)}, ${money(p.parcelas.valor)} a mais`, money(p.parcelas.valor))}
        {p.tarifas && linha("tarifas", redondo(Receipt), p.tarifas.n === 1 ? "Achei 1 tarifa" : `Achei ${p.tarifas.n} tarifas`, "do banco, por mês", money(p.tarifas.mensal))}
      </Card>
    </section>
  );
}
