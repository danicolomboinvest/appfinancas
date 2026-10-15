/**
 * O Casal simples na voz (15/10/2026, versão A): a frase preenche as mesmas três perguntas do
 * Digitar. "Lucas pagou 200 no mercado, metade cada" vira Da casa, pagou o Lucas, 50/50.
 *
 * O que entende (sem acento, sem maiúscula):
 * - Quem pagou: "eu paguei" (Eu); "<nome do par> pagou", "pago pelo/pela <nome>" (o par).
 * - De quem é: "da casa"; "só meu"/"só minha" (Meu); "dele", "dela", "do/da <nome>" (do par).
 * - Como divide: "metade cada", "meio a meio" (50/50); "pela renda". Dizer como divide sem dizer
 *   de quem é já quer dizer que é da casa.
 *
 * Devolve também a frase sem esses pedaços, para a descrição e a categoria ("Mercado", e não
 * "Lucas pagou mercado metade cada"). Só roda dentro de uma casa (quem chama passa o nome do par).
 */

export type CasalFalado = {
  deQuem?: "meu" | "casa" | "par";
  pagouOPar?: boolean;
  divide?: "meio" | "renda";
};

function semAcento(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapar(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Acha os trechos na frase sem acento e apaga os mesmos trechos na frase original. */
function apagar(original: string, normal: string, padroes: RegExp[]): string {
  const marcas = new Array<boolean>(normal.length).fill(false);
  for (const p of padroes) {
    for (const m of normal.matchAll(new RegExp(p.source, "g"))) {
      for (let i = m.index; i < m.index + m[0].length; i += 1) marcas[i] = true;
    }
  }
  // O normal tem o mesmo tamanho do original no português de todo dia; se não tiver, usa ele.
  const base = normal.length === original.length ? original : normal;
  let saida = "";
  for (let i = 0; i < base.length; i += 1) saida += marcas[i] ? " " : base[i];
  return saida.replace(/\s+([,.;!?])/g, "$1").replace(/[,;]\s*$/g, "").replace(/\s{2,}/g, " ").trim();
}

export function casalDaFala(falado: string, nomeDoPar: string | null | undefined): { casal: CasalFalado | null; texto: string } {
  const nome = semAcento(String(nomeDoPar ?? "").trim().split(/\s+/)[0] ?? "");
  const normal = semAcento(falado);
  if (!nome) return { casal: null, texto: falado };
  const n = escapar(nome);
  const casal: CasalFalado = {};
  const tirar: RegExp[] = [];

  const parPagou = [new RegExp(`\\b(?:(?:o|a)\\s+)?${n}\\s+(?:que\\s+)?pagou\\b`), new RegExp(`\\bpago\\s+(?:pel[oa]|por)\\s+${n}\\b`), new RegExp(`\\bquem\\s+pagou\\s+(?:foi\\s+)?(?:o\\s+|a\\s+)?${n}\\b`)];
  const euPaguei = [/\beu\s+(?:que\s+)?paguei\b/, /\bpago\s+por\s+mim\b/];
  if (parPagou.some((p) => p.test(normal))) {
    casal.pagouOPar = true;
    tirar.push(...parPagou);
  } else if (euPaguei.some((p) => p.test(normal))) {
    casal.pagouOPar = false;
    tirar.push(...euPaguei);
  }

  const meio = [/\bmetade\s+(?:pra\s+|para\s+)?cada(?:\s+um)?\b/, /\bmeio\s+a\s+meio\b/, /\b(?:dividido|dividimos|divide)\s+(?:por|em)\s+dois\b/];
  const renda = [/\bpela\s+renda\b/];
  if (meio.some((p) => p.test(normal))) {
    casal.divide = "meio";
    tirar.push(...meio);
  } else if (renda.some((p) => p.test(normal))) {
    casal.divide = "renda";
    tirar.push(...renda);
  }

  const daCasa = [/\b(?:e\s+)?da\s+casa\b/];
  const soMeu = [/\b(?:e\s+)?so\s+(?:meu|minha)\b/];
  const doPar = [/\b(?:e\s+)?(?:dele|dela)\b/, new RegExp(`\\b(?:e\\s+)?d[oa]\\s+${n}\\b`)];
  if (daCasa.some((p) => p.test(normal))) {
    casal.deQuem = "casa";
    tirar.push(...daCasa);
  } else if (soMeu.some((p) => p.test(normal))) {
    casal.deQuem = "meu";
    tirar.push(...soMeu);
  } else if (doPar.some((p) => p.test(normal))) {
    casal.deQuem = "par";
    tirar.push(...doPar);
  }
  // "Metade cada" sem dizer de quem: é da casa (só a casa divide).
  if (casal.divide && !casal.deQuem) casal.deQuem = "casa";

  if (casal.pagouOPar === undefined && !casal.deQuem && !casal.divide) return { casal: null, texto: falado };
  return { casal, texto: apagar(falado, normal, tirar) };
}
