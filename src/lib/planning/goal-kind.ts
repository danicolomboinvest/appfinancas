import type { GoalIcon } from "@prisma/client";

/**
 * Descobre o TIPO da meta pelo nome que a pessoa escreveu.
 *
 * O tipo existia só nos botõezinhos de ícone do formulário, que vêm em "Genérico" por padrão —
 * e a maioria não troca: das metas cadastradas hoje, 11 estão como genéricas. Essas pessoas
 * escreveram "Entrada do apê" ou "Trocar de carro" e o app tratava como meta sem assunto,
 * então não tinha como oferecer a ferramenta certa.
 *
 * Ler o nome resolve sem pedir nada a mais de quem cadastra.
 */

/** Termos de uma palavra: casam por palavra INTEIRA. É o que impede "casamento" de virar casa. */
const UMA_PALAVRA: Record<Exclude<GoalIcon, "GENERICO">, string[]> = {
  VIAGEM: [
    "viagem","viagens","viajar","viaje","ferias","trip","passeio","mochilao","intercambio",
    "eurotrip","cruzeiro","turismo","europa","disney","praia",
  ],
  CASA: [
    "casa","apartamento","ape","apto","imovel","imoveis","moradia","terreno","lote","sitio",
    "chacara","kitnet","studio","reforma","obra","mudanca",
  ],
  CARRO: ["carro","carros","automovel","veiculo","moto","motocicleta","suv","caminhonete","picape"],
  APOSENTADORIA: ["aposentadoria","aposentar","previdencia","fire"],
};

/** Termos com espaço: casam como expressão, com fronteira antes e depois. */
const EXPRESSAO: Record<Exclude<GoalIcon, "GENERICO">, string[]> = {
  VIAGEM: ["lua de mel"],
  CASA: ["casa propria", "entrada do ape", "entrada da casa"],
  CARRO: ["zero km", "0 km"],
  APOSENTADORIA: ["independencia financeira", "liberdade financeira", "renda passiva"],
};

/** Minúsculas e sem acento — "Apê", "APE" e "ape" têm que cair no mesmo lugar. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Devolve o tipo, ou null quando o nome não diz nada.
 *
 * Com mais de um termo no nome, vence o que aparece PRIMEIRO: "Viagem de carro" é uma viagem,
 * "Carro pra viajar" é um carro. A ordem em que a pessoa escreveu revela o assunto principal.
 */
export function detectGoalKind(name: string): Exclude<GoalIcon, "GENERICO"> | null {
  const texto = normalizar(name);
  if (!texto.trim()) return null;

  type Achado = { tipo: Exclude<GoalIcon, "GENERICO">; posicao: number };
  // Acumula todos os achados e escolhe no fim, em vez de comparar dentro de um closure: o TS
  // estreita a variável capturada para `never` e o código não compila.
  const achados: Achado[] = [];

  const buscar = (tabela: Record<string, string[]>) => {
    for (const [tipo, termos] of Object.entries(tabela)) {
      for (const termo of termos) {
        const m = new RegExp(`(?:^|[^a-z0-9])${termo}(?:[^a-z0-9]|$)`).exec(texto);
        if (m) achados.push({ tipo: tipo as Exclude<GoalIcon, "GENERICO">, posicao: m.index });
      }
    }
  };
  buscar(UMA_PALAVRA);
  buscar(EXPRESSAO);

  if (achados.length === 0) return null;
  achados.sort((a, b) => a.posicao - b.posicao);
  return achados[0].tipo;
}

/** O que a pessoa escolheu manda; só quando ela deixou "Genérico" o nome decide. */
export function resolveGoalKind(icon: GoalIcon, name: string): GoalIcon {
  if (icon !== "GENERICO") return icon;
  return detectGoalKind(name) ?? "GENERICO";
}
