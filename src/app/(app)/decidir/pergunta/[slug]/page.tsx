import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import type { PerguntaDoDecidir } from "@/lib/profiles/textos/foco";
import { serverMoney } from "@/lib/money-server";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
import { RespostaDesenhada } from "@/components/decisoes/RespostaDesenhada";
import { FluxoGuardarMais, FluxoMinhaMeta } from "@/components/decisoes/Fluxos";
import { nowInBrazil } from "@/lib/date/brazil-now";
import {
  comAbertura,
  estouGastandoDemais,
  melhoreiDoMesPassado,
  minhaReservaBasta,
  ondeEstouExagerando,
  porqueAcabouMaisRapido,
  quandoAtinjoMinhaMeta,
  quantoPossoGastarNaSemana,
  quantoPrecisoGuardar,
  type Resposta,
  type Tom,
} from "@/lib/decisoes/respostas";
import { carregarRespostas, PERGUNTAS } from "./dados";
import { ResolverAgora } from "@/components/decisoes/ResolverAgora";
import { categoriasEssenciais } from "@/lib/categories";
import { MESES } from "@/app/(app)/mensal/foco/dados";

const TONS: Tom[] = ["padrao", "girly", "manifestacao", "titanio"];

/**
 * Uma pergunta, uma resposta: a Central conversa com a pessoa. Primeiro a resposta em uma frase,
 * no tom do tema; depois os números que sustentam; depois o que fazer. A conta fica recolhida
 * pra quem quiser conferir.
 */
export default async function PerguntaPage(props: PageProps<"/decidir/pergunta/[slug]">) {
  const { slug } = await props.params;
  if (!PERGUNTAS[slug]) notFound();
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const tx = vozDoTema(ctx.profileTheme, ctx.profileKind).titulos;
  // A pergunta na voz do tema, a mesma do catálogo do Decidir. PERGUNTAS (dados.ts) diz quais
  // existem e continua sendo o nome no "Isso está errado?", que a Dani lê sempre igual.
  const naVoz = (chave: string) => tx.decPerguntas[chave as PerguntaDoDecidir] ?? PERGUNTAS[chave];
  const pergunta = naVoz(slug);
  const money = await serverMoney();
  const m = (v: number) => money(v, { round: true });
  const r = await carregarRespostas(ctx);
  const { d } = r;
  const planejado = d.categorias.reduce((s, c) => s + c.planejado, 0);
  const decorrido = (d.dia - 1) / d.diasNoMes;

  // Os dois caminhos guiados do protótipo (passo a passo, não uma resposta só).
  const hojeDoMes = { ano: d.year, mes: d.month };
  if (slug === "guardar" || slug === "meta") {
    const essenciais = categoriasEssenciais(ctx.categorias?.prefs);
    return (
      <div className="flex flex-col gap-5">
        {slug === "guardar" ? (
          <FluxoGuardarMais
            guarda={d.aportePlanejado ?? 0}
            renda={r.renda}
            categorias={d.categorias.map((c) => ({ key: c.key, label: c.label, planejado: c.planejado, essencial: essenciais.has(c.key) }))}
            repeteNoMes={d.raioxAnual > 0 ? d.raioxAnual / 12 : 0}
            metas={r.metasDoFluxo}
            hoje={hojeDoMes}
          />
        ) : (
          <FluxoMinhaMeta metas={r.metasDoFluxo} hoje={hojeDoMes} />
        )}
        <div className="border-t border-border pt-3">
          <ReportarErro tela={`Decidir: ${PERGUNTAS[slug]}`} regra={`caminho guiado: ${slug}`} />
        </div>
      </div>
    );
  }

  let resposta: Resposta;
  switch (slug) {
    case "semana":
      resposta = quantoPossoGastarNaSemana({
        money: m,
        semana: r.livre.tipo === "semOrcamento" ? null : r.livre.semana,
        diasSemLancar: r.livre.tipo === "semOrcamento" ? null : r.livre.diasSemLancar,
      });
      break;
    case "gastando":
      resposta = estouGastandoDemais({ money: m, gastoDoMes: d.summary.totalExpense, planejado, decorrido, renda: r.renda, mesesDaRenda: r.mesesDaRenda, categorias: d.categorias, regra90: r.regra90 });
      break;
    case "exagerando":
      resposta = ondeEstouExagerando({
        money: m,
        decorrido,
        categorias: d.categorias,
        fora: Math.max(0, d.summary.totalExpense - d.categorias.reduce((s, c) => s + c.gasto, 0)),
        maiores: d.maioresGastos.map((g) => ({ descricao: g.descricao, valor: g.valor, categoria: g.categoria })),
        recorrentesAno: d.raioxAnual > 0 ? d.raioxAnual : null,
      });
      break;
    case "guardar":
      resposta = quantoPrecisoGuardar({
        money: m,
        metas: r.metas,
        reserva: r.reserva && r.reserva.atual < r.reserva.alvo ? { porMes: r.reserva.porMes, falta: r.reserva.alvo - r.reserva.atual } : null,
        guardarPlanejado: d.aportePlanejado,
        // Casal só com a conta conjunta: os 10% mínimos são da renda de cada um, não do repasse.
        renda: r.regra90 ? r.renda : null,
        mesesDaRenda: r.regra90 ? r.mesesDaRenda : null,
      });
      break;
    case "meta":
      resposta = quandoAtinjoMinhaMeta({ money: m, metas: r.metas });
      break;
    case "reserva":
      resposta = minhaReservaBasta({ money: m, reserva: r.reserva, gastoReal: r.gastoReal });
      break;
    case "acabou":
      resposta = porqueAcabouMaisRapido({ money: m, atual: r.mesPassado, anterior: r.mesRetrasado, maiores: r.maioresPassado });
      break;
    default:
      resposta = melhoreiDoMesPassado({ money: m, atual: r.mesPassado, anterior: r.mesRetrasado });
  }
  const tom = (TONS as string[]).includes(ctx.profileTheme) ? (ctx.profileTheme as Tom) : "padrao";
  resposta = comAbertura(tom, resposta);

  const primeira = resposta.acoes[0];
  const classeDoBotao = "flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-5 text-base font-medium text-surface";
  const botao = primeira ? (
    primeira.resolver ? (
      <ResolverAgora
        rotulo={primeira.rotulo}
        categoria={primeira.resolver}
        categorias={d.categorias.map((c) => ({ key: c.key, label: c.label, planejado: c.planejado, gasto: c.gasto }))}
        essenciais={[...categoriasEssenciais(ctx.categorias?.prefs)]}
        livre={r.livre.tipo === "semOrcamento" ? null : r.livre.restante}
        diasRestantes={r.livre.tipo === "semOrcamento" ? 1 : r.livre.diasRestantes}
        proximoMes={MESES[d.month % 12]}
        className={classeDoBotao}
      />
    ) : (
      <Link href={primeira.href} className={classeDoBotao}>
        {primeira.rotulo}
      </Link>
    )
  ) : null;

  // "Quanto posso gastar na semana?": a régua dos 7 dias do Resumo (protótipo r67), com os dias que
  // faltam até domingo em dourado e o valor por dia.
  const hojeNaSemana = (nowInBrazil().getDay() + 6) % 7;
  const semanaFixa = r.livre.tipo === "semOrcamento" ? null : r.livre.semana;
  const ateDomingo = semanaFixa ? semanaFixa.diasAteOFim : 7 - hojeNaSemana;
  const regua =
    slug === "semana" && semanaFixa !== null ? (
      <div className="flex flex-col items-center gap-2.5 rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_var(--color-border)]" data-regua-semana>
        <b className="text-xl font-normal tabular-nums text-ink">{m(semanaFixa.porDia)} por dia</b>
        <div className="grid w-full grid-cols-7 gap-1.5" role="img" aria-label={semanaFixa.acabaNoDomingo ? `Faltam ${ateDomingo} dias até domingo` : `Faltam ${ateDomingo} dias até o fim do mês`}>
          {["S", "T", "Q", "Q", "S", "S", "D"].map((l, i) => (
            <span key={i} className={`flex flex-col items-center gap-1.5 text-xs ${i >= hojeNaSemana && i < hojeNaSemana + ateDomingo ? "text-ink" : "text-ink-muted"} ${i === hojeNaSemana ? "font-medium" : ""}`}>
              <i className={`h-1.5 w-full rounded ${i >= hojeNaSemana && i < hojeNaSemana + ateDomingo ? "bg-[var(--color-dinheiro-guardou)]" : "bg-border-strong"}`} />
              {l}
            </span>
          ))}
        </div>
        <small className="text-xs text-ink-muted">{!semanaFixa.acabaNoDomingo ? `${ateDomingo === 1 ? "1 dia" : `${ateDomingo} dias`} até o fim do mês` : ateDomingo === 1 ? "Hoje é domingo" : `${ateDomingo} dias até domingo`}</small>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/decidir" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> {tx.decTitulo}
      </Link>

      {/* Versão nova (protótipo, #decidir-semana e as outras): rótulo da pergunta, o herói, os
          blocos e um botão preto. O "Como cheguei nisso" e o "Isso está errado?" ficam embaixo,
          pequenos. */}
      <RespostaDesenhada pergunta={pergunta} resposta={resposta} depoisDoHeroi={regua} botao={botao} />

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {(resposta.conta.length > 0 || resposta.visual) && (
          <details>
            <summary className="cursor-pointer text-caption font-medium text-ink-muted hover:text-ink">{tx.focoComoCheguei}</summary>
            <div className="mt-2 flex flex-col gap-1.5 text-caption text-ink-muted">
              <p className="text-ink">{resposta.frase}</p>
              {resposta.detalhes.map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-caption">
              {resposta.conta.map((c) => (
                <div key={c.rotulo} className="contents">
                  <dt className="text-ink-muted">{c.rotulo}</dt>
                  <dd className="text-right tabular-nums text-ink">{c.valor}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        <ReportarErro tela={`Decidir: ${PERGUNTAS[slug]}`} regra={`resposta calculada: ${slug}`} />
      </div>
    </div>
  );
}
