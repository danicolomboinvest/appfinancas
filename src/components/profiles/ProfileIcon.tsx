import { createElement } from "react";
import {
  Wallet, Briefcase, Heart, Home, Target, Circle, Plane, PiggyBank,
  GraduationCap, Car, Baby, Building2, Landmark, Gift, Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Os ícones que um perfil pode ter.
 *
 * Biblioteca de ícones, não emoji: emoji muda de desenho em cada aparelho e puxa o produto pro
 * lado infantil. A lista é curta de propósito — quinze opções que cobrem os casos reais e
 * deixam a escolha rápida, em vez de um catálogo de mil ícones pra pessoa se perder.
 */
export const PROFILE_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "wallet", label: "Carteira", Icon: Wallet },
  { key: "briefcase", label: "Trabalho", Icon: Briefcase },
  { key: "heart", label: "Casal", Icon: Heart },
  { key: "home", label: "Casa", Icon: Home },
  { key: "target", label: "Projeto", Icon: Target },
  { key: "plane", label: "Viagem", Icon: Plane },
  { key: "piggy-bank", label: "Poupança", Icon: PiggyBank },
  { key: "graduation-cap", label: "Estudos", Icon: GraduationCap },
  { key: "car", label: "Carro", Icon: Car },
  { key: "baby", label: "Família", Icon: Baby },
  { key: "building", label: "Empresa", Icon: Building2 },
  { key: "landmark", label: "Investimentos", Icon: Landmark },
  { key: "gift", label: "Presente", Icon: Gift },
  { key: "sparkles", label: "Outro", Icon: Sparkles },
  { key: "circle", label: "Neutro", Icon: Circle },
];

const PELO_NOME = new Map(PROFILE_ICONS.map((i) => [i.key, i.Icon]));

/**
 * Ícone gravado numa versão anterior cai na carteira, em vez de sumir da tela.
 *
 * Monta com createElement em vez de JSX porque o ícone é ESCOLHIDO em tempo de render: escrito
 * como `<Icon />`, o lint entende (com razão) que um componente novo está nascendo a cada
 * desenho, o que zeraria estado se este ícone algum dia tivesse algum.
 */
export function ProfileIcon({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  return createElement(PELO_NOME.get(name) ?? Wallet, { size, strokeWidth: 1.75, className });
}
