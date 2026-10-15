import { ChevronRight, CreditCard, Landmark } from "lucide-react";
import Link from "next/link";
import { getRequiredSession } from "@/lib/auth/session";
import { listImportBatches } from "@/lib/repositories/import-batch.repo";
import { LogoDoLancamento } from "@/components/ui/LogoDoLancamento";
import { Cabecalho } from "../_ajustes/Lista";
import { ImportarExtrato } from "../_ajustes/Interativos";
import { chaveDaConta, casaNaTela } from "@/lib/casa/regras";
import { contasDaCasa } from "@/lib/repositories/casa.repo";
import { BolinhaDeQuemGastou } from "@/components/casa/Pessoas";
import { MostrarParaOPar } from "./MostrarParaOPar";

export const metadata = { title: "Contas e cartões · SPI Finance" };

const dia = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
/** "nubank-outubro.pdf" vira "nubank outubro": o nome do arquivo é o que ela reconhece. */
const nomeDoArquivo = (f: string | null, padrao: string) => (f ? f.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || padrao : padrao);

/**
 * Contas e cartões (protótipo, #configuracoes-conexoes): "Você traz o extrato ou a fatura e o SPI
 * separa tudo." As listas Contas (os extratos que ela trouxe) e Cartões (as faturas), cada uma com
 * o último arquivo, os botões Importar extrato e Importar fatura do cartão, e o limite do cartão.
 */
export default async function ContasECartoesPage() {
  const ctx = await getRequiredSession();
  const casa = casaNaTela(ctx.casa);
  const [lotes, daCasa] = await Promise.all([listImportBatches(ctx, 60), casa ? contasDaCasa(ctx) : Promise.resolve(null)]);
  // Casal simples: cada conta minha com o "Mostrar para <par>", e as que o par deixou visíveis.
  const visivel = new Map((daCasa?.minhas ?? []).map((c) => [c.chave, c.visivel]));
  const ultimoDe = (tipo: "extrato" | "fatura") => {
    const vistos = new Map<string, (typeof lotes)[number]>();
    for (const l of lotes.filter((x) => (tipo === "fatura" ? x.docType === "fatura" : x.docType !== "fatura"))) {
      const k = nomeDoArquivo(l.fileName, tipo).split(" ")[0].toLowerCase();
      if (!vistos.has(k)) vistos.set(k, l);
    }
    return [...vistos.values()].slice(0, 5);
  };
  const contas = ultimoDe("extrato");
  const cartoes = ultimoDe("fatura");
  const grupo = "overflow-hidden rounded-3xl bg-surface shadow-[inset_0_0_0_1px_var(--color-border)]";
  const linha = (l: (typeof lotes)[number], tipo: string) => {
    const chave = chaveDaConta(l.docType, l.fileName);
    const conteudo = (
      <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
        <LogoDoLancamento descricao={nomeDoArquivo(l.fileName, tipo)} icon={tipo === "fatura" ? CreditCard : Landmark} size={36} />
        <span className="min-w-0 flex-1">
          <b className="block break-words text-[15px] font-medium capitalize text-ink">{nomeDoArquivo(l.fileName, tipo === "fatura" ? "Fatura" : "Extrato")}</b>
          <small className="text-[13px] text-ink-muted">
            {tipo === "fatura" ? "última fatura" : "último extrato"}: {dia(l.createdAt)} · {l.entryCount} {l.entryCount === 1 ? "lançamento" : "lançamentos"}
          </small>
        </span>
      </div>
    );
    if (!casa) return <div key={l.id} className="border-t border-border first:border-t-0">{conteudo}</div>;
    return (
      <div key={l.id} className="border-t border-border first:border-t-0">
        {conteudo}
        <MostrarParaOPar chave={chave} ligado={visivel.get(chave) ?? true} nomeDoOutro={casa.outro.nome} />
      </div>
    );
  };
  const doOutro = daCasa?.doOutro ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Cabecalho titulo="Contas e cartões" sub="Você traz o extrato ou a fatura e o SPI separa tudo. Leva um minuto." />
      <h2 className="px-1 pt-1 text-[15px] font-medium text-ink">Contas</h2>
      <div className={grupo}>{contas.length ? contas.map((l) => linha(l, "extrato")) : <p className="px-4 py-4 text-sm text-ink-muted">Nenhum extrato ainda.</p>}</div>
      {casa && doOutro.length > 0 && (
        <>
          <h2 className="px-1 pt-1 text-[15px] font-medium text-ink">De {casa.outro.nome}</h2>
          <div className={grupo} data-contas-do-par>
            {doOutro.map((c) => (
              <div key={c.chave} className="flex min-h-14 items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
                <span className="relative shrink-0">
                  <LogoDoLancamento descricao={c.nome} icon={c.tipo === "cartao" ? CreditCard : Landmark} size={36} />
                  <BolinhaDeQuemGastou casa={casa} dono="outro" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block break-words text-[15px] font-medium capitalize text-ink">{c.nome}</b>
                  <small className="text-[13px] text-ink-muted">{c.tipo === "cartao" ? "cartão" : "conta"} · mostra para você</small>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <h2 className="px-1 pt-1 text-[15px] font-medium text-ink">Cartões</h2>
      <div className={grupo}>{cartoes.length ? cartoes.map((l) => linha(l, "fatura")) : <p className="px-4 py-4 text-sm text-ink-muted">Nenhuma fatura ainda.</p>}</div>
      <div className="flex flex-col gap-2">
        <ImportarExtrato />
        <ImportarExtrato fatura />
      </div>
      <p className="px-1 text-[13px] text-ink-muted">O SPI não entra na sua conta do banco e não pede a senha dele.</p>
      <Link href="/orcamento/cartao" className="flex min-h-14 items-center gap-3 rounded-3xl border border-border bg-surface px-4">
        <CreditCard size={18} className="shrink-0 text-ink-muted" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] text-ink">Seu cartão</span>
          <span className="block text-[13px] text-ink-muted">Faturas, vencimento e limite de gasto</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-ink-faint" aria-hidden />
      </Link>
    </div>
  );
}
