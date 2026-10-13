import { Bolinha } from "@/components/casal-login/visual";
import type { CasaNaTela } from "@/lib/casa/regras";

/**
 * As peças do Casal simples (13/10/2026). As cores das duas pessoas vêm do tema (--casal-*, as
 * mesmas do Nós dois): quem paga o Casal no destaque do tema, o par no azul acinzentado. Cada
 * pessoa é sempre a mesma cor nos dois logins.
 */

/** A bolinha de quem gastou, no canto do logo do lançamento. */
export function BolinhaDeQuemGastou({ casa, dono, size = 20 }: { casa: CasaNaTela; dono: "eu" | "outro"; size?: number }) {
  const p = dono === "eu" ? casa.eu : casa.outro;
  return (
    <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-surface" data-quem-gastou={dono}>
      <Bolinha nome={p.nome} cor={p.papel} size={size} />
    </span>
  );
}

/** As duas bolinhas juntas, pequenas: "o mês soma os dois". */
export function DuasBolinhas({ casa, size = 26 }: { casa: CasaNaTela; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${casa.eu.nome} e ${casa.outro.nome}`} role="img" data-duas-bolinhas>
      <Bolinha nome={casa.eu.nome} cor={casa.eu.papel} size={size} className="relative z-[1] ring-2 ring-canvas" />
      <span style={{ marginLeft: -size * 0.28 }} className="rounded-full ring-2 ring-canvas">
        <Bolinha nome={casa.outro.nome} cor={casa.outro.papel} size={size} />
      </span>
    </span>
  );
}
