/**
 * "Tivemos uma mudança" (versão nova, rodada 72, 11/10/2026): o tutorial curto para QUEM JÁ USAVA
 * o app. Quem chega agora passa pelo começo (/comecar) e depois vê os MESMOS 5 passos com outra
 * abertura, "Boas-vindas ao SPI" (pedido da dona na junção, 11/10/2026). Cada uma, uma vez só.
 *
 * Texto puro, sem React e sem banco, para dar para testar. As frases são as do protótipo
 * aprovado de cada tema (tema-padrao.html, tema-girly.html, tema-manifestacao.html e
 * tema-titanio.html): o que cada passo APONTA é igual nos quatro; o que ele DIZ é do tema.
 * Sem travessão e sem emoji.
 */
import type { ProfileThemeKey } from "@/lib/profiles/themes";

export const CHAVE_LOCAL_NOVIDADES = "novidades-versao-nova-vistas";
/** Endereço que reabre o tutorial (Ajuda › Ver de novo o que mudou). */
export const LINK_VER_DE_NOVO = "/mensal/foco?novidades=1";
/** Onde ficam os vídeos do Como funciona (o atalho do fim). */
export const LINK_COMO_FUNCIONA = "/guia#videos";

/**
 * A marca da conta (User.novidadesVersaoNova):
 * - nulo: já usava o app e ainda não viu. Vê uma vez, sozinho.
 * - "terminou" ou "pulou": já passou por ele.
 * - "novo": chegou depois da versão nova (gravado ao sair do /comecar). Vê o "Boas-vindas ao SPI"
 *   uma vez.
 * - "novo-visto": a nova que já viu ou pulou o "Boas-vindas". Não vê mais.
 */
export type MarcaDasNovidades = null | "terminou" | "pulou" | "novo" | "novo-visto";
/**
 * - "mostrar": já usava e não viu o "Tivemos uma mudança". "visto": já usava e viu.
 * - "boas-vindas": nova, ainda não viu o "Boas-vindas ao SPI". "novo": nova que já viu.
 */
export type EstadoDasNovidades = "mostrar" | "visto" | "boas-vindas" | "novo";

/**
 * A marca gravada quando a conta nova termina o começo (14/10/2026): o tour já sai visto, sem
 * abrir sozinho. Fica disponível no Como funciona.
 */
export const MARCA_DO_TOUR_NA_CONTA_NOVA: MarcaDasNovidades = "novo-visto";

export function estadoDasNovidades(marca: string | null | undefined): EstadoDasNovidades {
  if (marca === "novo") return "boas-vindas";
  if (marca === "novo-visto") return "novo";
  if (marca === "terminou" || marca === "pulou") return "visto";
  return "mostrar";
}

/** Quem já usava o app (só para essa pessoa existe o "Ver de novo o que mudou"). */
export function jaUsava(estado: EstadoDasNovidades): boolean {
  return estado === "mostrar" || estado === "visto";
}

/**
 * Abre sozinho uma vez para quem já usava e não viu (e para a conta nova de antes de 14/10/2026,
 * ainda marcada "boas-vindas"). A conta nova de agora termina o começo com o tour já visto: ele não
 * abre sozinho, mas continua a um toque no Como funciona e em Configurações (o link, para todos).
 */
export function abreAsNovidades(estado: EstadoDasNovidades, pedidoPeloLink: boolean, vistoNesteAparelho: boolean): boolean {
  if (pedidoPeloLink) return true;
  if (estado === "novo") return false;
  return (estado === "mostrar" || estado === "boas-vindas") && !vistoNesteAparelho;
}

/**
 * Onde cada passo acontece e o que ele ilumina (data-tour do elemento de verdade). Vários alvos
 * viram um destaque só, que abraça todos os que estão visíveis.
 */
export type OndeDoPasso = {
  rota: string;
  alvos: string[];
  /** O passo abre o menu ☰ (no celular) para mostrar os itens dentro dele. */
  abreMenu?: boolean;
};

export const ONDE_DOS_PASSOS: OndeDoPasso[] = [
  { rota: "/mensal/foco", alvos: ["mais", "perfil"] },
  { rota: "/mensal/foco", alvos: ["fluxo"] },
  // O cartão da decisão (protótipo), com as esferas de reserva quando a pilha está vazia.
  { rota: "/decidir", alvos: ["pilha"] },
  // A Carteira com as abas (protótipo), não o menu.
  { rota: "/carteira", alvos: ["abas-carteira"] },
  // Os estilos moram em Configurações › Aparência desde a versão nova das Configurações.
  { rota: "/configuracoes/aparencia", alvos: ["temas"] },
];

export type TextoDoPasso = { titulo: string; texto: string };

export type TextosDasNovidades = {
  abertura: { titulo: string; texto: string; ver: string; pular: string };
  passos: TextoDoPasso[];
  fim: { titulo: string; texto: string | null; comecar: string; comoFunciona: string };
  /** Uma linha de aviso ao Pular (só o Padrão tem). */
  aoPular: string | null;
  /** Os pontinhos de progresso ao lado do "1 de 5" (o Girly mostra só o número). */
  pontinhos: boolean;
};

const ABERTURA = { titulo: "Tivemos uma mudança", texto: "O SPI ficou mais simples. Te mostro em 1 minuto.", ver: "Ver o que mudou", pular: "Pular" };

const PADRAO: TextosDasNovidades = {
  abertura: ABERTURA,
  passos: [
    { titulo: "Menu e perfil", texto: "O menu leva a tudo. Na sua foto ficam a conta e as preferências." },
    { titulo: "Visão geral", texto: "Resumo, Orçamento, Transações e Recorrentes, cada um numa aba." },
    { titulo: "Decidir", texto: "Uma decisão por vez, em cartões. Embaixo, as perguntas em esferas." },
    { titulo: "Metas e Carteira", texto: "Seus sonhos e seus investimentos. Na Carteira, as Oportunidades." },
    { titulo: "O seu estilo", texto: "Escolha o estilo do app. Dá para trocar quando quiser." },
  ],
  fim: { titulo: "Pronto. Tudo no lugar.", texto: "Quer ver com calma? Os vídeos ficam em Como funciona.", comecar: "Começar", comoFunciona: "Ver o Como funciona" },
  aoPular: "Combinado. Está em Configurações › Ajuda, se quiser ver depois.",
  pontinhos: true,
};

const GIRLY: TextosDasNovidades = {
  abertura: ABERTURA,
  passos: [
    { titulo: "O menu e o seu perfil", texto: "No menu ficam todas as áreas. Na sua foto, os perfis e a conta." },
    { titulo: "As abas da Visão geral", texto: "Resumo, Orçamento, Transações e Recorrentes. Deslize para o lado." },
    { titulo: "O Decidir", texto: "O que pede decisão vem em cartões. As perguntas ficam nas esferas." },
    { titulo: "Metas e Carteira", texto: "A Carteira ganhou as Oportunidades. As metas mostram quando você chega." },
    { titulo: "Escolha o seu estilo", texto: "Quatro temas, cada um com o seu jeito de falar." },
  ],
  fim: { titulo: "Pronto. Tudo no lugar.", texto: "Quer ver com calma? Tem vídeos curtos no Como funciona.", comecar: "Começar a usar", comoFunciona: "Ver o Como funciona" },
  aoPular: null,
  pontinhos: false,
};

/** Manifestação e Titânio dizem igual nos protótipos. */
const CURTO: TextosDasNovidades = {
  abertura: ABERTURA,
  passos: [
    { titulo: "O menu e a sua foto", texto: "No ☰ ficam todas as áreas. Na sua foto, o perfil e as configurações." },
    { titulo: "A Visão geral em 4 abas", texto: "Resumo, Orçamento, Transações e Recorrentes." },
    { titulo: "O Decidir", texto: "Os cartões mostram o que pede atenção. As esferas respondem às suas perguntas." },
    { titulo: "Metas e Carteira", texto: "Seus sonhos ficam em Metas. Na Carteira, seus investimentos e as Oportunidades." },
    { titulo: "Escolha o seu estilo", texto: "Dá para trocar depois em Configurações › Aparência." },
  ],
  fim: { titulo: "Pronto. Tudo no lugar.", texto: null, comecar: "Começar", comoFunciona: "Ver como funciona" },
  aoPular: null,
  pontinhos: true,
};

const TEXTOS: Record<ProfileThemeKey, TextosDasNovidades> = { padrao: PADRAO, girly: GIRLY, manifestacao: CURTO, titanio: CURTO };

/** A abertura de quem chega agora: sem gênero nos 4 temas, como a dona preferiu. */
const ABERTURA_BOAS_VINDAS = { titulo: "Boas-vindas ao SPI", texto: "Em 5 passos você conhece tudo.", ver: "Mostrar os 5 passos", pular: "Pular" };

export function textosDasNovidades(tema: ProfileThemeKey, publico: "ja-usava" | "novo" = "ja-usava"): TextosDasNovidades {
  const tx = TEXTOS[tema] ?? PADRAO;
  if (publico === "ja-usava") return tx;
  // A nova não tem o "Ver de novo o que mudou" na Ajuda: sem o aviso do Pular que manda para lá.
  return { ...tx, abertura: ABERTURA_BOAS_VINDAS, fim: { ...tx.fim, comoFunciona: "Ver como funciona" }, aoPular: null };
}

export const TOTAL_DE_PASSOS = ONDE_DOS_PASSOS.length;

/** "1 de 5". */
export function contadorDoPasso(indice: number, total = TOTAL_DE_PASSOS): string {
  return `${indice + 1} de ${total}`;
}

/** Os 5 vídeos aprovados do Como funciona (estudo-apps-financas/videos/index.html). */
export const VIDEOS_COMO_FUNCIONA = [
  { arquivo: "como-funciona-1-primeiro-mes", titulo: "Seu primeiro mês em 3 minutos", sub: "Extrato, o app separa, o livre da semana" },
  { arquivo: "como-funciona-2-quanto-posso-gastar", titulo: "Quanto posso gastar hoje", sub: "Livre até domingo, por dia, Entrou x Gastou" },
  { arquivo: "como-funciona-3-decidir", titulo: "Decidir", sub: 'A pilha e o "Posso comprar algo?"' },
  { arquivo: "como-funciona-4-metas", titulo: "Suas metas", sub: "Criar com foto, ver o ritmo, guardar" },
  { arquivo: "como-funciona-5-carteira", titulo: "Carteira", sub: "Por tipo, os anéis das análises, a estratégia" },
].map((v) => ({ ...v, src: `/videos/${v.arquivo}.mp4`, poster: `/videos/${v.arquivo}-poster.jpg` }));
