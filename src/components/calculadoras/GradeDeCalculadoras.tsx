import Link from "next/link";
import type { Calculadora } from "@/lib/calculadoras";

/**
 * A grade das calculadoras: um cartão por ferramenta, com a pergunta que ela responde.
 *
 * Segunda versão (06/10/2026): a primeira tinha um brilho colorido no canto de cada cartão e a
 * Dani achou feia. Agora o cartão é chapado, com um tom leve da cor da calculadora, e o ícone
 * num círculo cheio dessa cor: cada uma tem cara própria sem brilho nenhum. Duas colunas no
 * celular, três no computador; quando sobra uma sozinha na última linha, ela ocupa a linha
 * inteira, deitada, em vez de deixar um buraco do lado.
 */
export function GradeDeCalculadoras({ itens }: { itens: Calculadora[] }) {
  const n = itens.length;
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-3">
      {itens.map(({ id, href, Icone, cor, titulo, apelido }, i) => {
        const ultima = i === n - 1;
        // Sozinha na última linha: deitada, ocupando a linha inteira (2 colunas no celular, 3 no computador).
        const deitadaCelular = ultima && n % 2 === 1;
        const deitadaComputador = ultima && n % 3 === 1;
        return (
          <Link
            key={id}
            href={href}
            className={`flex gap-3 rounded-2xl border p-4 transition-[filter,transform] hover:brightness-105 active:scale-[0.98] ${
              deitadaCelular ? "col-span-2 flex-row items-center" : "min-h-[7.5rem] flex-col justify-between"
            } ${
              deitadaComputador
                ? "lg:col-span-3 lg:min-h-0 lg:flex-row lg:items-center lg:justify-start"
                : "lg:col-span-1 lg:min-h-[7.5rem] lg:flex-col lg:items-start lg:justify-between"
            }`}
            style={{
              background: `color-mix(in srgb, ${cor} 11%, var(--color-surface))`,
              borderColor: `color-mix(in srgb, ${cor} 20%, transparent)`,
            }}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ background: cor }}>
              <Icone size={19} strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-snug text-ink">{titulo}</span>
              {apelido && <span className="mt-0.5 block text-caption text-ink-muted">{apelido}</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
