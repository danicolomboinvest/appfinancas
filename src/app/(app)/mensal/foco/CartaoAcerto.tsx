import Link from "next/link";
import { FORMA_DO_ACERTO, MioloDoAcerto } from "@/components/casa/MioloDoAcerto";
import type { CasaNaTela } from "@/lib/casa/regras";
import type { AcertoDaCasa } from "@/lib/repositories/casa.repo";

/**
 * "Acerto do mês" (Casal simples, protótipo aprovado): debaixo de Decisões importantes, no mesmo
 * desenho. As duas bolinhas, o valor do acerto numa pílula e a seta. Tocar abre o acerto.
 */
export function CartaoAcerto({ acerto, casa, money, href }: { acerto: AcertoDaCasa; casa: CasaNaTela; money: (v: number) => string; href: string }) {
  const valor = Math.round(Math.abs(acerto.euMando));
  const pilula = acerto.acertado ? "Acertado" : valor < 1 ? "Quites" : money(valor);
  return (
    <Link
      href={href}
      data-cartao-acerto
      aria-label={`Acerto do mês: ${pilula}`}
      className={FORMA_DO_ACERTO}
    >
      <MioloDoAcerto casa={casa} pilula={pilula} />
    </Link>
  );
}
