import { Plus, ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { getRequiredSession } from "@/lib/auth/session";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { serverMoney } from "@/lib/money-server";
import { listarMetasDaTela } from "@/lib/repositories/metas.repo";
import { mesDaqui, proximaAChegar } from "@/lib/metas/projecao";
import { nomeCurto } from "@/lib/metas/tipos";
import { ConquistasDeMetas } from "@/components/conquista/ConquistasDeMetas";
import { ResumoDasMetas } from "./ResumoDasMetas";
import { DestacarMetaNova, FileiraDeFotos } from "./FileiraDeFotos";
import { CartaoDaMeta } from "./CartaoDaMeta";
import { AbrirFolhaDaMeta, ProvedorDaFolhaDaMeta } from "./FolhaDaMeta";
import { editarEmDaMeta, jeitoDasMetas, metaApertada, metaParaEditar, seloDaMeta } from "./visual";
import { CartaoComMenu } from "./MenuDaMeta";
import "./metas.css";
import { metasADois } from "@/lib/repositories/casa.repo";
import { casaNaTela } from "@/lib/casa/regras";
import { MetasADois } from "./MetasADois";
import { getLimiteDasMetas } from "@/lib/repositories/renda-media.repo";
import { AbrirPrazoPelaUrl, SeloPrazoApertado } from "./SeloPrazoApertado";
import { BotaoDoPlano } from "./BotaoDoPlano";
import { planoDisponivel, planosDoPerfil } from "@/lib/repositories/plano-da-meta.repo";
import { resumoDoPlano } from "@/lib/planning/plano-gravado";

/**
 * Metas da versão nova (protótipo aprovado, rota #metas): o resumo com o anel de todas juntas e a
 * próxima a chegar, a fileira de fotos para ir direto a uma meta, os cartões com foto e a Nova
 * meta guiada. A ordem: a reserva primeiro, depois o prazo mais perto.
 */
export default async function MetasPage() {
  const ctx = await getRequiredSession();
  const hoje = nowInBrazil();
  const casa = casaNaTela(ctx.casa);
  const [todas, money, aDois, limite, comPlano, planos] = await Promise.all([listarMetasDaTela(ctx, hoje), serverMoney(), casa ? metasADois(ctx, hoje) : Promise.resolve([]), getLimiteDasMetas(ctx, hoje), planoDisponivel(ctx), planosDoPerfil(ctx)]);
  // A reserva primeiro (é a base de tudo), depois o prazo mais perto (protótipo: Reserva, Viagem, Carro).
  const metas = [...todas].sort((a, b) => Number(b.icon === "RESERVA") - Number(a.icon === "RESERVA"));
  const m = (v: number) => money(v, { round: true });
  const jeito = jeitoDasMetas(ctx.profileTheme);

  const abertas = metas.filter((x) => x.plano.status !== "ACHIEVED");
  const guardado = metas.reduce((t, x) => t + x.guardado, 0);
  const alvo = metas.reduce((t, x) => t + x.alvo, 0);
  const porMes = abertas.reduce((t, x) => t + x.combinado, 0);
  // Um selo só por meta (visual.ts, seloDaMeta): prazo apertado ganha, e a meta apertada nunca é a
  // "Próxima a chegar".
  const apertada = (x: (typeof metas)[number]) => metaApertada(x, limite);
  const prox = proximaAChegar(metas, apertada);
  const selo = (x: (typeof metas)[number]) => seloDaMeta({ status: x.plano.status, nova: x.plano.nova, inicio: x.inicio, hoje, apertada: apertada(x), proxima: prox?.id === x.id });

  const novaMeta = (
    <AbrirFolhaDaMeta guia="nova-meta" className="flex w-full items-center gap-3 rounded-[28px] border border-border bg-surface p-5 text-left shadow-premium-sm">
      {jeito.novaMetaMaisNaFrente && (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
          <Plus size={20} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        {jeito.novaMetaMaisNaFrente ? (
          <>
            <b className="text-[17px] font-semibold text-ink">Nova meta</b>
            <small className="text-[13px] font-medium text-ink-muted">{jeito.novaMetaSub}</small>
          </>
        ) : (
          <>
            <small className="text-[13px] font-medium text-ink-muted">{jeito.novaMetaSub}</small>
            <b className="text-xl font-semibold text-ink">Nova meta</b>
          </>
        )}
      </span>
      {jeito.novaMetaMaisNaFrente ? (
        <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
          <Plus size={20} />
        </span>
      )}
    </AbrirFolhaDaMeta>
  );

  return (
    <ProvedorDaFolhaDaMeta hoje={{ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, dia: hoje.getDate() }} limite={limite} comPlano={comPlano}>
      <ConquistasDeMetas ctx={ctx} />
      <Suspense fallback={null}>
        <DestacarMetaNova />
        <AbrirPrazoPelaUrl metas={metas.filter((x) => !x.daViagem).map(metaParaEditar)} />
      </Suspense>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3.5">
        {metas.length > 0 && (
          <>
            <ResumoDasMetas
              guardado={guardado}
              alvo={alvo}
              porMes={porMes}
              proxima={prox ? { id: prox.id, nome: jeito.proximaNomeInteiro ? prox.nome : nomeCurto(prox.nome), foto: prox.foto, quando: mesDaqui(hoje, prox.plano.chega ?? 0).texto } : null}
              jeito={jeito}
              money={m}
            />
            <FileiraDeFotos metas={metas.map((x) => ({ id: x.id, curto: nomeCurto(x.nome), nome: x.nome, foto: x.foto, pct: x.plano.pct }))} novaEmDuasLinhas={!jeito.novaMetaMaisNaFrente} />
            {metas.map((x) => (
              <div key={x.id} className="relative">
                <CartaoComMenu meta={metaParaEditar(x)} editarEm={editarEmDaMeta(x)}>
                  <CartaoDaMeta meta={x} jeito={jeito} hoje={hoje} money={m} selo={selo(x)} />
                </CartaoComMenu>
                {selo(x).tipo === "prazo-apertado" && <SeloPrazoApertado meta={metaParaEditar(x)} className="absolute left-3 top-3 z-[2]" />}
                {/* O plano da meta (16/10/2026): a que está em andamento e não é de viagem. */}
                {comPlano && !x.daViagem && x.plano.status !== "ACHIEVED" && <BotaoDoPlano metaId={x.id} plano={planos.has(x.id) ? resumoDoPlano(planos.get(x.id)!) : null} />}
              </div>
            ))}
          </>
        )}
        {/* Casal simples: as metas a dois do Nós dois de antes continuam aqui, para os dois. */}
        {casa && <MetasADois metas={aDois} casa={casa} money={m} />}
        {novaMeta}
      </div>
    </ProvedorDaFolhaDaMeta>
  );
}
