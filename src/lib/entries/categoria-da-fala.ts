import type { ParentCategory } from "@prisma/client";
import type { Classification, LearnedRule } from "@/lib/import/classify";
import { normalizeMerchant } from "@/lib/import/classify";
import { categoriaParecida } from "@/lib/import/cuidado-pessoal";
import { categorizarLinha } from "@/lib/import/motor";

/**
 * A categoria do que ela FALOU (14/10/2026). A Dani gravou "gastei 300 reais com posto" e a
 * categoria não veio: a voz tinha uma listinha própria, sem "posto", enquanto a importação já
 * sabia que posto é Combustível. Agora a voz passa pelo MESMO motor da importação (motor.ts):
 *
 * 1. A regra que ELA ensinou (inclusive para a categoria que ela criou).
 * 2. O nome de uma categoria que ela criou, dito na frase ("50 reais no pet" → "Pet").
 * 3. A base comunitária, o dicionário e o nome com cara de comida, como na importação.
 * 4. As palavras faladas que não aparecem em extrato ("remédio", "janta", "cabelo"), só como reforço.
 *
 * Roupa e beleza (Zara, salão, "blusa") vão para a categoria dela desse assunto ("Cuidado
 * pessoal", "Beleza", "Roupas"), quando existe; sem ela, Outros › Cuidado pessoal. A voz nunca
 * cria categoria. Se nada reconhece, volta null e ela escolhe: não chuta.
 */
export type ContextoDaFala = {
  regras?: LearnedRule[];
  profileKind?: string | null;
  /** As categorias que ela criou neste perfil. */
  personalizadas?: { id: string; name: string }[];
};

type Reforco = { palavras: string[]; parentCategory: ParentCategory; subcategory?: string; cuidadoPessoal?: true };

/** Comparado sem acento e por palavra inteira (aceita o plural). */
const FALADAS: Reforco[] = [
  { palavras: ["remedio", "remedios", "medicamento", "medicamentos", "vitamina", "vitaminas", "farmacia"], parentCategory: "SAUDE", subcategory: "Farmácia" },
  { palavras: ["medico", "medica", "consulta", "dentista", "pediatra", "ginecologista", "dermatologista", "oftalmologista"], parentCategory: "SAUDE", subcategory: "Consultas" },
  { palavras: ["exame", "exames", "laboratorio", "ultrassom"], parentCategory: "SAUDE", subcategory: "Exames" },
  { palavras: ["terapia", "psicologo", "psicologa", "psicanalista", "fisioterapia"], parentCategory: "SAUDE", subcategory: "Terapia" },
  { palavras: ["academia", "pilates", "personal", "crossfit", "musculacao"], parentCategory: "SAUDE", subcategory: "Academia" },
  { palavras: ["plano de saude", "convenio"], parentCategory: "SAUDE", subcategory: "Plano de saúde" },
  { palavras: ["mercado", "feira", "compras do mes", "compra do mes"], parentCategory: "ALIMENTACAO", subcategory: "Supermercado" },
  { palavras: ["almoco", "janta", "jantar", "jantinha", "almocei", "jantei"], parentCategory: "ALIMENTACAO", subcategory: "Restaurante" },
  { palavras: ["lanche", "lanchinho", "cafezinho", "cafe da manha", "salgado", "sorvete"], parentCategory: "ALIMENTACAO", subcategory: "Lanche/Café" },
  { palavras: ["pao", "paes"], parentCategory: "ALIMENTACAO", subcategory: "Padaria" },
  { palavras: ["cerveja", "cervejinha", "chopp", "drinks", "drink"], parentCategory: "ALIMENTACAO", subcategory: "Bar" },
  { palavras: ["abasteci", "abastecer", "abastecimento", "gasolina", "alcool", "etanol", "diesel"], parentCategory: "TRANSPORTE", subcategory: "Combustível" },
  { palavras: ["corrida", "corridas", "99"], parentCategory: "TRANSPORTE", subcategory: "Aplicativo" },
  { palavras: ["passagem de onibus", "metro", "onibus", "trem"], parentCategory: "TRANSPORTE", subcategory: "Transporte público" },
  { palavras: ["mecanico", "oficina", "pneu", "pneus", "revisao do carro", "conserto do carro", "lavagem do carro", "lava jato"], parentCategory: "TRANSPORTE", subcategory: "Manutenção do veículo" },
  { palavras: ["aluguel"], parentCategory: "MORADIA", subcategory: "Aluguel" },
  { palavras: ["condominio"], parentCategory: "MORADIA", subcategory: "Condomínio" },
  { palavras: ["luz", "conta de luz", "energia"], parentCategory: "MORADIA", subcategory: "Luz" },
  { palavras: ["agua", "conta de agua"], parentCategory: "MORADIA", subcategory: "Água" },
  { palavras: ["gas", "botijao"], parentCategory: "MORADIA", subcategory: "Gás" },
  { palavras: ["internet", "wifi"], parentCategory: "MORADIA", subcategory: "Internet" },
  { palavras: ["faxina", "diarista", "faxineira"], parentCategory: "MORADIA", subcategory: "Faxina" },
  { palavras: ["cinema", "show", "teatro", "ingresso", "ingressos"], parentCategory: "LAZER", subcategory: "Cinema/Shows" },
  { palavras: ["viagem", "hotel", "pousada", "passagem aerea", "passagem de aviao"], parentCategory: "LAZER", subcategory: "Viagens" },
  { palavras: ["balada", "festa"], parentCategory: "LAZER", subcategory: "Bar/Balada" },
  { palavras: ["passeio", "parque"], parentCategory: "LAZER", subcategory: "Passeios" },
  { palavras: ["presente", "presentes"], parentCategory: "LAZER", subcategory: "Presentes" },
  { palavras: ["curso", "cursos", "aula", "aulas"], parentCategory: "EDUCACAO", subcategory: "Cursos" },
  { palavras: ["livro", "livros", "material escolar", "apostila"], parentCategory: "EDUCACAO", subcategory: "Livros/Material" },
  { palavras: ["escola", "faculdade", "mensalidade"], parentCategory: "EDUCACAO", subcategory: "Mensalidade" },
  {
    palavras: [
      "cabelo", "cabeleireiro", "cabeleireira", "salao", "manicure", "unha", "unhas", "sobrancelha", "depilacao", "barbeiro",
      "barba", "roupa", "roupas", "blusa", "camiseta", "calca", "saia", "vestido", "sapato", "sapatos", "tenis", "sandalia",
      "maquiagem", "perfume", "creme", "hidratante", "skincare",
    ],
    parentCategory: "OUTROS",
    subcategory: "Cuidado pessoal",
    cuidadoPessoal: true,
  },
];

function semAcento(t: string): string {
  return ` ${t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function pelasPalavrasFaladas(texto: string): Classification | null {
  const t = semAcento(texto);
  for (const r of FALADAS) {
    if (r.palavras.some((p) => t.includes(` ${p} `))) {
      const achada: Classification = { parentCategory: r.parentCategory, subcategory: r.subcategory };
      if (r.cuidadoPessoal) achada.cuidadoPessoal = true;
      return achada;
    }
  }
  return null;
}

/** O nome da categoria que ela criou vira uma regra dela: "Pet" pega "50 reais no pet". */
function regrasDosNomes(personalizadas: { id: string; name: string }[]): LearnedRule[] {
  return personalizadas
    .map((c) => ({ pattern: normalizeMerchant(c.name), parentCategory: "OUTROS" as ParentCategory, customCategoryId: c.id }))
    .filter((r) => r.pattern.length >= 3);
}

export function categoriaDaFala(descricao: string, contexto: ContextoDaFala = {}): Classification | null {
  const texto = descricao.trim();
  if (!texto) return null;
  const personalizadas = contexto.personalizadas ?? [];
  const pessoal = contexto.profileKind !== "EMPRESA";
  // As regras dela vêm antes dos nomes das categorias dela (empate de tamanho: a regra ganha).
  const regras = [...(contexto.regras ?? []), ...regrasDosNomes(personalizadas)];
  const doMotor = categorizarLinha({
    descricao: texto,
    regras,
    profileKind: contexto.profileKind,
    gasto: true,
    personalizadas: new Set(personalizadas.map((c) => c.id)),
  });
  // O "parece comida" do motor é palpite de confiança média: a palavra falada, quando há, sabe mais.
  const falada = pessoal ? pelasPalavrasFaladas(texto) : null;
  let achada = doMotor && !(doMotor.origem === "parece_comida" && falada) ? doMotor.classificacao : falada;
  // A base comunitária só sabe a categoria-mãe ("remédio" → Saúde): concordando, a palavra
  // falada afina a subcategoria (Farmácia), como o dicionário faz na importação.
  if (achada && !achada.subcategory && !achada.customCategoryId && falada?.parentCategory === achada.parentCategory) achada = { ...achada, subcategory: falada.subcategory };
  if (!achada) return null;
  if (achada.cuidadoPessoal && !achada.customCategoryId && pessoal) {
    const dela = categoriaParecida(personalizadas);
    if (dela) return { parentCategory: "OUTROS", customCategoryId: dela.id };
  }
  return achada;
}
