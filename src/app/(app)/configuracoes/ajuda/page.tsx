import Link from "next/link";
import { CircleHelp, Repeat } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { LINK_COMO_FUNCIONA, LINK_VER_DE_NOVO, estadoDasNovidades } from "@/lib/novidades/passos";
import { Cabecalho } from "../_ajustes/Lista";
import { SUPORTE_EMAIL } from "../_ajustes/suporte";

export const metadata = { title: "Central de ajuda · SPI Finance" };

const PERGUNTAS: [string, string][] = [
  ["Como o app sabe a categoria de um gasto?", 'Pelo nome da loja. Quando você corrige, ele aprende e acerta da próxima vez (em Categorias, "O que o app já aprendeu").'],
  ["O que é o livre até domingo?", "O que sobra do orçamento do mês, dividido pelos dias que faltam, vezes os dias até domingo."],
  ["Meus dados estão seguros?", "O SPI não entra na sua conta do banco: você traz o extrato. Ele só lê o arquivo, não move dinheiro e não vende nem compartilha nada."],
  ["Como cancelo a assinatura?", `Escreva para ${SUPORTE_EMAIL} com o e-mail da sua conta.`],
];

/**
 * Central de ajuda (rodadas 25 e 33): as perguntas mais comuns, os vídeos do Como funciona e,
 * para quem já usava o app, o "Tivemos uma mudança" de novo (tutorial da versão nova).
 */
export default async function AjudaPage() {
  const user = await getOwnUser(await getRequiredSession());
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Central de ajuda" sub="Perguntas frequentes." />
      <div className="divide-y divide-border rounded-3xl border border-border bg-surface px-4">
        {PERGUNTAS.map(([q, r]) => (
          <details key={q} className="group py-1">
            <summary className="flex min-h-12 cursor-pointer list-none items-center text-[15px] font-medium text-ink">{q}</summary>
            <p className="pb-3 text-sm text-ink-muted">{r}</p>
          </details>
        ))}
      </div>
      <Link href={LINK_COMO_FUNCIONA} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-2 text-[15px] text-ink">
        <CircleHelp size={16} aria-hidden /> Como funciona: os vídeos
      </Link>
      {estadoDasNovidades(user.novidadesVersaoNova) !== "novo" && (
        <Link href={LINK_VER_DE_NOVO} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-2 text-[15px] text-ink">
          <Repeat size={16} aria-hidden /> Ver de novo o que mudou
        </Link>
      )}
    </div>
  );
}
