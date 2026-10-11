import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { estadoDasNovidades } from "@/lib/novidades/passos";
import { VideosDoComoFunciona } from "@/components/ajuda/VideosDoComoFunciona";
import { ManualDoApp } from "./ManualDoApp";

/**
 * Como funciona: os 5 vídeos narrados e o manual do app (as regras de importação, orçamento e
 * Foco que ninguém descobre sozinha). Quem já usava o app também revê daqui o "Tivemos uma
 * mudança".
 */
export default async function GuiaPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  return <ManualDoApp videos={<VideosDoComoFunciona verDeNovo={estadoDasNovidades(user.novidadesVersaoNova) !== "novo"} />} />;
}
