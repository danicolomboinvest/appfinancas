import { ChevronRight, CreditCard } from "lucide-react";
import Link from "next/link";
import { Cabecalho, Cartao } from "../_ajustes/Lista";
import { ImportarExtrato } from "../_ajustes/Interativos";

export const metadata = { title: "Contas e cartões · SPI Finance" };

/**
 * Contas e cartões (rodadas 25 e 33): "Importar extrato" no lugar do "Conectar meu banco" (nada de
 * Open Finance na versão nova) e o limite do cartão.
 */
export default function ContasECartoesPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Contas e cartões" sub="De onde vêm os seus extratos." />
      <Cartao>
        <b className="text-[15px] font-medium text-ink">Importar extrato</b>
        <p className="text-sm text-ink-muted">Você baixa o extrato ou a fatura no app do seu banco e manda aqui. Eu leio PDF, Excel, CSV e OFX e separo tudo.</p>
        <ImportarExtrato />
        <p className="text-[13px] text-ink-muted">O SPI não entra na sua conta do banco e não pede a senha dele.</p>
      </Cartao>
      <Link href="/orcamento/cartao" className="flex min-h-14 items-center gap-3 rounded-3xl border border-border bg-surface px-4">
        <CreditCard size={18} className="shrink-0 text-ink-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] text-ink">Limite do cartão</span>
          <span className="block text-[13px] text-ink-muted">Quanto você combinou gastar no cartão por mês</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
      </Link>
    </div>
  );
}
