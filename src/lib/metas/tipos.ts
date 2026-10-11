import type { GoalIcon } from "@prisma/client";

/**
 * Os 18 tipos da nova meta guiada (protótipo aprovado, rota #nova-meta), na ordem dos chips.
 * Cada um tem a chave no banco (GoalIcon). Os cinco tipos de antes continuam: APOSENTADORIA é
 * "Liberdade financeira" e GENERICO é "Outro".
 */
export const TIPOS_DE_META: readonly { chave: GoalIcon; nome: string }[] = [
  { chave: "RESERVA", nome: "Reserva de emergência" },
  { chave: "APOSENTADORIA", nome: "Liberdade financeira" },
  { chave: "VIAGEM", nome: "Viagem" },
  { chave: "CASA", nome: "Casa própria" },
  { chave: "CARRO", nome: "Carro" },
  { chave: "MOTO", nome: "Moto" },
  { chave: "CASAMENTO", nome: "Casamento" },
  { chave: "FILHO", nome: "Filho" },
  { chave: "ESTUDOS", nome: "Estudos" },
  { chave: "INTERCAMBIO", nome: "Intercâmbio" },
  { chave: "REFORMA", nome: "Reforma" },
  { chave: "FESTA", nome: "Festa" },
  { chave: "NEGOCIO", nome: "Negócio próprio" },
  { chave: "PET", nome: "Pet" },
  { chave: "TECNOLOGIA", nome: "Tecnologia" },
  { chave: "SAUDE", nome: "Saúde e bem-estar" },
  { chave: "SHOW", nome: "Show ou evento" },
  { chave: "GENERICO", nome: "Outro" },
];

export function nomeDoTipo(chave: GoalIcon): string {
  return TIPOS_DE_META.find((t) => t.chave === chave)?.nome ?? "Outro";
}

/**
 * O banco de fotos do app (public/fotos/metas, Unsplash, sem crédito na tela). A primeira etiqueta
 * é o tipo de que a foto é a sugestão; as outras, os tipos em que ela também aparece primeiro na
 * grade. Para aumentar o banco, é só pôr o arquivo na pasta e uma linha aqui.
 */
export const FOTOS_DE_META: readonly { arquivo: string; tipos: GoalIcon[] }[] = [
  { arquivo: "viagem-praia.jpg", tipos: ["VIAGEM"] },
  { arquivo: "europa.jpg", tipos: ["VIAGEM", "INTERCAMBIO"] },
  { arquivo: "casa.jpg", tipos: ["CASA", "REFORMA"] },
  { arquivo: "carro.jpg", tipos: ["CARRO", "VIAGEM"] },
  { arquivo: "reserva.jpg", tipos: ["RESERVA", "GENERICO"] },
  { arquivo: "casamento.jpg", tipos: ["CASAMENTO", "FESTA"] },
  { arquivo: "estudos.jpg", tipos: ["ESTUDOS"] },
  { arquivo: "natureza.jpg", tipos: ["VIAGEM", "SAUDE", "GENERICO"] },
  { arquivo: "liberdade.jpg", tipos: ["APOSENTADORIA", "VIAGEM"] },
  { arquivo: "apartamento.jpg", tipos: ["CASA"] },
  { arquivo: "intercambio.jpg", tipos: ["INTERCAMBIO", "ESTUDOS", "VIAGEM"] },
  { arquivo: "filho.jpg", tipos: ["FILHO"] },
  { arquivo: "pet.jpg", tipos: ["PET"] },
  { arquivo: "moto.jpg", tipos: ["MOTO"] },
  { arquivo: "reforma.jpg", tipos: ["REFORMA", "CASA"] },
  { arquivo: "festa.jpg", tipos: ["FESTA", "CASAMENTO"] },
  { arquivo: "negocio.jpg", tipos: ["NEGOCIO"] },
  { arquivo: "tecnologia.jpg", tipos: ["TECNOLOGIA", "ESTUDOS"] },
  { arquivo: "saude.jpg", tipos: ["SAUDE"] },
  { arquivo: "montanha.jpg", tipos: ["VIAGEM"] },
  { arquivo: "cruzeiro.jpg", tipos: ["VIAGEM"] },
  { arquivo: "show.jpg", tipos: ["SHOW"] },
  { arquivo: "parque.jpg", tipos: ["VIAGEM", "SHOW", "GENERICO"] },
  { arquivo: "presente.jpg", tipos: ["GENERICO", "FESTA"] },
];

export const PASTA_DAS_FOTOS = "/fotos/metas/";
export const urlDaFoto = (arquivo: string) => `${PASTA_DAS_FOTOS}${arquivo}`;

const semAcento = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * O tipo pelo nome que ela digitou, quando ela não tocou em nenhum chip: "Viagem para a praia"
 * é Viagem, "Apê novo" é Casa própria. A primeira palavra de cada tipo vale ("reserva",
 * "casamento"...), e algumas palavras soltas ajudam. Sem nada, "Outro".
 */
export function tipoDoNome(nome: string): GoalIcon {
  const t = semAcento(nome);
  const porPalavra = TIPOS_DE_META.find((x) => {
    const primeira = semAcento(x.nome).split(" ")[0];
    return new RegExp(`\\b${primeira}\\b`).test(t);
  });
  if (porPalavra && porPalavra.chave !== "GENERICO") return porPalavra.chave;
  if (/\b(europa|paris|lisboa|praia|ferias|disney|japao|orlando)\b/.test(t)) return "VIAGEM";
  if (/\b(apart\w*|ape|imovel|casa)\b/.test(t)) return "CASA";
  if (/\b(curso|facul\w*|pos|mba)\b/.test(t)) return "ESTUDOS";
  if (/\b(aposentadoria|aposentar|independencia)\b/.test(t)) return "APOSENTADORIA";
  if (/\b(emergencia|colchao)\b/.test(t)) return "RESERVA";
  if (/\b(celular|iphone|notebook|computador)\b/.test(t)) return "TECNOLOGIA";
  if (/\b(bebe|gravidez|filha)\b/.test(t)) return "FILHO";
  if (/\b(cachorro|gato)\b/.test(t)) return "PET";
  return "GENERICO";
}

/** A foto sugerida de um tipo: a que tem o tipo como primeira etiqueta, depois qualquer uma dele. */
export function fotoDoTipo(tipo: GoalIcon): string {
  const f =
    FOTOS_DE_META.find((x) => x.tipos[0] === tipo) ??
    FOTOS_DE_META.find((x) => x.tipos.includes(tipo)) ??
    FOTOS_DE_META.find((x) => x.arquivo === "natureza.jpg")!;
  return urlDaFoto(f.arquivo);
}

/** A grade "Escolha uma foto": primeiro as do tipo, depois as outras, sem repetir. */
export function fotosEmOrdem(tipo: GoalIcon): string[] {
  const doTipo = FOTOS_DE_META.filter((x) => x.tipos.includes(tipo));
  const resto = FOTOS_DE_META.filter((x) => !x.tipos.includes(tipo));
  return [...doTipo, ...resto].map((x) => urlDaFoto(x.arquivo));
}

/** A foto que a tela mostra: a escolhida, ou (metas antigas, sem foto) a sugerida do tipo. */
export function fotoDaMeta(meta: { fotoUrl: string | null; icon: GoalIcon; name: string }): string {
  if (meta.fotoUrl) return meta.fotoUrl;
  return fotoDoTipo(meta.icon === "GENERICO" ? tipoDoNome(meta.name) : meta.icon);
}

/** Uma foto é do banco do app (e não a da pessoa)? */
export const ehFotoDoBanco = (url: string) => url.startsWith(PASTA_DAS_FOTOS);

/** Palavras que não servem de nome curto: ligação, verbo de meta e o "viagem" quando há destino. */
const NAO_E_NOME = new Set(["de", "da", "do", "das", "dos", "para", "pra", "a", "o", "as", "os", "e", "em", "no", "na", "meu", "minha", "meus", "minhas", "um", "uma", "trocar", "comprar", "fazer", "ter", "juntar", "quitar", "guardar"]);
const GENERICAS = new Set(["viagem", "meta", "sonho"]);

/**
 * O nome curto da meta, para a fileira de fotos e o "Próxima a chegar" (o protótipo usa
 * Reserva, Europa, Carro). Sem números e sem palavras de ligação; "Viagem" só fica quando é a
 * única palavra. Até 10 letras.
 */
export function nomeCurto(nome: string): string {
  const palavras = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p && !/^\d+$/.test(p) && !NAO_E_NOME.has(semAcento(p)));
  const especificas = palavras.filter((p) => !GENERICAS.has(semAcento(p)));
  const escolhida = especificas[0] ?? palavras[0] ?? nome.trim();
  const curta = escolhida.charAt(0).toUpperCase() + escolhida.slice(1);
  return curta.length > 10 ? curta.slice(0, 10) : curta;
}
