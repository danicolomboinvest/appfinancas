import { getRequiredSession } from "@/lib/auth/session";
import { getOwnUser } from "@/lib/repositories/user.repo";
import { estadoDasNovidades, jaUsava } from "@/lib/novidades/passos";
import { VideosDoComoFunciona } from "@/components/ajuda/VideosDoComoFunciona";
import { ManualDoApp } from "./ManualDoApp";
import { AtalhoDoCasal } from "@/components/casa/AtalhoDoCasal";
import { casaNaTela } from "@/lib/casa/regras";

/**
 * Como funciona: os 5 vídeos narrados e o manual do app (as regras de importação, orçamento e
 * Foco que ninguém descobre sozinha). Quem já usava o app também revê daqui o "Tivemos uma
 * mudança".
 */
export default async function GuiaPage() {
  const ctx = await getRequiredSession();
  const user = await getOwnUser(ctx);
  const casa = casaNaTela(ctx.casa);
  return (
    <ManualDoApp
      videos={
        <>
          {/* Casal simples: o "Como funciona o casal" antes dos vídeos. */}
          {casa && <AtalhoDoCasal casa={casa} />}
          <VideosDoComoFunciona verDeNovo={jaUsava(estadoDasNovidades(user.novidadesVersaoNova))} />
        </>
      }
    />
  );
}
