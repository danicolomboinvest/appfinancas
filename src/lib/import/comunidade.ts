import type { ParentCategory } from "@prisma/client";
import base from "./base-comunitaria.json";
import { chaveDoComerciante, chaveUtil, semAcentoNemPontuacao } from "./comerciante";

/**
 * A base comunitária: o app aprendendo com tudo que já entrou, de todo mundo, sem identificar
 * ninguém. Quando várias pessoas DIFERENTES puseram a mesma loja na mesma categoria, a próxima
 * pessoa recebe a loja já separada. (Pedido da Dani: 02/10/2026, 76% dos gastos chegavam sem
 * categoria; 12/10/2026, "o motor não pode começar do zero".)
 *
 * Como é feita: o script scripts/base-comunitaria.ts lê a produção SÓ PARA LEITURA, junta os
 * votos (regra que a pessoa ensinou, lançamento importado que ela conferiu na revisão, lançamento
 * que ela escreveu à mão) e grava src/lib/import/base-comunitaria.json, que vai versionado no
 * código. Roda de novo quando quiser (toda semana basta) e entra no próximo deploy.
 *
 * Privacidade, obrigatória e testada:
 * - Só comerciante (empresa, loja, serviço) usado por 3 ou mais pessoas diferentes.
 * - Pix, TED, DOC, transferência, "recebido de", CPF/CNPJ na descrição e qualquer chave que pareça
 *   nome de gente ficam de fora.
 * - O arquivo guarda só comerciante, categoria, confiança e número de pessoas. Nenhum id, valor,
 *   data ou e-mail.
 * - Cada pessoa vale um voto por comerciante (a categoria que ela mais usou), por mais que compre lá.
 *
 * No motor ela vem depois da regra da própria pessoa e antes do dicionário, e só com alta
 * confiança: 70% ou mais dos votos numa categoria e 3 ou mais pessoas. Loja que vende de tudo
 * (Amazon, Mercado Livre) racha o voto e continua com o dicionário ou a pergunta.
 */

export const MIN_PESSOAS = 3;
export const CONFIANCA_MINIMA = 0.7;

/**
 * Lojas em que a base aprendeu um erro do PRÓPRIO app, não uma escolha das clientes: ficam de fora
 * ao gerar e ao ler a base, e o dicionário decide. Cacau Show (21/10/2026): uma versão antiga lia
 * o "show" do nome como Cinema/Shows, ninguém mexeu e a base passou a dizer Lazer (23 contas).
 */
export const FORA_DA_BASE = ["cacau show"];
const foraDaBase = (chave: string) => FORA_DA_BASE.some((loja) => chave === loja || chave.startsWith(`${loja} `));

export type PerfilDaBase = "pessoal" | "empresa";
/** Uma linha do arquivo: comerciante, categoria, confiança (0 a 1) e quantas pessoas votaram. */
export type EntradaDaBase = { comerciante: string; categoria: ParentCategory; confianca: number; pessoas: number };
export type BaseComunitaria = { geradaEm: string; pessoal: EntradaDaBase[]; empresa: EntradaDaBase[] };

/** Um voto lido da produção. `pessoa` só existe na memória do script, para contar pessoas distintas. */
export type Voto = { pessoa: string; perfil: PerfilDaBase; descricao: string; categoria: ParentCategory };

const MOVIMENTO_ENTRE_PESSOAS = /\b(pix|ted|doc|transf|transferencia|transferido|recebido de|recebida de|enviado para|enviada para|devolucao|deposito)\b/;
const DOCUMENTO = /([•*]{3}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\b\d{11}\b|\b\d{14}\b)/;

/**
 * Nomes e sobrenomes comuns no Brasil. Uma chave que começa com um nome desses, ou que é feita só
 * de nomes e sobrenomes, é tratada como pessoa e não entra (o MEI com nome de gente, "MARIA SILVA
 * DOCES", também fica de fora: melhor perder uma loja do que guardar o nome de alguém).
 */
const NOMES = new Set(
  (
    "ana maria joao jose antonio francisco carlos paulo pedro lucas luiz luis marcos gabriel rafael daniel daniela marcelo bruno " +
    "eduardo felipe raimundo rodrigo manoel manuel mateus matheus andre fernando fernanda fabio leonardo gustavo guilherme " +
    "leandro tiago thiago diego ricardo julio julia juliana jorge sergio alexandre roberto vitor victor igor caio hugo " +
    "renato renata adriana aline amanda bianca bruna camila carla carolina caroline claudia cristina debora denise eliane " +
    "elaine fabiana fatima flavia gabriela helena ingrid isabela isabel jessica joana jaqueline karina kelly larissa laura leticia " +
    "lucia luciana luana marcia mariana marina michele monica natalia patricia paula priscila raquel rebeca regina rita rosa " +
    "sandra sara silvia simone sonia tatiana tais vanessa vera viviane beatriz alice valentina sophia sofia heloisa lorena " +
    "livia manuela cecilia clara vitoria rayana kaique davi arthur heitor bernardo enzo miguel samuel benjamin joaquim " +
    "lorenzo theo nicolas murilo henrique otavio vinicius wesley william willian anderson alan allan cesar cristiano " +
    "edson elias emerson everton fabricio gilberto gilson helio jair jefferson joel jonas luciano marcio mauricio nelson " +
    "osvaldo reinaldo ronaldo sebastiao valter walter wagner djenifer jenifer jennifer claudete aparecida conceicao " +
    "graca lucas maria tania tereza teresa ivone ivete irene glória gloria marta marlene neusa vilma zilda"
  ).split(" "),
);
const SOBRENOMES = new Set(
  (
    "silva santos oliveira souza sousa rodrigues ferreira alves pereira lima gomes costa ribeiro martins carvalho almeida " +
    "lopes soares fernandes vieira barbosa rocha dias nascimento andrade moreira nunes marques machado mendes freitas " +
    "cardoso ramos goncalves santana teixeira araujo pinto castro correa campos moura cavalcanti batista melo azevedo " +
    "colombo romero castilhos sobreira augusto maniglia bastos macedo rohling sato tanii notini bahia chagas rosa guimaraes"
  ).split(" "),
);

/** Parece pessoa física? Pelo começo da chave (nome comum) ou por ser feita só de nomes. */
export function pareceNomeDePessoa(chave: string): boolean {
  const palavras = chave.split(" ").filter(Boolean);
  if (palavras.length === 0) return false;
  if (NOMES.has(palavras[0]) && palavras.length >= 2) return true;
  return palavras.every((p) => NOMES.has(p) || SOBRENOMES.has(p));
}

/** A chave que pode entrar na base, ou null se a descrição não serve (pessoa, Pix, documento). */
export function chaveParaABase(descricao: string): string | null {
  if (DOCUMENTO.test(descricao)) return null;
  if (MOVIMENTO_ENTRE_PESSOAS.test(semAcentoNemPontuacao(descricao))) return null;
  const chave = chaveDoComerciante(descricao);
  if (!chaveUtil(chave) || pareceNomeDePessoa(chave)) return null;
  return chave;
}

/**
 * Monta a base a partir dos votos. Puro: o script lê a produção e chama isto; o teste também.
 * Só devolve comerciante, categoria, confiança e pessoas, ordenado pelo comerciante (o arquivo
 * muda pouco de uma semana pra outra e o diff fica legível).
 */
export function montarBaseComunitaria(votos: Voto[], geradaEm = new Date().toISOString().slice(0, 10)): BaseComunitaria {
  // perfil|comerciante → pessoa → categoria → quantas vezes
  const porComerciante = new Map<string, Map<string, Map<ParentCategory, number>>>();
  for (const v of votos) {
    const chave = chaveParaABase(v.descricao);
    if (!chave || foraDaBase(chave)) continue;
    const k = `${v.perfil}|${chave}`;
    const pessoas = porComerciante.get(k) ?? new Map<string, Map<ParentCategory, number>>();
    const cats = pessoas.get(v.pessoa) ?? new Map<ParentCategory, number>();
    cats.set(v.categoria, (cats.get(v.categoria) ?? 0) + 1);
    pessoas.set(v.pessoa, cats);
    porComerciante.set(k, pessoas);
  }
  const saida: BaseComunitaria = { geradaEm, pessoal: [], empresa: [] };
  for (const [k, pessoas] of porComerciante) {
    if (pessoas.size < MIN_PESSOAS) continue;
    const [perfil, comerciante] = k.split("|") as [PerfilDaBase, string];
    // Um voto por pessoa: a categoria que ELA mais usou para esse comerciante.
    const contagem = new Map<ParentCategory, number>();
    for (const cats of pessoas.values()) {
      const minha = [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0];
      contagem.set(minha, (contagem.get(minha) ?? 0) + 1);
    }
    const [categoria, n] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
    saida[perfil].push({ comerciante, categoria, confianca: Math.round((n / pessoas.size) * 100) / 100, pessoas: pessoas.size });
  }
  saida.pessoal.sort((a, b) => a.comerciante.localeCompare(b.comerciante));
  saida.empresa.sort((a, b) => a.comerciante.localeCompare(b.comerciante));
  return saida;
}

export type IndiceDaBase = Map<string, ParentCategory>;

/** Só o que tem alta confiança vira índice: comerciante → categoria. */
export function indexarBase(entradas: EntradaDaBase[]): IndiceDaBase {
  const indice: IndiceDaBase = new Map();
  const pessoasDa = new Map<string, number>();
  for (const e of entradas) {
    if (e.pessoas < MIN_PESSOAS || e.confianca < CONFIANCA_MINIMA) continue;
    // A chave entra no jeito de HOJE de montar o nome da loja: o arquivo de 12/10/2026 tinha
    // "99food", o app passou a separar letra de número ("99 food") e a busca caía no "99" das
    // corridas (99 Food virava Transporte). Duas que viram a mesma chave: vale a de mais pessoas.
    const chave = chaveParaABase(e.comerciante) ?? e.comerciante;
    if (foraDaBase(chave)) continue;
    if ((pessoasDa.get(chave) ?? 0) >= e.pessoas) continue;
    pessoasDa.set(chave, e.pessoas);
    indice.set(chave, e.categoria);
  }
  return indice;
}

const BASE = base as BaseComunitaria;
const INDICES: Record<PerfilDaBase, IndiceDaBase> = { pessoal: indexarBase(BASE.pessoal), empresa: indexarBase(BASE.empresa) };

/** O perfil da base para o tipo de perfil do app: Empresa tem a dela; o resto usa a da pessoa física. */
export function perfilDaBase(profileKind?: string | null): PerfilDaBase {
  return profileKind === "EMPRESA" ? "empresa" : "pessoal";
}

/**
 * O que a comunidade diz desta descrição. Procura a chave inteira e depois os começos dela
 * ("grupo madero batel" → "grupo madero" → "grupo"), do mais específico para o mais curto, e
 * nunca uma chave sem nome de verdade. Pix e nome de gente nunca chegam aqui com resposta: eles
 * não entram na base.
 */
export function classificarPelaComunidade(descricao: string, perfil: PerfilDaBase = "pessoal", indice: IndiceDaBase = INDICES[perfil]): ParentCategory | null {
  const chave = chaveParaABase(descricao);
  if (!chave) return null;
  const palavras = chave.split(" ");
  for (let n = palavras.length; n >= 1; n -= 1) {
    const prefixo = palavras.slice(0, n).join(" ");
    if (!chaveUtil(prefixo)) break;
    const achada = indice.get(prefixo);
    if (achada) return achada;
  }
  return null;
}
