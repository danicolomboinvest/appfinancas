import { nomeEParcela } from "@/lib/import/nome-na-tela";

/**
 * O nome do lançamento com a parcela ao lado, discreta: "Zara (02/03)" (pedido de cliente,
 * 30/10/2026). O número não quebra no meio; o nome continua quebrando linha a 320 px. Sem parcela,
 * só o nome como veio (ou `semNome`, quando a descrição está vazia).
 */
export function NomeComParcela({ descricao, semNome }: { descricao: string | null | undefined; semNome: string }) {
  if (!descricao) return <>{semNome}</>;
  const { nome, parcela } = nomeEParcela(descricao);
  return (
    <>
      {nome || semNome}
      {parcela && <span className="ml-1.5 whitespace-nowrap text-caption text-ink-muted tabular-nums">({parcela})</span>}
    </>
  );
}
