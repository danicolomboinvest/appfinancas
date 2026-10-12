import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { MESES, resumoDaEmpresa } from "@/lib/empresa/resumo";
import { textoDoTeto } from "@/lib/empresa/legal";
import { Explica } from "@/components/ui/Explica";
import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { ValorDestaque } from "@/components/ui/ValorDestaque";
import { serverMoney } from "@/lib/money-server";
import { Cartao, Titulo, Voltar } from "../partes";

const mil = (v: number) => `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;

/**
 * O medidor do MEI (protótipo aprovado): o faturado no ano contra o teto, a faixa da guia extra até a
 * tolerância e, no ritmo dos últimos meses, quando passa. Teto e faixa vêm da tabela legal, com a
 * fonte e a data no "?". Fora do MEI, ou sem o teto na tabela, a tela não existe: volta para a
 * Visão geral da Empresa (12/10/2026, nada de "em breve").
 */
export default async function LimitePage() {
  const ctx = await getRequiredSession();
  const [dados, money] = await Promise.all([carregarEmpresa(ctx), serverMoney()]);
  if (!dados.config) redirect("/empresa");
  const R = resumoDaEmpresa(dados);
  const m0 = (v: number) => money(v, { round: true });
  const L = R.limite;
  const ajuda = textoDoTeto(dados.legal);

  if (!L) redirect("/empresa");

  // O arco vai de 0 até a tolerância; a marca fica no teto.
  const R0 = 110;
  const C = Math.PI * R0;
  const fr = (v: number) => Math.min(1, Math.max(0, v / L.tolerancia));
  const a = Math.PI * (L.teto / L.tolerancia);
  const ponto = (raio: number) => [130 - Math.cos(a) * raio, 135 - Math.sin(a) * raio];
  const [x1, y1] = ponto(92);
  const [x2, y2] = ponto(122);
  const [xt, yt] = ponto(128);
  const arco = "M20 135 A110 110 0 0 1 240 135";

  return (
    <>
      <Voltar>{dados.nome}</Voltar>
      <Titulo>
        Limite do MEI <small className="text-sm text-ink-muted">{dados.mesAtual.ano}</small>
      </Titulo>
      <HeroiDoTema className="relative">
        {ajuda && (
          <span className="absolute right-4 top-4">
            <Explica noHeroi rotulo="As faixas do teto">{ajuda}</Explica>
          </span>
        )}
        <svg viewBox="-8 -14 296 170" role="img" aria-label={`Faturou ${m0(L.faturado)} de ${m0(L.teto)}. A faixa até ${m0(L.tolerancia)} está marcada.`} className="mx-auto w-full max-w-[300px]">
          <path d={arco} fill="none" stroke="color-mix(in srgb, var(--color-heroi-tinta) 13%, transparent)" strokeWidth={16} strokeLinecap="round" />
          <path d={arco} fill="none" stroke="var(--color-atencao)" strokeOpacity={0.55} strokeWidth={16} strokeDasharray={`${(C * (1 - L.teto / L.tolerancia)).toFixed(1)} ${C.toFixed(1)}`} strokeDashoffset={(-C * (L.teto / L.tolerancia)).toFixed(1)} />
          <path d={arco} fill="none" stroke="var(--color-heroi-tinta)" strokeWidth={16} strokeLinecap="round" strokeDasharray={`${(C * fr(L.faturado)).toFixed(1)} ${C.toFixed(1)}`} />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-heroi-tinta)" strokeWidth={2} />
          <text x={xt} y={yt - 2} fontSize={11} fill="currentColor" textAnchor="start">{mil(L.teto)}</text>
          <text x={20} y={152} fontSize={11} fill="currentColor" textAnchor="middle">0</text>
          <text x={240} y={152} fontSize={11} fill="currentColor" textAnchor="middle">{mil(L.tolerancia)}</text>
        </svg>
        <div className="-mt-16 flex flex-col items-center pb-6">
          <ValorDestaque texto={m0(L.faturado)} />
          <small className="text-sm text-heroi-suave">de {m0(L.teto)}</small>
        </div>
      </HeroiDoTema>
      <p className="text-center text-[15px] text-ink">
        {L.faixa === "mei" ? (
          <>
            Cabem mais <b className="font-semibold">{m0(L.cabe)}</b> este ano.
          </>
        ) : L.faixa === "guia-extra" ? (
          "Passou do teto: paga uma guia extra e deixa de ser MEI em janeiro."
        ) : (
          "Passou da faixa: deixa de ser MEI desde janeiro deste ano."
        )}
      </p>
      {(L.faixa !== "mei" || L.passaEm) && (
        <div className="flex items-start gap-3 rounded-3xl bg-danger-soft px-4 py-3.5 text-danger">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <b className="block text-[15px] font-medium">{L.faixa !== "mei" ? "Hora de mudar de tipo" : `No seu ritmo, passa em ${MESES[L.passaEm! - 1]}`}</b>
            <small className="text-sm text-ink">Fale com um contador.</small>
          </span>
        </div>
      )}
      <Cartao className="divide-y divide-border px-4">
        <div className="flex min-h-14 items-center gap-3">
          <i className="size-3 rounded-full bg-ink" aria-hidden />
          <b className="flex-1 text-[15px] font-medium text-ink">Continua MEI</b>
          <span className="text-[15px] text-ink">até {m0(L.teto)}</span>
        </div>
        <div className="flex min-h-14 items-center gap-3">
          <i className="size-3 rounded-full bg-[var(--color-atencao)]" aria-hidden />
          <b className="flex-1 text-[15px] font-medium text-ink">Guia extra</b>
          <span className="text-[15px] text-ink">até {m0(L.tolerancia)}</span>
        </div>
      </Cartao>
    </>
  );
}
