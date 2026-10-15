import type { CasaNaTela } from "@/lib/casa/regras";
import { divisaoVistaPeloOutro, escolhasDoLancamento, selosDoGasto, type DivisaoDaCasa } from "@/lib/casa/escolhas";

/** O que a lista sabe de um gasto no Casal simples (linhas.ts). */
export type CasalDaLinha = { doPar: boolean; pagouOPar: boolean; divisaoPropria: string | null; parteDeQuemLancou: number | null };

/** As escolhas e os nomes de um gasto, vistos por quem olha (o dono pode ser eu ou o par). */
export function selosDaLinha(casa: CasaNaTela, dono: "eu" | "outro", casal: CasalDaLinha, daCasa: boolean, divisao: DivisaoDaCasa): string[] {
  const doDono = dono === "eu" ? divisao : divisaoVistaPeloOutro(divisao);
  const e = escolhasDoLancamento(casal, daCasa, doDono);
  const quemLancou = dono === "eu" ? casa.eu.nome : casa.outro.nome;
  const outro = dono === "eu" ? casa.outro.nome : casa.eu.nome;
  return selosDoGasto(e, doDono, { quemLancou, outro, deQuemOlha: dono === "eu" ? "quemLancou" : "outro" });
}

/**
 * Os selinhos do gasto salvo (versão A do mockup): "Da casa", "Ana pagou", "55/45". Só no que
 * entra no acerto; o primeiro, de quem é, em destaque.
 */
export function SelosDoCasal({ selos }: { selos: string[] }) {
  if (selos.length === 0) return null;
  return (
    <span className="mr-1 inline-flex flex-wrap gap-1 align-middle" data-selos-do-casal={selos.join(" | ")}>
      {selos.map((s, i) => (
        <span key={s} className={`whitespace-nowrap rounded-full px-2 py-px text-[12px] font-medium ${i === 0 ? "bg-accent-soft text-accent-strong" : "bg-surface-2 text-ink-muted"}`}>
          {s}
        </span>
      ))}
    </span>
  );
}
