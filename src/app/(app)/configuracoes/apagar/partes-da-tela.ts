import { Calculator, Map as MapaIcone, PieChart, ReceiptText, Tags, Target, TrendingUp, WalletCards, type LucideIcon } from "lucide-react";
import type { Parte } from "@/lib/limpar-dados/regras";

/**
 * Como cada parte da limpeza aparece na tela: o nome curto (listas e tela final), o nome da
 * escolha, uma linha do que vem junto e o ícone. A ordem é a de PARTES (regras.ts).
 */
export const PARTE_NA_TELA: Record<Parte, { curto: string; titulo: string; sub: string; Icone: LucideIcon }> = {
  lancamentos: {
    curto: "Lançamentos",
    titulo: "Lançamentos e importações",
    sub: "Levam junto o Dinheiro perdido, as contas achadas no extrato e os bancos conectados",
    Icone: ReceiptText,
  },
  orcamento: { curto: "Orçamento", titulo: "Orçamento", sub: "Limites do mês e do cartão", Icone: PieChart },
  metas: { curto: "Metas e sonhos", titulo: "Metas e sonhos", sub: "Com as fotos e a reserva", Icone: Target },
  contas: { curto: "Contas e dívidas", titulo: "Contas e dívidas", sub: "Contas a pagar e parcelas", Icone: WalletCards },
  carteira: { curto: "Carteira", titulo: "Carteira e investimentos", sub: "Ativos, estratégia e fichas", Icone: TrendingUp },
  categorias: {
    curto: "Categorias criadas",
    titulo: "Categorias criadas e o que o app aprendeu",
    sub: "Só sai junto com Lançamentos e Orçamento, que usam as categorias",
    Icone: Tags,
  },
  moneyReset: { curto: "Money Reset", titulo: "Progresso do Money Reset", sub: "O mapa e as respostas. A compra fica", Icone: MapaIcone },
  calculadoras: { curto: "Calculadoras", titulo: "Calculadoras e planejamento", sub: "Simulações salvas e a aposentadoria", Icone: Calculator },
};
