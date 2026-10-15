import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getRequiredSession } from "@/lib/auth/session";
import { carregarEmpresa } from "@/lib/empresa/dados";
import { MESES, resumoDaEmpresa } from "@/lib/empresa/resumo";
import { ehVenda, mesAntes, quemCompra } from "@/lib/empresa/regras";
import { serverMoney } from "@/lib/money-server";
import { Cartao, Iniciais, Titulo, Voltar } from "../partes";

const CORES = ["var(--color-accent)", "color-mix(in srgb, var(--color-accent) 70%, var(--color-surface))", "color-mix(in srgb, var(--color-accent) 42%, var(--color-surface))", "var(--color-border-strong)"];

/**
 * Seus clientes (3 meses fechados): a barra de 100% com a linha dos 30%, o ranking e quem deve. Só
 * as vendas em que ela disse de quem foi têm nome; o resto é "Balcão e outros".
 */
export default async function ClientesPage() {
  const ctx = await getRequiredSession();
  const [dados, money] = await Promise.all([carregarEmpresa(ctx), serverMoney()]);
  if (!dados.config) redirect("/empresa");
  const m0 = (v: number) => money(v, { round: true });
  const R = resumoDaEmpresa(dados);
  const ini = mesAntes(dados.mesAtual, 3);
  const fim = mesAntes(dados.mesAtual, 1);
  const ord = (y: number, m: number) => y * 12 + m;
  const vendas = dados.lancamentos.filter((l) => ehVenda(l) && ord(l.year, l.month) >= ord(ini.ano, ini.mes) && ord(l.year, l.month) <= ord(fim.ano, fim.mes));
  const q = quemCompra(vendas);
  const fatias = q ? [...q.clientes.map((c) => ({ nome: c.nome, valor: c.valor, pct: c.pct })), { nome: "Balcão", valor: q.outros.valor, pct: q.outros.pct }] : [];

  return (
    <>
      <Voltar>{dados.nome}</Voltar>
      <Titulo nota={`${MESES[ini.mes - 1]} a ${MESES[fim.mes - 1]}`}>Seus clientes</Titulo>
      {!q ? (
        <Cartao className="px-5 py-6 text-sm text-ink-muted">Na hora de registrar uma entrada, diga de quem foi. Os clientes aparecem aqui.</Cartao>
      ) : (
        <>
          <Cartao className="flex flex-col gap-2 p-4">
            <div className="relative">
              <div className="flex h-4 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={fatias.map((f) => `${f.nome} ${f.pct}%`).join(", ")}>
                {fatias.map((f, k) => (
                  <i key={f.nome} style={{ flexGrow: f.valor, background: CORES[k === fatias.length - 1 ? 3 : k] }} />
                ))}
              </div>
              <i className="absolute -top-1 h-6 w-px bg-ink" style={{ left: "30%" }} aria-hidden />
            </div>
            <small className="text-center text-xs text-ink-muted">{q.dependente ? "um cliente passa de 30%" : "nenhum cliente passa de 30%"}</small>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {fatias.map((f, k) => (
                <span key={f.nome} className="flex items-center gap-2 text-sm text-ink">
                  <i className="size-2.5 shrink-0 rounded-full" style={{ background: CORES[k === fatias.length - 1 ? 3 : k] }} />
                  <span className="truncate">{f.nome}</span>
                  <b className="ml-auto font-medium tabular-nums">{f.pct}%</b>
                </span>
              ))}
            </div>
          </Cartao>
          <Cartao className="divide-y divide-border px-4">
            {q.clientes.map((c, k) => (
              <div key={c.nome} className="flex min-h-16 items-center gap-3">
                <span className="w-4 text-sm tabular-nums text-ink-muted">{k + 1}</span>
                <Iniciais nome={c.nome} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-medium text-ink">{c.nome}</b>
                  <small className="text-xs text-ink-muted">{c.pct}% das entradas</small>
                </span>
                <b className="shrink-0 text-[15px] font-medium tabular-nums text-ink">{m0(c.valor)}</b>
              </div>
            ))}
          </Cartao>
        </>
      )}
      {R.devendo.length > 0 && (
        <>
          <h2 className="mt-2 px-1 text-lg font-medium text-ink">Quem deve</h2>
          {R.devendo.map((d) => (
            <Link key={d.id} href="/empresa/recebimentos" className="flex min-h-16 items-center gap-3 rounded-3xl bg-danger-soft px-4 py-3">
              <Iniciais nome={d.cliente} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[15px] font-medium text-ink">{d.cliente}</b>
                <small className="text-sm text-danger">
                  {m0(d.valor)}, há {d.dias} {d.dias === 1 ? "dia" : "dias"}
                </small>
              </span>
              <ChevronRight size={18} className="text-ink-muted" aria-hidden />
            </Link>
          ))}
        </>
      )}
    </>
  );
}
