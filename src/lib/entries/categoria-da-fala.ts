import type { ParentCategory } from "@prisma/client";
import type { Classification, LearnedRule } from "@/lib/import/classify";
import { normalizeMerchant } from "@/lib/import/classify";
import { categoriaParecida } from "@/lib/import/cuidado-pessoal";
import { categorizarLinha } from "@/lib/import/motor";
import { acharNoVocabulario, type GrupoFalado } from "./vocabulario-falado";

/**
 * A categoria do que ela FALOU (14/10/2026). A Dani gravou "gastei 300 reais com posto" e a
 * categoria não veio: a voz tinha uma listinha própria, sem "posto", enquanto a importação já
 * sabia que posto é Combustível. Agora a voz passa pelo MESMO motor da importação (motor.ts):
 *
 * 1. A regra que ELA ensinou (inclusive para a categoria que ela criou).
 * 2. O nome de uma categoria que ela criou, dito na frase ("50 reais no pet" → "Pet").
 * 3. A base comunitária, o dicionário e o nome com cara de comida, como na importação.
 * 4. O vocabulário falado (vocabulario-falado.ts, 14/10/2026): centenas de jeitos de dizer um
 *    gasto que não aparecem em extrato ("quentinha", "abasteci", "ração", "ifude"). Afina a
 *    subcategoria quando concorda com as camadas de cima, e a expressão inteira ("uber eats",
 *    "seguro do carro") ganha da palavra solta que a comunidade ou o extrato reconheceram.
 *
 * Roupa e beleza (Zara, salão, "blusa") vão para a categoria dela desse assunto ("Cuidado
 * pessoal", "Beleza", "Roupas"), quando existe; sem ela, Outros › Cuidado pessoal. Pet ("ração",
 * "veterinário") e filhos ("fralda", "babá") também: a dela ("Pets", "Filhos") ou Outros › Pet e
 * Outros › Filhos. A voz nunca cria categoria. Se nada reconhece, volta null e ela escolhe: não chuta.
 */
export type ContextoDaFala = {
  regras?: LearnedRule[];
  profileKind?: string | null;
  /** As categorias que ela criou neste perfil. */
  personalizadas?: { id: string; name: string }[];
};

/** A categoria dela para pet ("Pets", "Cachorro", "Animais") e para filhos ("Filhos", "Crianças", "Bebê"). */
const PARECIDOS_PET = / (pets?|animais|animal|cachorros?|cachorras?|caes|gatos?|gatas?|bichos?|dogs?) /;
const PARECIDOS_FILHOS = / (filhos?|filhas?|criancas?|bebes?|kids|infantil|familia) /;

function palavrasDoNome(nome: string): string {
  return ` ${nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function categoriaDela(grupo: GrupoFalado | undefined, personalizadas: { id: string; name: string }[]) {
  if (grupo === "pet") return personalizadas.find((c) => PARECIDOS_PET.test(palavrasDoNome(c.name))) ?? null;
  if (grupo === "filhos") return personalizadas.find((c) => PARECIDOS_FILHOS.test(palavrasDoNome(c.name))) ?? null;
  return categoriaParecida(personalizadas);
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
  // O vocabulário falado (vocabulario-falado.ts): "quentinha", "ração", "abasteci", "ifude".
  const falada = pessoal ? acharNoVocabulario(texto) : null;
  const daFala: Classification | null = falada ? { parentCategory: falada.parentCategory, subcategory: falada.subcategory } : null;
  if (daFala && falada?.grupo === "cuidado") daFala.cuidadoPessoal = true;
  let achada: Classification | null;
  let grupo = falada?.grupo;
  if (doMotor?.origem === "dela") {
    // A regra dela e o nome da categoria dela mandam em tudo.
    achada = doMotor.classificacao;
    grupo = undefined;
  } else if (doMotor && doMotor.origem !== "parece_comida" && !(falada && falada.palavras > 1 && falada.exato && falada.parentCategory !== doMotor.classificacao.parentCategory)) {
    achada = doMotor.classificacao;
    // Concordando na categoria-mãe, a palavra falada afina a subcategoria: a comunidade só sabe
    // a mãe ("remédio" → Saúde) e o extrato pensa em loja ("comida" é restaurante; "pedi comida"
    // é delivery).
    if (daFala && !achada.customCategoryId && daFala.parentCategory === achada.parentCategory) achada = daFala;
    else grupo = undefined;
  } else {
    // A expressão falada inteira ("uber eats", "seguro do carro", "passagem de trem") sabe mais
    // que a palavra solta que a base comunitária e o extrato reconhecem ("uber", "seguro",
    // "passagem"). E o "parece comida" do motor é palpite de confiança média: a palavra falada,
    // quando há, sabe mais.
    achada = daFala ?? doMotor?.classificacao ?? null;
  }
  if (!achada) return null;
  if ((achada.cuidadoPessoal || grupo) && !achada.customCategoryId && pessoal) {
    const dela = categoriaDela(grupo ?? "cuidado", personalizadas);
    if (dela) return { parentCategory: "OUTROS", customCategoryId: dela.id };
  }
  return achada;
}
