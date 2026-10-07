import { Car, Clock, Home, Landmark, Scale, Sunrise, TrendingUp, type LucideIcon } from "lucide-react";
import type { Titulos } from "@/lib/profiles/voice";

/**
 * As calculadoras do app, num lugar só (06/10/2026): a tela Calculadoras, o Decidir e o atalho
 * do Foco mostram a mesma grade. Cada uma tem a cor de uma categoria parecida (casa com Moradia,
 * carro com Transporte) para a grade não virar uma lista cinza.
 */
export type Calculadora = {
  id: string;
  href: string;
  Icone: LucideIcon;
  cor: string;
  titulo: string;
  /** O nome com que o curso chama a ferramenta, quando a pergunta não o usa (06/10/2026). A Dani
   * procurou "Marcação a Mercado" e não achou: a pergunta sem jargão escondia o nome que ela conhece.
   * Nome de mercado, não voz do tema: fica igual em todo tema. */
  apelido?: string;
};

export function calculadoras(t: Pick<Titulos, "decPerguntas" | "calcAposentadoria">): Calculadora[] {
  const p = t.decPerguntas;
  return [
    { id: "financiar", href: "/simuladores/financiar-vs-alugar", Icone: Home, cor: "var(--color-cat-moradia)", titulo: p.financiar },
    { id: "carro", href: "/simuladores/carro", Icone: Car, cor: "var(--color-cat-transporte)", titulo: p.carro },
    { id: "vale-a-pena", href: "/simuladores/vale-a-pena", Icone: Clock, cor: "var(--color-cat-alimentacao)", titulo: p.valeAPena },
    { id: "consorcio", href: "/simuladores/consorcio", Icone: Scale, cor: "var(--color-cat-educacao)", titulo: p.consorcio },
    { id: "amortizar", href: "/simuladores/amortizar-vs-investir", Icone: Landmark, cor: "var(--color-cat-saude)", titulo: p.amortizar, apelido: "Amortizar ou investir" },
    { id: "marcacao", href: "/simuladores/marcacao-mercado", Icone: TrendingUp, cor: "var(--color-cat-lazer)", titulo: p.marcacao, apelido: "Marcação a mercado" },
    // A cor do destaque do tema (dourado no Padrão, rosa no Girly): o verde fixo destoava no Girly.
    { id: "aposentadoria", href: "/planejamento/acumulo", Icone: Sunrise, cor: "var(--color-accent)", titulo: t.calcAposentadoria },
  ];
}
