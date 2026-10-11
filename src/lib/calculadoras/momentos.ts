/**
 * A tela de escolher a calculadora: "Qual é o seu momento?" (protótipo aprovado, rodadas 14 e 20).
 *
 * Um cartão com foto por calculadora. Cada filtro já vem num ritmo sem buraco: um cartão largo
 * ocupa a linha; os outros andam em dupla; quem sobrar sozinho vira largo (nunca meio cartão
 * numa linha).
 *
 * "Mapear minhas dívidas" (filtro "Tenho dívida") leva para a área Dívidas, como no protótipo.
 */
export type IdDaCalculadora = "financiar" | "carro" | "vale" | "amortizar" | "marcacao" | "consorcio" | "aposentadoria" | "mapear";

export type CartaoDeCalculadora = {
  id: IdDaCalculadora;
  titulo: string;
  /** Aparece só no cartão largo. */
  sub?: string;
  /** O nome da foto em /calculadoras, ou um caminho inteiro começando por "/". */
  foto: string;
  href: string;
};

export const CARTOES: Record<IdDaCalculadora, CartaoDeCalculadora> = {
  financiar: { id: "financiar", titulo: "Financiar ou alugar?", sub: "Quem termina com mais patrimônio", foto: "casa", href: "/simuladores/financiar-vs-alugar" },
  carro: { id: "carro", titulo: "Assinar ou comprar o carro?", foto: "carro", href: "/simuladores/carro" },
  vale: { id: "vale", titulo: "Vale a pena comprar?", foto: "presente", href: "/simuladores/vale-a-pena" },
  amortizar: { id: "amortizar", titulo: "Quitar a dívida ou investir?", foto: "reserva", href: "/simuladores/amortizar-vs-investir" },
  marcacao: { id: "marcacao", titulo: "Vender a renda fixa antes?", foto: "natureza", href: "/simuladores/marcacao-mercado" },
  consorcio: { id: "consorcio", titulo: "Consórcio ou financiamento?", sub: "O que custa menos no fim", foto: "apartamento", href: "/simuladores/consorcio" },
  aposentadoria: { id: "aposentadoria", titulo: "Quanto preciso para me aposentar?", sub: "Quanto juntar para viver de renda", foto: "liberdade", href: "/planejamento/acumulo" },
  mapear: { id: "mapear", titulo: "Mapear minhas dívidas", sub: "Todas num lugar, com a ordem para quitar", foto: "/fotos/dividas-livre.jpg", href: "/dividas" },
};

export type IdDoMomento = "tudo" | "compra" | "divida" | "invest" | "futuro";

/** [id, largo?] na ordem do protótipo. */
export const MOMENTOS: { id: IdDoMomento; rotulo: string; itens: [IdDaCalculadora, boolean?][] }[] = [
  { id: "tudo", rotulo: "Tudo", itens: [["financiar", true], ["carro"], ["vale"], ["amortizar"], ["marcacao"], ["consorcio", true], ["aposentadoria", true]] },
  { id: "compra", rotulo: "Vou comprar algo", itens: [["vale"], ["carro"], ["financiar", true], ["consorcio"]] },
  { id: "divida", rotulo: "Tenho dívida", itens: [["amortizar"], ["mapear"]] },
  { id: "invest", rotulo: "Tenho investimento", itens: [["marcacao"], ["amortizar"]] },
  { id: "futuro", rotulo: "Penso no futuro", itens: [["aposentadoria", true], ["financiar", true]] },
];

export type Fileira = { largo: true; cartao: CartaoDeCalculadora } | { largo: false; cartoes: [CartaoDeCalculadora, CartaoDeCalculadora] };

export function fileirasDoMomento(id: IdDoMomento): Fileira[] {
  const momento = MOMENTOS.find((m) => m.id === id) ?? MOMENTOS[0];
  const out: Fileira[] = [];
  let par: IdDaCalculadora[] = [];
  const soltaPar = () => {
    if (par.length === 1) out.push({ largo: true, cartao: CARTOES[par[0]] });
    par = [];
  };
  for (const [calc, largo] of momento.itens) {
    if (largo) {
      soltaPar();
      out.push({ largo: true, cartao: CARTOES[calc] });
      continue;
    }
    par.push(calc);
    if (par.length === 2) {
      out.push({ largo: false, cartoes: [CARTOES[par[0]], CARTOES[par[1]]] });
      par = [];
    }
  }
  soltaPar();
  return out;
}
