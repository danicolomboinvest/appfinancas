/**
 * As categorias que já nascem com o perfil Pessoal (30/10/2026, aprovado pela Dani).
 *
 * Em 30 dias, 567 pessoas criaram 3.003 categorias à mão, e as mesmas se repetiam: roupas (157
 * pessoas), assinaturas (124), presentes (120), beleza (102), pet (75), academia (28), doação (36).
 * Em vez de cada uma digitar de novo, o perfil Pessoal novo já nasce com elas como categoria
 * PERSONALIZADA (CustomCategory), igual a uma que ela criasse: dá para renomear, trocar o ícone e
 * apagar. Viagem fica de fora porque tem área própria no app. Empresa não ganha nenhuma.
 *
 * Quem já tem conta vê as que faltam como chips "Sugeridas" na folha Nova categoria e em
 * Configurações › Categorias: um toque cria.
 *
 * A importação e a voz mapeiam para elas pelo `assunto` (ver motor.ts): "Renner" vai para a
 * Roupas dela, "Petz" para a Pet, quando ela as tem. Sem a personalizada, tudo fica como era.
 *
 * Puro: quem fala com o banco é semearCategoriasQueJaNascem (custom-category.repo.ts).
 */

export type AssuntoQueJaNasce = "beleza" | "roupas" | "presentes" | "pet" | "assinaturas" | "academia" | "doacao";

export type CategoriaQueJaNasce = {
  assunto: AssuntoQueJaNasce;
  nome: string;
  /** Chave de CUSTOM_CATEGORY_ICON_OPTIONS (categories.ts). */
  icone: string;
  /** Token de CORES_DE_CATEGORIA (categories.ts): funciona no claro e no escuro. */
  cor: string;
  /** Outros nomes que a pessoa dá para o mesmo assunto (sem acento, minúsculo): não cria em dobro. */
  parecidos: string[];
};

export const CATEGORIAS_QUE_JA_NASCEM: CategoriaQueJaNasce[] = [
  { assunto: "beleza", nome: "Beleza", icone: "salao", cor: "var(--color-custom-5)", parecidos: ["beleza", "estetica", "cuidados pessoais", "cuidado pessoal", "autocuidado", "skincare"] },
  { assunto: "roupas", nome: "Roupas", icone: "roupa", cor: "var(--color-custom-8)", parecidos: ["roupa", "roupas", "vestuario", "moda", "roupas e calcados", "roupas e sapatos"] },
  { assunto: "presentes", nome: "Presentes", icone: "gift", cor: "var(--color-custom-7)", parecidos: ["presente", "presentes"] },
  { assunto: "pet", nome: "Pet", icone: "paw", cor: "var(--color-custom-6)", parecidos: ["pet", "pets", "petshop", "pet shop", "animais", "cachorro", "gato", "bichos"] },
  { assunto: "assinaturas", nome: "Assinaturas", icone: "tv", cor: "var(--color-custom-4)", parecidos: ["assinatura", "assinaturas", "streaming", "streamings", "apps", "assinaturas e apps"] },
  { assunto: "academia", nome: "Academia", icone: "dumbbell", cor: "var(--color-custom-2)", parecidos: ["academia", "treino", "esporte", "esportes", "fitness"] },
  { assunto: "doacao", nome: "Doação", icone: "doacao", cor: "var(--color-custom-10)", parecidos: ["doacao", "doacoes", "dizimo", "dizimos", "dizimo e ofertas", "igreja", "caridade"] },
];

/** Minúsculo, sem acento, só letras e números com um espaço entre eles. */
export function nomeNormalizado(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A entrada da lista que o nome dela cobre ("Roupa", "roupas", "Vestuário" cobrem Roupas), ou null. */
export function assuntoDoNome(nome: string): AssuntoQueJaNasce | null {
  const n = nomeNormalizado(nome);
  if (!n) return null;
  for (const c of CATEGORIAS_QUE_JA_NASCEM) {
    if (nomeNormalizado(c.nome) === n || c.parecidos.includes(n)) return c.assunto;
  }
  return null;
}

/** As da lista que ela ainda não tem (comparando sem acento e sem caixa, inclusive os parecidos). */
export function sugeridasQueFaltam(existentes: { name: string }[]): CategoriaQueJaNasce[] {
  const tem = new Set<AssuntoQueJaNasce>();
  for (const c of existentes) {
    const a = assuntoDoNome(c.name);
    if (a) tem.add(a);
  }
  return CATEGORIAS_QUE_JA_NASCEM.filter((c) => !tem.has(c.assunto));
}

/**
 * Assunto → id da personalizada dela, para o motor da importação e da voz. Quando ela tem duas
 * para o mesmo assunto ("Roupas" e "Vestuário"), vale a primeira da lista (a mais antiga, na
 * ordem em que o repositório devolve).
 */
export function idsDasQueJaNascem(personalizadas: { id: string; name: string }[]): Map<AssuntoQueJaNasce, string> {
  const mapa = new Map<AssuntoQueJaNasce, string>();
  for (const c of personalizadas) {
    const a = assuntoDoNome(c.name);
    if (a && !mapa.has(a)) mapa.set(a, c.id);
  }
  return mapa;
}

/**
 * O assunto de uma categoria que o dicionário ou o vocabulário falado deu, pela subcategoria:
 * Saúde › Academia é a Academia dela, Lazer › Streaming e Outros › Assinaturas e apps são a
 * Assinaturas, Outros › Doações é a Doação, Presentes é a Presentes, Outros › Pet é a Pet.
 * Roupa e beleza vêm marcadas pela regra do dicionário (`queJaNasce`), porque as duas dividem a
 * subcategoria "Cuidado pessoal".
 */
export function assuntoDaClassificacao(c: { subcategory?: string; queJaNasce?: AssuntoQueJaNasce }): AssuntoQueJaNasce | null {
  if (c.queJaNasce) return c.queJaNasce;
  switch (c.subcategory) {
    case "Academia":
      return "academia";
    case "Streaming":
    case "Assinaturas e apps":
      return "assinaturas";
    case "Doações":
      return "doacao";
    case "Presentes":
      return "presentes";
    case "Pet":
      return "pet";
    default:
      return null;
  }
}
