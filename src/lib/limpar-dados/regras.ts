import { COMECO_NOVO, lerComeco, type Comeco } from "@/lib/onboarding/comeco";
import { lerConfigCasal, type ConfigCasal } from "@/lib/casal/acerto";

/**
 * "Limpar meus dados e recomeçar" (12/10/2026): a Dani pediu para separar apagar a CONTA de
 * apagar os DADOS. Limpar zera o dinheiro do perfil (lançamentos, orçamento, metas, carteira,
 * dívidas, contas, decisões...) e mantém a pessoa: login, assinatura, compras, aparência, foto,
 * nome, o próprio perfil e os registros do app.
 *
 * Aqui fica só a parte pura (sem banco), para ser testada à parte. Quem apaga é
 * src/lib/repositories/limpar-dados.repo.ts.
 */

export const ESCOPOS_DA_LIMPEZA = ["perfil", "todos"] as const;
export type EscopoDaLimpeza = (typeof ESCOPOS_DA_LIMPEZA)[number];

export function ehEscopoDaLimpeza(v: unknown): v is EscopoDaLimpeza {
  return v === "perfil" || v === "todos";
}

/** A palavra que ela digita para confirmar. Conferida no servidor, nunca só na tela. */
export const PALAVRA_DE_CONFIRMACAO = "LIMPAR";

/** "limpar", " Limpar " e "LIMPAR" valem; qualquer outra coisa, não. */
export function confirmacaoValida(digitado: unknown): boolean {
  return typeof digitado === "string" && digitado.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;
}

/** No máximo 3 limpezas por hora por conta: é uma ação pesada, e repetir não muda nada. */
export const LIMITE_DE_LIMPEZAS = { janelaMs: 60 * 60 * 1000, maximo: 3 };

/** O nome do evento de uso que registra a limpeza (sem dado pessoal, só que aconteceu). */
export const EVENTO_DADOS_LIMPOS = "dados_limpos";

/**
 * Decisões que NÃO saem com os dados:
 * - "resposta_errada" é o aviso que a pessoa mandou para a equipe ("essa resposta está errada"),
 *   lido no admin. É registro do app, não dinheiro dela.
 * - o progresso do Money Reset ("reset_inicio", "reset_dia", "reset_marco", "reset_resposta"),
 *   só quando ela escolhe manter (zerarMoneyReset = false). A compra do Money Reset nunca sai.
 */
export const DECISOES_QUE_FICAM = ["resposta_errada"] as const;
export const PREFIXO_DO_MONEY_RESET = "reset_";

/**
 * O começo depois de limpar: volta para a porta do primeiro lançamento (extrato, digitar ou
 * falar), como uma conta nova que acabou de responder as perguntas. Fica só o que é da PESSOA
 * (como quer ser chamada e o que quer agora). A renda aproximada sai: ela alimentava o plano do
 * mês, que também foi limpo, e o Orçamento pergunta de novo como numa conta nova.
 */
export function comecoParaRecomecar(atual: unknown): Comeco {
  const c = lerComeco(atual);
  return { ...COMECO_NOVO, passo: "porta", apelido: c?.apelido ?? null, quer: c?.quer ?? null };
}

/**
 * O combinado do Nós dois depois de limpar: os nomes, o jeito de dividir e as regras por conta
 * ficam (são o acordo do casal, não dinheiro); os meses já acertados saem, porque os lançamentos
 * que fecharam aqueles acertos foram limpos.
 */
export function casalParaRecomecar(atual: unknown): ConfigCasal {
  return { ...lerConfigCasal(atual), acertos: [] };
}

/**
 * Quais bancos conectados (Open Finance) moram no perfil que vai ser limpo.
 *
 * A conexão não guarda o perfil (ver lib/pluggy/perfil-da-conexao.ts); o que diz onde ela mora é
 * o que ela já importou: cada busca grava um lote "openfinance" com o nome do banco
 * ("Nubank · 12/10/2026"). Uma conexão sai junto só quando TODOS os lotes dela estão nos perfis
 * limpos. Se algum lote está em outro perfil, ou ela nunca importou nada, ela fica: limpar o
 * Pessoal não pode desligar o banco que alimenta a Empresa.
 */
export function conexoesDosPerfis(
  conexoes: { id: string; connectorName: string }[],
  lotes: { profileId: string | null; fileName: string | null }[],
  perfisLimpos: ReadonlySet<string>,
): string[] {
  const saem: string[] = [];
  for (const c of conexoes) {
    const prefixo = `${c.connectorName} · `;
    const dela = lotes.filter((l) => l.fileName?.startsWith(prefixo));
    if (dela.length === 0) continue;
    if (dela.every((l) => l.profileId !== null && perfisLimpos.has(l.profileId))) saem.push(c.id);
  }
  return saem;
}

/** O que foi apagado, tabela por tabela (só números, nunca o conteúdo). */
export type ContagensDaLimpeza = {
  lancamentos: number;
  aportesEmAtivos: number;
  importacoes: number;
  orcamentos: number;
  planosDoMes: number;
  resumosGuardados: number;
  metas: number;
  fotosDeMetas: number;
  reserva: number;
  planejamento: number;
  ativos: number;
  estrategia: number;
  historicoDoPatrimonio: number;
  fichasDeAnalise: number;
  calculadorasSalvas: number;
  regrasDeCategoria: number;
  categoriasCriadas: number;
  decisoes: number;
  contasAPagar: number;
  contasRecusadas: number;
  dividas: number;
  achadosDinheiroPerdido: number;
  fechamentosDoMes: number;
  fechamentosDoCasal: number;
  conexoesBancarias: number;
  arquivosDeImportacao: number;
  diagnosticosDeImportacao: number;
};

export function somaDasContagens(c: ContagensDaLimpeza): number {
  return Object.values(c).reduce((a, b) => a + b, 0);
}

export function contagensZeradas(): ContagensDaLimpeza {
  return {
    lancamentos: 0,
    aportesEmAtivos: 0,
    importacoes: 0,
    orcamentos: 0,
    planosDoMes: 0,
    resumosGuardados: 0,
    metas: 0,
    fotosDeMetas: 0,
    reserva: 0,
    planejamento: 0,
    ativos: 0,
    estrategia: 0,
    historicoDoPatrimonio: 0,
    fichasDeAnalise: 0,
    calculadorasSalvas: 0,
    regrasDeCategoria: 0,
    categoriasCriadas: 0,
    decisoes: 0,
    contasAPagar: 0,
    contasRecusadas: 0,
    dividas: 0,
    achadosDinheiroPerdido: 0,
    fechamentosDoMes: 0,
    fechamentosDoCasal: 0,
    conexoesBancarias: 0,
    arquivosDeImportacao: 0,
    diagnosticosDeImportacao: 0,
  };
}
