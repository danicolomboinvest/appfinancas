import { juntarAssinaturas, type AssinaturaDaTela, type AssinaturaDela } from "@/lib/contas/assinaturas";
import { assinaturasComARegraUnica } from "./regra";
import { estadoPara, type RespostasDeAssinatura } from "./respostas";

/**
 * A lista de assinaturas que a tela de Recorrentes mostra, montada num lugar só (15/10/2026) para o
 * cartão "Assinaturas" do Resumo dar o mesmo número: as dela primeiro; as achadas (Raio-X e
 * Dinheiro perdido) entram sem repetir pelo nome e sem a que virou conta; o que ela respondeu sobre
 * cada uma, em qualquer tela, decide se aparece (regra única, ./regra).
 */
export type EntradasDasAssinaturas = {
  dela: AssinaturaDela[];
  raiox: { itens: { tipo: string; chave: string; nome: string; mensal: number; descricao?: string }[] };
  /** Os achados vivos do Dinheiro perdido (só os de tipo assinatura e com valor mensal entram). */
  vivos: { tipo: string; mensal: number | null; chave: string; nome: string; comerciante: string; descricaoDoLogo: string }[];
  /** As contas a pagar em aberto (a academia que virou conta não aparece de novo). */
  contas: { nome: string; valor: number | null; chaveDoHistorico?: string | null }[];
  respostas: RespostasDeAssinatura;
  lancamentosDoMes: { descricao: string | null; valor: number }[];
};

export function montarAssinaturas(e: EntradasDasAssinaturas) {
  const vivosDeAssinatura = e.vivos.filter((a) => a.tipo === "assinatura" && a.mensal);
  return assinaturasComARegraUnica<AssinaturaDaTela>(
    juntarAssinaturas({
      dela: e.dela,
      achadas: [
        ...e.raiox.itens.filter((i) => i.tipo === "assinatura").map((i) => ({ chave: `rx:${i.chave}`, nome: i.nome, mensal: i.mensal })),
        ...vivosDeAssinatura.map((a) => ({ chave: `dp:${a.chave}`, nome: a.nome, mensal: a.mensal as number, comerciante: a.comerciante.split("#")[0] })),
      ],
      contas: e.contas,
      recusas: new Set(),
      lancamentosDoMes: e.lancamentosDoMes,
    }),
    { dela: e.dela, raiox: e.raiox.itens, achados: vivosDeAssinatura },
    (marcas) => estadoPara(e.respostas, marcas),
  );
}
