/**
 * As três escolhas de um gasto no Casal simples (decisão da dona em 15/10/2026, versão A do
 * mockup telas-feedback-cliente.html): de quem é, quem pagou e como divide. Tudo do ponto de vista
 * de quem LANÇOU (o dono do registro), que é quem edita.
 *
 * No banco (MonthlyEntry):
 * - De quem é: "Da casa" = doCasal true; "Meu" = doCasal false; "Do par" = doPar true (doCasal false).
 *   doCasal nulo continua valendo a regra aprendida pela loja (lib/casa/regras.ts, ehDaCasa).
 * - Quem pagou: pagouOPar (false = quem lançou).
 * - Como divide (só da casa): divisaoPropria "renda", "meio" ou "outra" (com parteDeQuemLancou em
 *   %). Nulo = a regra da casa, que pode ser pela renda, meio a meio ou combinado.
 *
 * O acerto de um gasto:
 * - Da casa: cada um deve a sua parte; quem pagou recebe a parte do outro.
 * - "Do par" pago por mim: o par me deve 100%. "Meu" pago pelo par: eu devo 100% ao par.
 * - "Meu" pago por mim e "Do par" pago pelo par: fica fora do acerto.
 */

export type DeQuem = "meu" | "casa" | "par";
export type ComoDivide = "renda" | "meio" | "combinado" | "outra";
export type DivisaoPropria = "renda" | "meio" | "outra";

export type Escolhas = {
  deQuem: DeQuem;
  pagouOPar: boolean;
  divide: ComoDivide;
  /** A parte de quem lançou, em % (usada em "Outra"). */
  parte: number;
};

/** A regra da casa vista por quem lançou: o jeito e as proporções dele. */
export type DivisaoDaCasa = {
  modo: "renda" | "meio" | "combinado";
  /** Pela renda: a parte de quem olha, em % (55). Sem a renda dos dois, 50. */
  pctEuRenda: number;
  /** Pela renda sem a renda dos dois lançada: a conta cai para meio a meio. */
  semRenda: boolean;
  /** Combinado: a parte de quem olha, em % (60). */
  pctEuCombinado: number;
};

export const DIVISAO_PADRAO: DivisaoDaCasa = { modo: "renda", pctEuRenda: 50, semRenda: true, pctEuCombinado: 50 };

/** A mesma regra vista pelo outro da casa (o gasto do par aberto por mim: as partes trocam). */
export function divisaoVistaPeloOutro(d: DivisaoDaCasa): DivisaoDaCasa {
  return { ...d, pctEuRenda: 100 - d.pctEuRenda, pctEuCombinado: 100 - d.pctEuCombinado };
}

export function ehDivisaoPropria(v: unknown): v is DivisaoPropria {
  return v === "renda" || v === "meio" || v === "outra";
}

const limitar = (v: number) => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));
const duasCasas = (v: number) => Math.round(v * 100) / 100;

/** A parte de quem lançou, em % (0 a 100), pelas escolhas e pela regra da casa. */
export function parteDeQuemLancou(e: Escolhas, d: DivisaoDaCasa): number {
  if (e.deQuem === "meu") return 100;
  if (e.deQuem === "par") return 0;
  if (e.divide === "meio") return 50;
  if (e.divide === "renda") return d.semRenda ? 50 : limitar(d.pctEuRenda);
  if (e.divide === "combinado") return limitar(d.pctEuCombinado);
  return limitar(e.parte);
}

export type Resultado = { tipo: "parDeve" | "euDevo" | "fora"; valor: number };

/** Quanto este gasto mexe no acerto, do ponto de vista de quem lançou. */
export function resultadoDoGasto(valor: number, e: Escolhas, d: DivisaoDaCasa): Resultado {
  const total = Math.abs(valor) || 0;
  const minha = duasCasas((total * parteDeQuemLancou(e, d)) / 100);
  const dele = duasCasas(total - minha);
  if (!e.pagouOPar) return dele >= 0.01 ? { tipo: "parDeve", valor: dele } : { tipo: "fora", valor: 0 };
  return minha >= 0.01 ? { tipo: "euDevo", valor: minha } : { tipo: "fora", valor: 0 };
}

/** A frase do resultado: "Lucas fica devendo R$ 90 para você". */
export function textoDoResultado(r: Resultado, nomeDoPar: string, money: (v: number) => string): string {
  if (r.tipo === "parDeve") return `${nomeDoPar} fica devendo ${money(r.valor)} para você`;
  if (r.tipo === "euDevo") return `Você fica devendo ${money(r.valor)} para ${nomeDoPar}`;
  return "Fica fora do acerto";
}

/** "60/40": a parte de quem aparece primeiro e a do outro, arredondadas e somando 100. */
/**
 * O que o botão "Pela renda" do acerto diz: SEMPRE a proporção da renda, qualquer que seja o jeito
 * escolhido (com "Meio a meio" marcado ele dizia "Pela renda 50% e 50%"). Só a proporção, nunca o
 * valor da renda de ninguém. Sem a renda dos dois lançada não há proporção: avisa em vez de calar.
 */
export function rotuloPelaRenda(d: DivisaoDaCasa): string {
  if (d.semRenda) return "Pela renda (falta renda)";
  const meu = Math.round(limitar(d.pctEuRenda));
  return `Pela renda ${meu}% e ${100 - meu}%`;
}

export function rotuloDaDivisao(pctPrimeiro: number): string {
  const p = Math.round(limitar(pctPrimeiro));
  return `${p}/${100 - p}`;
}

/** As escolhas que a tela abre para um lançamento já salvo. `daCasa`: o que ehDaCasa disse. */
export function escolhasDoLancamento(
  l: { doPar?: boolean | null; pagouOPar?: boolean | null; divisaoPropria?: string | null; parteDeQuemLancou?: number | null },
  daCasa: boolean,
  d: DivisaoDaCasa,
): Escolhas {
  const deQuem: DeQuem = l.doPar ? "par" : daCasa ? "casa" : "meu";
  const divide: ComoDivide = ehDivisaoPropria(l.divisaoPropria) ? l.divisaoPropria : d.modo;
  const parte = divide === "outra" && typeof l.parteDeQuemLancou === "number" ? limitar(l.parteDeQuemLancou) : parteDeQuemLancou({ deQuem: "casa", pagouOPar: false, divide, parte: 50 }, d);
  return { deQuem, pagouOPar: Boolean(l.pagouOPar), divide, parte };
}

/** O que vai para o banco. A divisão igual à regra da casa vira nula (segue a casa se ela mudar). */
export function escolhasParaOBanco(e: Escolhas, modoDaCasa: DivisaoDaCasa["modo"]) {
  const daCasa = e.deQuem === "casa";
  const propria = daCasa && e.divide !== "combinado" && e.divide !== modoDaCasa ? e.divide : null;
  return {
    doCasal: daCasa,
    doPar: e.deQuem === "par",
    pagouOPar: e.pagouOPar,
    divisaoPropria: propria,
    parteDeQuemLancou: propria === "outra" ? duasCasas(limitar(e.parte)) : null,
  };
}

/** Os campos do formulário do Digitar (createMonthlyEntryAction lê com lerEscolhasDoFormulario). */
export function escolhasNoFormulario(e: Escolhas, modoDaCasa: DivisaoDaCasa["modo"]): Record<string, string> {
  const b = escolhasParaOBanco(e, modoDaCasa);
  return {
    casaDeQuem: e.deQuem,
    casaPagou: e.pagouOPar ? "par" : "eu",
    casaDivisao: b.divisaoPropria ?? "",
    casaParte: b.parteDeQuemLancou === null ? "" : String(b.parteDeQuemLancou),
  };
}

/** O contrário, no servidor: nulo quando o formulário não mandou (fora do Casal simples). */
export function lerEscolhasDoFormulario(f: { casaDeQuem?: string; casaPagou?: string; casaDivisao?: string; casaParte?: string }) {
  const deQuem = f.casaDeQuem;
  if (deQuem !== "meu" && deQuem !== "casa" && deQuem !== "par") return null;
  const daCasa = deQuem === "casa";
  const divisaoPropria = daCasa && ehDivisaoPropria(f.casaDivisao) ? f.casaDivisao : null;
  const parte = Number(String(f.casaParte ?? "").replace(",", "."));
  if (divisaoPropria === "outra" && (!String(f.casaParte ?? "").trim() || !Number.isFinite(parte))) return null;
  return {
    doCasal: daCasa,
    doPar: deQuem === "par",
    pagouOPar: f.casaPagou === "par",
    divisaoPropria,
    parteDeQuemLancou: divisaoPropria === "outra" ? duasCasas(limitar(parte)) : null,
  };
}

/**
 * Os selinhos do lançamento salvo, como no mockup: "Da casa", "Ana pagou", "55/45". Só para o
 * que entra no acerto (o "Meu" que eu mesma paguei não ganha selo). A divisão aparece com a
 * parte de quem olha primeiro.
 */
export function selosDoGasto(
  e: Escolhas,
  d: DivisaoDaCasa,
  nomes: { quemLancou: string; outro: string; deQuemOlha: "quemLancou" | "outro" },
): string[] {
  const entra = e.deQuem === "casa" || (e.deQuem === "meu" && e.pagouOPar) || (e.deQuem === "par" && !e.pagouOPar);
  if (!entra) return [];
  const de = e.deQuem === "casa" ? "Da casa" : e.deQuem === "meu" ? `De ${nomes.quemLancou}` : `De ${nomes.outro}`;
  const pagou = `${e.pagouOPar ? nomes.outro : nomes.quemLancou} pagou`;
  if (e.deQuem !== "casa") return [de, pagou];
  const pct = parteDeQuemLancou(e, d);
  return [de, pagou, rotuloDaDivisao(nomes.deQuemOlha === "quemLancou" ? pct : 100 - pct)];
}
