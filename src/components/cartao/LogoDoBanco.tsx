import { CreditCard } from "lucide-react";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { bancoDoCartao } from "@/lib/cartao/bancos";

/**
 * O logo real do banco do cartão, com a mesma regra dos logos das listas (cor oficial com o logo
 * branco, ou o logo multicolorido no quadrado branco). "Outro" fica no quadrado neutro com o
 * ícone do cartão, nunca uma inicial.
 */
export function LogoDoBanco({ banco, size = 40 }: { banco: string; size?: 36 | 40 | 44 | 48 }) {
  // Aro fino: o logo escuro (XP, C6) não some no fundo escuro.
  return (
    <span className="inline-flex shrink-0 rounded-[30%] ring-1 ring-border">
      <LogoDoLancamento descricao={bancoDoCartao(banco).apelido || null} icon={CreditCard} size={size} />
    </span>
  );
}
