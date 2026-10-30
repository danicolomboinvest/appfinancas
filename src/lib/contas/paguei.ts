import { chaveDaConta } from "@/lib/casa/regras";

/**
 * "Paguei" vira gasto (decisão da Dani em 15/10/2026, versão B do mockup
 * ~/Claude/estudo-apps-financas/telas-feedback-cliente.html, seção "2. Conta fixa").
 *
 * Antes o "Paguei" só passava o vencimento, de propósito, para não duplicar com o extrato. Agora
 * a própria linha da conta se abre com o palpite pronto (o valor, Hoje e de onde saiu) e "Pronto"
 * cria o gasto, marca a conta como paga e passa o vencimento. Quando o extrato chega com o mesmo
 * pagamento, os dois viram um só (lib/import/paguei-no-extrato.ts).
 *
 * Aqui mora o que é puro (sem banco) e leve, para a tela também importar: as origens e o dia. A
 * categoria do gasto fica em paguei-categoria.ts (usa o dicionário, só no servidor).
 */

/** Uma origem do pagamento como a tela mostra: a chave guardada e o rótulo. */
export type OrigemDoPaguei = { chave: string; rotulo: string; tipo: "conta" | "cartao" | "dinheiro" };

/** As origens genéricas: quem ainda não trouxe extrato daquela conta ou cartão. */
export const ORIGEM_CONTA = "conta";
export const ORIGEM_CARTAO = "cartao";
export const ORIGEM_DINHEIRO = "dinheiro";

/** Primeira palavra do arquivo que não diz o banco ("extrato-outubro.pdf"): não vira origem própria. */
const PALAVRA_SEM_BANCO = new Set([
  "extrato", "fatura", "sem-nome", "statement", "export", "exportar", "arquivo", "download", "documento", "relatorio",
  "print", "prints", "img", "image", "imagem", "screenshot", "captura", "whatsapp", "conta", "cartao", "comprovante",
  "lancamentos", "movimentacao", "movimentacoes", "transacoes", "historico", "planilha", "pdf", "csv", "ofx", "meu", "minha",
]);

/** O nome do banco como ela escreve ("itau" vira "Itaú"). */
const NOME_DO_BANCO: Record<string, string> = {
  itau: "Itaú", bb: "BB", c6: "C6", btg: "BTG", xp: "XP", picpay: "PicPay", bradesco: "Bradesco", santander: "Santander",
  caixa: "Caixa", nubank: "Nubank", nu: "Nubank", inter: "Inter", sicoob: "Sicoob", sicredi: "Sicredi", neon: "Neon",
  pagbank: "PagBank", pagseguro: "PagBank", mercadopago: "Mercado Pago", next: "Next", original: "Original", will: "Will",
  banrisul: "Banrisul", safra: "Safra", rico: "Rico", wise: "Wise", nomad: "Nomad", cora: "Cora", infinitepay: "InfinitePay",
};

function nomeDoBanco(palavra: string): string {
  return NOME_DO_BANCO[palavra] ?? palavra.charAt(0).toUpperCase() + palavra.slice(1);
}

/** "conta:nubank" vira "Conta Nubank"; os genéricos dizem o jeito de pagar. */
export function rotuloDaOrigem(chave: string): string {
  if (chave === ORIGEM_CONTA) return "Pix ou débito";
  if (chave === ORIGEM_CARTAO) return "Cartão";
  if (chave === ORIGEM_DINHEIRO) return "Dinheiro";
  const [tipo, banco] = chave.split(":");
  if (!banco) return "Pix ou débito";
  return `${tipo === "cartao" ? "Cartão" : "Conta"} ${nomeDoBanco(banco)}`;
}

export function tipoDaOrigem(chave: string | null | undefined): OrigemDoPaguei["tipo"] | null {
  if (!chave) return null;
  if (chave === ORIGEM_DINHEIRO) return "dinheiro";
  return chave === ORIGEM_CARTAO || chave.startsWith("cartao:") ? "cartao" : "conta";
}

/** A chave de origem de um lote importado, ou null quando o arquivo não diz o banco. */
export function origemDoLote(docType: string, fileName: string | null): string | null {
  const chave = chaveDaConta(docType, fileName);
  const palavra = chave.split(":")[1] ?? "";
  if (!palavra || PALAVRA_SEM_BANCO.has(palavra) || /^\d+$/.test(palavra) || palavra.length < 2) return null;
  return chave;
}

/** A origem de um arquivo para casar com o "Paguei": a do lote ou, sem o banco no nome, o genérico do tipo. */
export function origemDoArquivo(docType: string, fileName: string | null): string {
  return origemDoLote(docType, fileName) ?? (docType === "fatura" ? ORIGEM_CARTAO : ORIGEM_CONTA);
}

/**
 * As origens que a linha oferece: as contas e os cartões dos extratos que ela trouxe (do mais
 * recente para o mais antigo, até 4), o genérico do tipo que faltar e o dinheiro. A `ultima` (a
 * do último "Paguei") entra mesmo que o lote dela já tenha saído da lista.
 */
export function origensDoPaguei(lotes: { docType: string; fileName: string | null }[], ultima?: string | null): OrigemDoPaguei[] {
  const vistas: string[] = [];
  const somar = (c: string | null | undefined) => {
    if (c && !vistas.includes(c)) vistas.push(c);
  };
  somar(ultima && ultima !== ORIGEM_CONTA && ultima !== ORIGEM_CARTAO && ultima !== ORIGEM_DINHEIRO ? ultima : null);
  for (const l of lotes) {
    if (vistas.length >= 4) break;
    somar(origemDoLote(l.docType, l.fileName));
  }
  if (!vistas.some((c) => tipoDaOrigem(c) === "conta")) vistas.push(ORIGEM_CONTA);
  if (!vistas.some((c) => tipoDaOrigem(c) === "cartao")) vistas.push(ORIGEM_CARTAO);
  vistas.push(ORIGEM_DINHEIRO);
  return vistas.map((chave) => ({ chave, rotulo: rotuloDaOrigem(chave), tipo: tipoDaOrigem(chave)! }));
}

/** A origem que a linha já abre marcada: a do último "Paguei", ou a primeira da lista. */
export function origemPadrao(origens: OrigemDoPaguei[], ultima: string | null | undefined): string {
  if (ultima && origens.some((o) => o.chave === ultima)) return ultima;
  return origens[0]?.chave ?? ORIGEM_CONTA;
}

/** Origem que a tela pode mandar: a chave de um lote ("conta:nubank") ou um dos genéricos. */
export function origemValida(chave: unknown): chave is string {
  if (typeof chave !== "string" || chave.length > 60) return false;
  if (chave === ORIGEM_CONTA || chave === ORIGEM_CARTAO || chave === ORIGEM_DINHEIRO) return true;
  return /^(conta|cartao):[a-z0-9-]{1,50}$/.test(chave);
}

/**
 * A conta que varia (luz, água): o campo do valor abre vazio, com os valores dos meses anteriores
 * para escolher com um toque. A aproximada e a sem valor variam.
 */
export function contaVaria(c: { valor: number | null; aproximado?: boolean | null }): boolean {
  return c.valor === null || !!c.aproximado;
}

const DIA_MS = 86_400_000;

/** Quantos dias para trás o "Outro dia" aceita. */
export const DIAS_PARA_TRAS = 62;

/** "AAAA-MM-DD" de hoje menos `n` dias. */
export function diaAntes(hoje: string, n: number): string {
  return new Date(Date.parse(`${hoje}T12:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10);
}

/** O dia que a tela mandou serve? Só de hoje para trás, até ~2 meses (pagar no futuro não é "Paguei"). */
export function diaValido(dia: unknown, hoje: string): dia is string {
  if (typeof dia !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const t = Date.parse(`${dia}T12:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== dia) return false;
  return dia <= hoje && dia >= diaAntes(hoje, DIAS_PARA_TRAS);
}

/** O chip do dia: "Hoje", "Ontem" ou "Dia 20". */
export function rotuloDoDia(dia: string, hoje: string): string {
  if (dia === hoje) return "Hoje";
  if (dia === diaAntes(hoje, 1)) return "Ontem";
  return `Dia ${Number(dia.slice(8, 10))}`;
}

/** "set" do "2026-09": o rótulo curto dos valores de antes. */
const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function mesCurto(mes: string): string {
  return MES_CURTO[Number(mes.slice(5, 7)) - 1] ?? mes;
}

/**
 * Os valores dos meses anteriores para a conta que varia: os "Paguei" dela primeiro (um por mês, o
 * mais novo primeiro), completados pelo que o extrato mostrou com o nome dela. No máximo 3.
 */
export function valoresDeAntes(dosPagueis: { mes: string; valor: number }[], doExtrato: { mes: string; valor: number }[]): { mes: string; valor: number }[] {
  const porMes = new Map<string, number>();
  for (const v of [...dosPagueis].sort((a, b) => b.mes.localeCompare(a.mes))) if (!porMes.has(v.mes) && v.valor > 0) porMes.set(v.mes, v.valor);
  for (const v of [...doExtrato].sort((a, b) => b.mes.localeCompare(a.mes))) if (!porMes.has(v.mes) && v.valor > 0) porMes.set(v.mes, v.valor);
  return [...porMes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 3)
    .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }));
}
