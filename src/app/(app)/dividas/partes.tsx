import { Car, ClipboardList, Coins, CreditCard, House, Landmark, ReceiptText, ShoppingBag, Tag, Users, Zap, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { marcaDaDescricao } from "@/lib/marcas/marca";
import { perfilDoTipo, type IconeDoTipo, type TipoDeDivida } from "@/lib/dividas/tipos";
import { descricaoDoCredor, FRASE_DA_SAUDE, type Saude } from "@/lib/dividas/saude";

/** Ícone de traço de cada tipo (o Rota usava emoji; o SPI não usa emoji na interface). */
export const ICONE: Record<IconeDoTipo, LucideIcon> = {
  cartao: CreditCard,
  banco: Landmark,
  sacola: ShoppingBag,
  fatura: ReceiptText,
  moedas: Coins,
  folha: ClipboardList,
  carro: Car,
  casa: House,
  raio: Zap,
  pessoas: Users,
  etiqueta: Tag,
};

export const iconeDoTipo = (tipo: TipoDeDivida): LucideIcon => ICONE[perfilDoTipo(tipo).icone];

/** As cores dos pontos na rota e nos canhotos, na ordem de ataque. */
export const CORES_DA_ORDEM = ["var(--color-danger)", "var(--color-info)", "var(--color-accent)", "var(--color-success)"];

/** Cor de cada estado: cara = terracota (perigo), atenção = âmbar, saudável = sálvia. */
export const COR_DA_SAUDE: Record<Saude, { texto: string; fundo: string; Icone: LucideIcon }> = {
  saudavel: { texto: "var(--color-success)", fundo: "var(--color-success-soft)", Icone: CircleCheck },
  atencao: { texto: "var(--color-atencao)", fundo: "var(--color-atencao-fundo)", Icone: TriangleAlert },
  cara: { texto: "var(--color-danger)", fundo: "var(--color-danger-soft)", Icone: Zap },
};

export function SeloDaSaude({ saude, comIcone = false }: { saude: Saude; comIcone?: boolean }) {
  const c = COR_DA_SAUDE[saude];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: c.texto, backgroundColor: c.fundo }}>
      {comIcone && <c.Icone size={14} strokeWidth={1.8} aria-hidden />}
      {FRASE_DA_SAUDE[saude].selo}
    </span>
  );
}

/** O logo real do credor (Nubank, Caixa, Itaú…); sem marca conhecida, o ícone do tipo no tom do estado. */
export function LogoDoCredor({ credor, tipo, saude, size = 40 }: { credor: string; tipo: TipoDeDivida; saude: Saude; size?: 36 | 40 | 44 }) {
  const descricao = descricaoDoCredor(credor);
  if (marcaDaDescricao(descricao)) return <LogoDoLancamento descricao={descricao} icon={iconeDoTipo(tipo)} size={size} />;
  return <LogoDoLancamento descricao={null} icon={iconeDoTipo(tipo)} cor={COR_DA_SAUDE[saude].texto} size={size} />;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export type Hoje = { ano: number; mes: number };

/** O mês daqui a `k` meses (k = 0 é este). */
export function mesAdiante(hoje: Hoje, k: number): Hoje {
  const i = hoje.mes - 1 + k;
  return { ano: hoje.ano + Math.floor(i / 12), mes: (((i % 12) + 12) % 12) + 1 };
}
/** "OUT 26" (a caixa alta vem do CSS). */
export const mesDoBilhete = (m: Hoje) => `${MESES_CURTOS[m.mes - 1]} ${String(m.ano).slice(2)}`;
/** "mar/27". */
export const mesCurto = (m: Hoje) => `${MESES_CURTOS[m.mes - 1]}/${String(m.ano).slice(2)}`;
/** "setembro de 2027". */
export const mesPorExtenso = (m: Hoje) => `${MESES[m.mes - 1]} de ${m.ano}`;

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** "1,5" sem casas sobrando. */
export const pct = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
