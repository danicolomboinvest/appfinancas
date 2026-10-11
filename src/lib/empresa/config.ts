/**
 * O que o assistente da Empresa perguntou (versão nova, 11/10/2026), guardado em
 * FinancialProfile.empresa (JSON), no mesmo jeito do `casal`.
 *
 * Só MEI primeiro (recomendação do plano, pendência 5.1.12): Autônoma e ME podem ser escolhidas,
 * mas aparecem como "em breve" e o app não mostra número legal nenhum para elas até haver fonte.
 */

export const TIPOS_DE_EMPRESA = ["MEI", "AUTONOMA", "ME"] as const;
export type TipoDeEmpresa = (typeof TIPOS_DE_EMPRESA)[number];

/** O que ela faz: escolhe a foto do assistente, do Quanto cobrar e o nome do produto. */
export const RAMOS = [
  { chave: "doces", nome: "Doces e bolos", curto: "Doces", foto: "/fotos/empresa/confeitaria.jpg", produto: "Bolo de 2 kg", materiais: "Ingredientes" },
  { chave: "atelie", nome: "Ateliê e costura", curto: "Costura", foto: "/fotos/empresa/atelie.jpg", produto: "Peça sob medida", materiais: "Tecido e aviamentos" },
  { chave: "beleza", nome: "Beleza e serviços", curto: "Serviços", foto: "/fotos/empresa/servico.jpg", produto: "Atendimento", materiais: "Produtos usados" },
  { chave: "loja", nome: "Loja", curto: "Loja", foto: "/fotos/empresa/negocio.jpg", produto: "Produto", materiais: "Custo da peça" },
] as const;
export type Ramo = (typeof RAMOS)[number]["chave"] | "outro";

export function ramoDe(chave: Ramo | null | undefined) {
  return RAMOS.find((r) => r.chave === chave) ?? null;
}

/** Como os clientes pagam. "dinheiro" entra na venda, não no assistente. */
export const FORMAS = ["pix", "credito", "debito", "boleto", "dinheiro"] as const;
export type Forma = (typeof FORMAS)[number];
export const NOME_DA_FORMA: Record<Forma, string> = { pix: "Pix", credito: "Crédito", debito: "Débito", boleto: "Boleto", dinheiro: "Dinheiro" };

export function ehForma(v: unknown): v is Forma {
  return typeof v === "string" && (FORMAS as readonly string[]).includes(v);
}

/** Os prazos do "Crédito cai em" (dias). */
export const PRAZOS_DO_CREDITO = [0, 1, 2, 14, 30] as const;

export type ConfigEmpresa = {
  tipo: TipoDeEmpresa;
  faz: Ramo;
  /** Os jeitos que ela recebe (do assistente). */
  formas: Forma[];
  /** Em quantos dias a venda no crédito cai na conta. */
  prazoCredito: number;
  /** O salário que ela combinou no assistente. Nulo = usa o salário seguro. */
  salario: number | null;
  /** O dia do mês em que o salário sai da empresa para ela. */
  diaDoSalario: number;
  /** Lembrete da guia (a conta "Guia do MEI" nas Recorrentes avisa na véspera e no dia). */
  lembreteDas: boolean;
  /** Taxas da maquininha que ELA digitou (em %). Nulo = não digitou: o app não inventa. */
  taxas: { credito: number | null; debito: number | null };
  /** Horas de trabalho por mês, para o "Sua hora vale" do Quanto cobrar. */
  horasPorMes: number;
  /** Quando ela abriu o negócio no app (ISO). */
  abertoEm: string;
};

export const HORAS_POR_MES_PADRAO = 120;

function numero(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Lê o JSON do banco. Nulo (ou lixo) = o assistente ainda não rodou. */
export function lerConfigEmpresa(json: unknown): ConfigEmpresa | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const tipo = TIPOS_DE_EMPRESA.includes(o.tipo as TipoDeEmpresa) ? (o.tipo as TipoDeEmpresa) : null;
  if (!tipo) return null;
  const faz = (RAMOS.some((r) => r.chave === o.faz) || o.faz === "outro" ? o.faz : "outro") as Ramo;
  const formas = Array.isArray(o.formas) ? o.formas.filter(ehForma) : [];
  const prazo = numero(o.prazoCredito);
  const salario = numero(o.salario);
  const dia = numero(o.diaDoSalario);
  const taxas = (o.taxas && typeof o.taxas === "object" ? o.taxas : {}) as Record<string, unknown>;
  const taxa = (v: unknown) => {
    const n = numero(v);
    return n !== null && n >= 0 && n < 100 ? n : null;
  };
  const horas = numero(o.horasPorMes);
  return {
    tipo,
    faz,
    formas,
    prazoCredito: prazo !== null && prazo >= 0 && prazo <= 60 ? Math.round(prazo) : 30,
    salario: salario !== null && salario >= 0 ? salario : null,
    diaDoSalario: dia !== null && dia >= 1 && dia <= 28 ? Math.round(dia) : 5,
    lembreteDas: o.lembreteDas !== false,
    taxas: { credito: taxa(taxas.credito), debito: taxa(taxas.debito) },
    horasPorMes: horas !== null && horas >= 10 && horas <= 400 ? Math.round(horas) : HORAS_POR_MES_PADRAO,
    abertoEm: typeof o.abertoEm === "string" ? o.abertoEm : new Date().toISOString(),
  };
}

/** "o ateliê", "a loja", "a empresa": o nome curto do negócio a partir do nome do perfil. */
const NOMES_DO_NEGOCIO: Record<string, string> = {
  atelie: "o ateliê",
  loja: "a loja",
  studio: "o studio",
  estudio: "o estúdio",
  salao: "o salão",
  confeitaria: "a confeitaria",
  doceria: "a doceria",
  padaria: "a padaria",
  cafe: "o café",
  barbearia: "a barbearia",
  clinica: "a clínica",
  consultorio: "o consultório",
  escritorio: "o escritório",
  oficina: "a oficina",
  empresa: "a empresa",
  negocio: "o negócio",
  brecho: "o brechó",
  agencia: "a agência",
};

export function nomeDoNegocio(nomeDoPerfil: string): { com: string; sem: string } {
  const primeira = nomeDoPerfil
    .trim()
    .split(/\s+/)[0]
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const com = (primeira && NOMES_DO_NEGOCIO[primeira]) || "a empresa";
  return { com, sem: com.slice(2) };
}

/** "para o ateliê", "para a loja". */
export function paraO(nome: { com: string }): string {
  return nome.com.startsWith("o ") ? `para o ${nome.com.slice(2)}` : `para a ${nome.com.slice(2)}`;
}
