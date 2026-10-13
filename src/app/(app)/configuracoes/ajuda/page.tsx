import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Cabecalho } from "../_ajustes/Lista";

export const metadata = { title: "Central de ajuda · SPI Finance" };

const PERGUNTAS: [string, string][] = [
  ["Como importo o extrato?", "Na Visão geral, toque em + › Importar. Serve PDF do banco ou da fatura."],
  ["O que é o \"para gastar nesta semana\"?", "Já tiramos o guardar e as contas do mês. O resto, dividido pelas semanas. O valor da semana fica parado de segunda a domingo; o que sobra ou passa muda a semana seguinte."],
  ["Meus dados estão seguros?", "Ficam cifrados. O SPI não entra na sua conta do banco: você traz o extrato. Ele só lê o arquivo e nunca move dinheiro."],
];

/** Central de ajuda (protótipo, #configuracoes-ajuda): três perguntas que abrem e o Falar com o suporte. */
export default function AjudaPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Central de ajuda" />
      <div className="divide-y divide-border rounded-3xl border border-border bg-surface px-4">
        {PERGUNTAS.map(([q, r]) => (
          <details key={q} className="group py-1">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-medium text-ink">
              {q}
              <ChevronDown size={16} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="pb-3 text-sm text-ink-muted">{r}</p>
          </details>
        ))}
      </div>
      <Link href="/configuracoes/suporte" className="flex min-h-12 items-center justify-center rounded-full bg-surface text-[15px] font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
        Falar com o suporte
      </Link>
    </div>
  );
}
