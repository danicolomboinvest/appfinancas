/**
 * A resposta automática da dúvida ("Difícil de usar", decisão da Dani em 11/10): o app procura na
 * dúvida o assunto mais comum (importar extrato, acesso, categoria, metas, cartão) e responde na
 * hora, na tela e por e-mail, com o passo a passo do guia e o vídeo do Como funciona que combina.
 * Sem assunto achado, a resposta leva ao guia inteiro. Puro.
 */
export type Assunto = "importar" | "acesso" | "categoria" | "metas" | "cartao";

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Em ordem: o primeiro que bater vence (importar antes de cartão: "fatura do cartão" é importar). */
const PALAVRAS: [Assunto, RegExp][] = [
  ["importar", /\b(extrato|importa\w*|subir|sobe|ofx|csv|pdf|planilha|arquivo|fatura|banco)\b/],
  ["acesso", /\b(acesso|login|entrar|entro|senha|bloquead\w*|cadeado|e-?mail da compra|nao abre)\b/],
  ["categoria", /\b(categori\w*|classifica\w*|separ\w*|errou a categoria)\b/],
  ["metas", /\b(meta|metas|objetivo|sonho|guardar para|aporte)\b/],
  ["cartao", /\b(cartao|cartoes|limite|credito|parcela\w*)\b/],
];

export function assuntoDaDuvida(texto: string): Assunto | null {
  const t = normalizar(texto);
  return PALAVRAS.find(([, r]) => r.test(t))?.[0] ?? null;
}

export type Resposta = { titulo: string; passos: string[]; guia: string; video: string | null; rotuloDoVideo: string | null };

const VIDEO = (n: number, nome: string) => `/videos/como-funciona-${n}-${nome}.mp4`;

/** O passo a passo de cada assunto (o mesmo do Guia do app) e o vídeo que combina. */
export const RESPOSTAS: Record<Assunto, Resposta> = {
  importar: {
    titulo: "Como trazer o extrato",
    passos: ["No app do seu banco, baixe o extrato (ou a fatura do cartão) em PDF, Excel, CSV ou OFX.", "No SPI, toque no + e em Importar extrato.", "Escolha o arquivo. O app separa tudo e só pergunta o que não sabe."],
    guia: "/guia#extrato-ou-fatura",
    video: VIDEO(1, "primeiro-mes"),
    rotuloDoVideo: "Seu primeiro mês em 3 minutos",
  },
  acesso: {
    titulo: "Como entrar no app",
    passos: ["Entre com o mesmo e-mail que você usou na compra.", "Esqueceu a senha? Na tela de entrar, toque em Esqueci minha senha.", "Comprou com outro e-mail? Responda este e-mail com os dois endereços."],
    guia: "/guia#comecar",
    video: null,
    rotuloDoVideo: null,
  },
  categoria: {
    titulo: "Como acertar a categoria",
    passos: ["Em Transações, toque no lançamento.", "Escolha a categoria certa.", "O app aprende com o nome da loja e acerta da próxima vez."],
    guia: "/guia#revisao",
    video: VIDEO(1, "primeiro-mes"),
    rotuloDoVideo: "Seu primeiro mês em 3 minutos",
  },
  metas: {
    titulo: "Como usar as metas",
    passos: ["No menu, abra Metas e toque em Nova meta.", "Diga o que é, quanto custa e para quando.", "O app mostra quanto guardar por mês e acompanha cada aporte."],
    guia: "/guia#guardar",
    video: VIDEO(4, "metas"),
    rotuloDoVideo: "Metas",
  },
  cartao: {
    titulo: "Como o app lê o cartão",
    passos: ["Traga a fatura do cartão pelo + em Importar extrato.", "Em Recorrentes, defina o limite do cartão para o mês.", "O app avisa quando o cartão chega perto do limite."],
    guia: "/guia#extrato-ou-fatura",
    video: VIDEO(2, "quanto-posso-gastar"),
    rotuloDoVideo: "Quanto posso gastar hoje",
  },
};

export const RESPOSTA_GERAL: Resposta = {
  titulo: "O guia do app",
  passos: ["O guia tem o passo a passo de cada parte do app.", "Os vídeos do Como funciona mostram o app em menos de 30 segundos cada."],
  guia: "/guia",
  video: VIDEO(1, "primeiro-mes"),
  rotuloDoVideo: "Seu primeiro mês em 3 minutos",
};

export function respostaDaDuvida(texto: string): { assunto: Assunto | null; resposta: Resposta } {
  const assunto = assuntoDaDuvida(texto);
  return { assunto, resposta: assunto ? RESPOSTAS[assunto] : RESPOSTA_GERAL };
}
