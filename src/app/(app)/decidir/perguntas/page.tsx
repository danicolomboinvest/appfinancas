import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { chaveDoTema } from "@/lib/profiles/themes";
import { serverMoney } from "@/lib/money-server";
import { FILTROS, lerFiltro, perguntasDoFiltro } from "@/lib/decisoes/esferas";
import { Esfera, GradientesDasEsferas } from "@/components/decisoes/Esferas";
import { carregarDecidir } from "../dados";

/**
 * "Todas as perguntas" (rodada 57): as 10 na mesma linguagem das esferas, com os filtros (Tudo,
 * Vou comprar, Quero guardar, Meu mês), que saíram da tela principal. O filtro mora no endereço
 * (?filtro=guardar), para o Voltar do celular voltar ao filtro de antes.
 */
export default async function TodasAsPerguntasPage(props: PageProps<"/decidir/perguntas">) {
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const filtro = lerFiltro((await props.searchParams).filtro);
  const tema = chaveDoTema(ctx.profileTheme);
  const money = await serverMoney();
  const { pilulas } = await carregarDecidir(ctx);
  const dados = { ...pilulas, money: (v: number) => money(v, { round: true }), tema };

  return (
    <div className="flex flex-col gap-4">
      <GradientesDasEsferas />
      <div className="flex items-center justify-between gap-3">
        <Link href="/decidir" className="flex min-h-11 w-fit items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ChevronLeft size={18} aria-hidden /> Decidir
        </Link>
        <span className="text-caption text-ink-muted">Todas as perguntas</span>
      </div>
      <h1 className="ob-h">Todas as perguntas</h1>
      <nav className="ob-fil" aria-label="Filtrar">
        {FILTROS.map((f) => (
          <Link key={f.chave} href={f.chave === "tudo" ? "/decidir/perguntas" : `/decidir/perguntas?filtro=${f.chave}`} aria-current={filtro === f.chave ? "true" : undefined} replace scroll={false}>
            {f.nome}
          </Link>
        ))}
      </nav>
      <p className="ob-sub">Cada uma já abre com os seus números.</p>
      <div className="ob-grade">
        {perguntasDoFiltro(filtro).map((p) => (
          <Esfera key={p.chave} p={p} dados={dados} />
        ))}
      </div>
    </div>
  );
}
