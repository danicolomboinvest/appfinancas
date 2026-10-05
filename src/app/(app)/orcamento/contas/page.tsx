import { getRequiredSession } from "@/lib/auth/session";
import { hojeEmBrasilia } from "@/lib/contas/contas";
import { listarContasAPagar, listarQuitadasRecentes } from "@/lib/repositories/conta-a-pagar.repo";
import { ContasAPagar } from "./ContasAPagar";
import { iso, serializarConta } from "./serializar";

/** Contas a pagar com lembrete (05/10/2026). `?nova=1` abre o formulário: é o caminho do "+". */
export default async function ContasPage(props: PageProps<"/orcamento/contas">) {
  const sp = await props.searchParams;
  const ctx = await getRequiredSession();
  const [abertas, pagas] = await Promise.all([listarContasAPagar(ctx), listarQuitadasRecentes(ctx)]);
  return <ContasAPagar contas={abertas.map(serializarConta)} pagas={pagas.map(serializarConta)} hoje={iso(hojeEmBrasilia())} abrirNova={sp.nova === "1"} />;
}
