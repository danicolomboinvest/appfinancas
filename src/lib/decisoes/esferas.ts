import type { ProfileThemeKey } from "@/lib/profiles/themes";
import type { Resposta } from "./respostas";

/**
 * "Qual é a sua pergunta?" em esferas (rodada 57, direção 2 "orbe de material"). As 10 perguntas
 * do Decidir, cada uma numa esfera de vidro com um objeto e uma pílula com o dado vivo do motor
 * (o mesmo número que a resposta vai mostrar). A tela principal mostra as 4 primeiras; "Ver todas
 * as perguntas · 10" abre a grade com os filtros.
 *
 * Puro: a página calcula os números e manda; aqui só a ordem, os títulos e o texto das pílulas.
 */

export type ChaveDaPergunta = "compra" | "guardar" | "meta" | "semana" | "reserva" | "demais" | "exagero" | "raiox" | "acabou" | "melhorei";
export type Filtro = "tudo" | "compra" | "guardar" | "mes";

export type PerguntaDoDecidir = { chave: ChaveDaPergunta; titulo: string; href: string; filtros: Filtro[] };

/** A ordem e os textos do protótipo aprovado. Cada uma abre a tela que já responde. */
export const PERGUNTAS_DO_DECIDIR: PerguntaDoDecidir[] = [
  { chave: "compra", titulo: "Posso comprar algo?", href: "/decidir/comprar", filtros: ["compra"] },
  { chave: "guardar", titulo: "Como guardar mais?", href: "/decidir/pergunta/guardar", filtros: ["guardar"] },
  { chave: "meta", titulo: "Quando chego na minha meta?", href: "/decidir/pergunta/meta", filtros: ["guardar"] },
  { chave: "semana", titulo: "Quanto posso gastar na semana?", href: "/decidir/pergunta/semana", filtros: ["compra", "mes"] },
  { chave: "reserva", titulo: "Minha reserva basta?", href: "/decidir/pergunta/reserva", filtros: ["guardar"] },
  { chave: "demais", titulo: "Estou gastando demais?", href: "/decidir/pergunta/gastando", filtros: ["mes"] },
  { chave: "exagero", titulo: "Onde estou exagerando?", href: "/decidir/pergunta/exagerando", filtros: ["mes"] },
  { chave: "raiox", titulo: "Que pequenos gastos posso cortar?", href: "/decidir/raio-x", filtros: ["compra", "guardar"] },
  { chave: "acabou", titulo: "Por que o dinheiro acabou antes?", href: "/decidir/pergunta/acabou", filtros: ["mes"] },
  { chave: "melhorei", titulo: "Melhorei em relação ao mês passado?", href: "/decidir/pergunta/melhorei", filtros: ["mes"] },
];

export const FILTROS: { chave: Filtro; nome: string }[] = [
  { chave: "tudo", nome: "Tudo" },
  { chave: "compra", nome: "Vou comprar" },
  { chave: "guardar", nome: "Quero guardar" },
  { chave: "mes", nome: "Meu mês" },
];

/** No Padrão o título longo do Raio-X encurta para caber em 2 linhas a 390 px (rodada 57). */
export function tituloDaEsfera(p: PerguntaDoDecidir, tema: ProfileThemeKey): string {
  if (p.chave === "raiox" && tema === "padrao") return "O que posso cortar?";
  return p.titulo;
}

export function perguntasDoFiltro(filtro: Filtro): PerguntaDoDecidir[] {
  return filtro === "tudo" ? PERGUNTAS_DO_DECIDIR : PERGUNTAS_DO_DECIDIR.filter((p) => p.filtros.includes(filtro));
}

export function lerFiltro(valor: string | string[] | undefined): Filtro {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return FILTROS.some((f) => f.chave === v) ? (v as Filtro) : "tudo";
}

/** O texto da pílula e se ela pede atenção (ponto âmbar). Sem dado, sem pílula. */
export type Pilula = { texto: string; atencao: boolean } | null;

export type DadosDasPilulas = {
  money: (v: number) => string;
  tema: ProfileThemeKey;
  /** O livre do mês (o mesmo do Resumo). Null sem orçamento. */
  livreMes: number | null;
  porDia: number | null;
  ateDomingo: number | null;
  /** "Quanto preciso guardar": o valor por mês e se o plano já cobre. */
  guardar: { porMes: number; cobre: boolean } | null;
  /** A primeira meta atrasada (sem contar a reserva): quando chega pelo ritmo. */
  metaAtrasada: { chegaCurto: string | null } | null;
  /** Há meta com prazo e nenhuma atrasada. */
  metasNoRitmo: boolean;
  reserva: { meses: number; minimo: number } | null;
  /** A categoria que mais passou do plano. */
  passou: { label: string; valor: number } | null;
  raioxAnual: number | null;
  /** As respostas desenhadas do motor, para as pílulas do "meu mês". */
  respostas: Partial<Record<"demais" | "acabou" | "melhorei", Resposta>>;
};

const semMarca = (s: string) => s.replace(/^[−+-]\s?/, "");

export function pilulaDaPergunta(k: ChaveDaPergunta, d: DadosDasPilulas): Pilula {
  const m = d.money;
  switch (k) {
    case "compra":
      // O livre do mês, o mesmo do Orçamento: passou do plano diz quanto, como lá.
      if (d.livreMes === null) return null;
      return d.livreMes <= -1 ? { texto: `${m(-d.livreMes)} acima do plano`, atencao: true } : { texto: `${m(Math.max(0, d.livreMes))} livres`, atencao: d.livreMes < 1 };
    case "guardar":
      return d.guardar && d.guardar.porMes >= 1 ? { texto: `${m(d.guardar.porMes)} por mês`, atencao: !d.guardar.cobre } : null;
    case "meta":
      if (d.metaAtrasada) return { texto: d.metaAtrasada.chegaCurto ?? "sem ritmo", atencao: true };
      return d.metasNoRitmo ? { texto: "no ritmo", atencao: false } : null;
    case "semana":
      // Manifestação e Titânio mostram a semana; Padrão e Girly, o dia (protótipos aprovados).
      if (d.tema === "manifestacao" || d.tema === "titanio") return d.ateDomingo !== null ? { texto: `${m(Math.max(0, d.ateDomingo))} até domingo`, atencao: d.ateDomingo < 1 } : null;
      return d.porDia !== null ? { texto: `${m(Math.max(0, d.porDia))} por dia`, atencao: d.porDia < 1 } : null;
    case "reserva": {
      if (!d.reserva) return null;
      const r = d.reserva;
      const texto = r.meses < 1 ? "menos de 1 mês" : `${(Math.floor(r.meses * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${Math.floor(r.meses * 10) / 10 === 1 ? "mês" : "meses"}`;
      return { texto, atencao: r.meses < r.minimo };
    }
    case "exagero":
      return d.passou ? { texto: `${d.passou.label} ${m(d.passou.valor)} acima`, atencao: true } : { texto: "nada passou", atencao: false };
    case "raiox":
      return d.raioxAnual && d.raioxAnual >= 1 ? { texto: `${m(d.raioxAnual)} por ano`, atencao: false } : null;
    case "demais": {
      const r = d.respostas.demais;
      if (!r?.visual) return null;
      const valor = r.visual.rotulo?.match(/R\$\s?[\d.,]+ (acima|abaixo)/);
      return { texto: valor ? valor[0] : r.visual.destaque, atencao: r.veredito !== "bom" };
    }
    case "acabou": {
      const r = d.respostas.acabou;
      if (!r?.visual) return null;
      const aMais = /a mais/.test(r.visual.rotulo ?? "");
      return { texto: `${semMarca(r.visual.destaque)} ${aMais ? "a mais" : "a menos"}`, atencao: aMais };
    }
    case "melhorei": {
      const r = d.respostas.melhorei;
      if (!r?.visual) return null;
      const linha = r.visual.blocos?.flatMap((b) => ("linhas" in b ? b.linhas : [])).find((l) => /Guardou da renda/.test(l.rotulo));
      return { texto: linha ? `${linha.agoraTexto} guardado` : r.visual.destaque, atencao: r.veredito !== "bom" };
    }
  }
}
