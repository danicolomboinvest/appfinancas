import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { avisoDeParLigado, listProfiles, parLigadoAoPerfil } from "@/lib/repositories/profile.repo";
import { chaveDoTema } from "@/lib/profiles/themes";
import { DetalheDoPerfil } from "@/components/profiles/DetalheDoPerfil";
import { Cabecalho } from "../../_ajustes/Lista";
import { EscolherEstilo } from "../../_ajustes/EscolherEstilo";

export const metadata = { title: "Perfil · SPI Finance" };

const NOME_DO_TIPO: Record<string, string> = { PESSOAL: "Pessoal", CASAL: "Nós dois", EMPRESA: "Empresa", CASA: "Casa", PROJETO: "Projeto", OUTRO: "Outro" };

/** Um perfil: o nome, o tema (os 4 estilos), usar e, no fim e discreto, apagar. */
export default async function PerfilPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const ctx = await getRequiredSession();
  const perfis = await listProfiles(ctx.userId);
  const perfil = perfis.find((p) => p.id === id);
  if (!perfil) notFound();
  // Nós dois com par ligado: a tela já diz o que fazer antes, em vez de deixar escrever o nome e falhar.
  const par = perfil.kind === "CASAL" ? await parLigadoAoPerfil(perfil.id) : null;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo={perfil.name} sub={NOME_DO_TIPO[perfil.kind] ?? "Perfil"} />
      <DetalheDoPerfil perfil={perfil} emUso={perfil.id === ctx.profileId} podeApagar={perfis.length > 1} avisoDoPar={par ? avisoDeParLigado(par.modelo) : null} />
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-medium uppercase tracking-wide text-ink-muted">Estilo deste perfil</h2>
        <div className="rounded-3xl border border-border bg-surface">
          <EscolherEstilo perfilId={perfil.id} atual={chaveDoTema(perfil.theme)} />
        </div>
      </section>
    </div>
  );
}
