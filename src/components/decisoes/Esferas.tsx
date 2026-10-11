import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PERGUNTAS_DO_DECIDIR, pilulaDaPergunta, tituloDaEsfera, type DadosDasPilulas, type PerguntaDoDecidir } from "@/lib/decisoes/esferas";
import { OBJETOS_DAS_ESFERAS } from "./objetos-das-esferas";
import "./decidir.css";

/**
 * Os gradientes do material dos objetos, uma vez na tela. As cores são as do tema (--ob-m*), então
 * a mesma esfera troca de cor sozinha com o tema e com o claro/escuro.
 */
export function GradientesDasEsferas() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute size-0 overflow-hidden">
      <defs>
        <linearGradient id="dc-obA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--ob-m1)" }} />
          <stop offset=".55" style={{ stopColor: "var(--ob-m2)" }} />
          <stop offset="1" style={{ stopColor: "var(--ob-m3)" }} />
        </linearGradient>
        <linearGradient id="dc-obB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--ob-m0)" }} />
          <stop offset="1" style={{ stopColor: "var(--ob-m1)" }} />
        </linearGradient>
        <linearGradient id="dc-obC" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--ob-m2)" }} />
          <stop offset="1" style={{ stopColor: "var(--ob-m4)" }} />
        </linearGradient>
        <radialGradient id="dc-obV" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".6" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity=".1" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Uma pergunta: o cartão claro, a esfera com o objeto, a pílula com o dado vivo e o título. */
export function Esfera({ p, dados }: { p: PerguntaDoDecidir; dados: DadosDasPilulas }) {
  const pilula = pilulaDaPergunta(p.chave, dados);
  const titulo = tituloDaEsfera(p, dados.tema);
  return (
    <Link href={p.href} className="ob-c" aria-label={pilula ? `${titulo} ${pilula.texto}` : titulo}>
      <span className="ob-o">
        <span className="ob-halo" />
        <span className="ob-esf">
          {/* Desenho fixo do próprio app (objetos-das-esferas.ts), nunca texto de fora. */}
          <svg viewBox="0 0 64 64" aria-hidden dangerouslySetInnerHTML={{ __html: OBJETOS_DAS_ESFERAS[p.chave] ?? "" }} />
        </span>
        {pilula && (
          <span className={`ob-p${pilula.atencao ? " att" : ""}`}>
            <i aria-hidden />
            {pilula.texto}
          </span>
        )}
      </span>
      <b className="ob-t">{titulo}</b>
    </Link>
  );
}

/** "Qual é a sua pergunta?": as 4 primeiras em 2 × 2 e o "Ver todas as perguntas · 10". */
export function EsferasDoDecidir({ dados }: { dados: DadosDasPilulas }) {
  return (
    <section className="flex flex-col gap-3.5" aria-labelledby="dc-perguntas" data-tour="esferas">
      <GradientesDasEsferas />
      <h2 id="dc-perguntas" className="px-1 text-[17px] font-semibold text-ink">
        Qual é a sua pergunta?
      </h2>
      <div className="ob-grade">
        {PERGUNTAS_DO_DECIDIR.slice(0, 4).map((p) => (
          <Esfera key={p.chave} p={p} dados={dados} />
        ))}
      </div>
      <Link href="/decidir/perguntas" className="ob-todas">
        Ver todas as perguntas <span>· {PERGUNTAS_DO_DECIDIR.length}</span>
        <ChevronRight size={16} aria-hidden />
      </Link>
    </section>
  );
}
