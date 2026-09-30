import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { vozDoTema } from "@/lib/profiles/voice";
import type { PerguntaDoDecidir } from "@/lib/profiles/textos/foco";
import { serverMoney } from "@/lib/money-server";
import { Card } from "@/components/ui/Card";
import { ReportarErro } from "@/components/decisoes/ReportarErro";
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

const TONS: Tom[] = ["padrao", "girly", "minimalista", "disciplina", "semfiltro", "game", "manifestacao"];

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

  let resposta: Resposta;
  switch (slug) {
    case "semana":
      resposta = quantoPossoGastarNaSemana({
        money: m,
        livreSemana: r.livre.tipo === "semOrcamento" ? null : r.livre.porSemana,
        livreMes: r.livre.tipo === "semOrcamento" ? null : r.livre.restante,
        diasRestantes: Math.max(1, d.diasNoMes - d.dia + 1),
        diasSemLancar: r.livre.tipo === "semOrcamento" ? null : r.livre.diasSemLancar,
      });
      break;
    case "gastando":
      resposta = estouGastandoDemais({ money: m, gastoDoMes: d.summary.totalExpense, planejado, decorrido, renda: r.renda, categorias: d.categorias, regra90: r.regra90 });
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
  const cor = resposta.veredito === "bom" ? "bg-success" : resposta.veredito === "atencao" ? "bg-accent" : "bg-danger";
  const outras = Object.entries(PERGUNTAS).filter(([k]) => k !== slug);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/decidir" className="flex w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft size={16} /> {tx.decTitulo}
      </Link>

      {/* A pergunta dela, como numa conversa. */}
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-pill px-4 py-3 text-sm font-semibold text-on-pill">{pergunta}</p>

      <Card className="flex gap-4 p-5">
        <span className={`w-1 shrink-0 rounded-full ${cor}`} aria-hidden />
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-lg font-semibold leading-snug text-ink">{resposta.frase}</p>
          {resposta.detalhes.map((t) => (
            <p key={t} className="text-sm text-ink-muted">
              {t}
            </p>
          ))}
          {resposta.acoes.length > 0 && (
            <div className="mt-1 flex flex-col gap-2">
              {resposta.acoes.map((a, i) => (
                <Link
                  key={a.href + a.rotulo}
                  href={a.href}
                  className={i === 0 ? "rounded-2xl bg-pill px-4 py-3 text-sm font-semibold text-on-pill" : "rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-ink-muted"}
                >
                  {a.rotulo}
                </Link>
              ))}
            </div>
          )}
          {resposta.conta.length > 0 && (
            <details className="border-t border-border pt-3">
              <summary className="cursor-pointer text-caption font-semibold text-accent-strong">{tx.focoComoCheguei}</summary>
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
      </Card>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption font-semibold uppercase tracking-[0.11em] text-ink-muted">{tx.decPergunteTambem}</h2>
        <div className="flex flex-wrap gap-2">
          {outras.map(([k]) => (
            <Link key={k} href={`/decidir/pergunta/${k}`} className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 py-2 text-caption font-medium text-ink hover:bg-surface-hover">
              {naVoz(k)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
