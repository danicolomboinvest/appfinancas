import { getRequiredSession } from "@/lib/auth/session";
import { cartaoDoPerfil } from "@/lib/repositories/cartao.repo";
import { NovoCartao } from "./NovoCartao";

/** Cadastrar um cartão (ou mudar os dias de um, com ?id=). Uma pergunta por tela. */
export default async function NovoCartaoPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const ctx = await getRequiredSession();
  const { id } = await searchParams;
  const cartao = await cartaoDoPerfil(ctx, id);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h1 font-bold tracking-tight text-ink">{cartao ? "Mudar o cartão" : "Novo cartão"}</h1>
      <NovoCartao
        inicial={cartao ? { id: cartao.id, banco: cartao.banco, apelido: cartao.apelido, diaFechamento: cartao.diaFechamento, diaVencimento: cartao.diaVencimento } : null}
      />
    </div>
  );
}
