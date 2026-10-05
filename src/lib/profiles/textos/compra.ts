/**
 * Textos do "Posso comprar?" passo a passo (05/10/2026), na voz do Padrão. Cada tema sobrescreve
 * em `vozes/<tema>.ts`. Prefixo `compra`, como o resto da tela (as chaves antigas moram em
 * `textos/foco.ts`).
 *
 * Os números chegam já formatados (texto): a voz só escreve a frase. Isso deixa cada tema mudar
 * o jeito de falar sem refazer conta, e o teste de jargão chamar qualquer função com texto.
 */

import type { Sinceridade } from "@/lib/decisoes/compra-guiada";
import type { Veredito } from "@/lib/decisoes/posso-comprar";

/** Um caminho do "fazer caber", com os números prontos pra frase. */
export type CaminhoParaTexto = {
  chave: "parcelar" | "barato" | "cortar" | "desconto" | "juntarRapido" | "juntar";
  /** Parcelar / barato: em quantas vezes. */
  vezes?: number;
  /** Parcelar: a parcela. Juntar: quanto por mês. */
  porMes?: string;
  /** Barato: o teto. Desconto: o preço com desconto. Cortar: o total por mês (ou no mês). */
  valor?: string;
  /** Desconto: quanto sairia parcelado. */
  parcelado?: string;
  /** Cortar: as categorias ("Lazer e Outros"; o total vai em `valor`). Juntar mais rápido: "R$ 120 de Lazer". */
  cortes?: string;
  /** Cortar: o corte é por mês (parcela) ou só neste mês (à vista). */
  cortePorMes?: boolean;
  /** Juntar: em quantos meses, e o mês da compra ("maio de 2027"). */
  meses?: number;
  mes?: string;
};

export type TextosCompra = {
  // Passo 1: o que é
  compraOutraCoisa: string;
  compraOutraCoisaPergunta: string;
  compraOutraCoisaExemplo: string;
  // Passo 2: quanto custa
  compraQuantoCusta: string;
  compraDigitarExato: string;
  compraVoltarRoleta: string;
  compraContinuar: string;
  // Passo 3: como pagar
  compraComoPagar: string;
  compraAVistaSub: string;
  compraParceladoSub: string;
  compraDecideVoce: string;
  compraDecideVoceSub: string;
  // Passo 4: vezes e juros
  compraEmQuantasVezes: string;
  /** "360x" e, a partir de 60x, "30 anos" do lado. */
  compraAnos(anos: number): string;
  compraTemJuros: string;
  compraJurosNao: string;
  compraJurosSim: string;
  compraJurosNaoSei: string;
  compraQuantoJuros: string;
  /** "10x de R$ 300 sem juros" / "com 4,5% ao mês" / "Sem saber, conto 3% ao mês". */
  compraResumoParcela(vezes: number, parcela: string, juros: "nao" | "sim" | "naosei", taxa: string): string;
  compraTotalPago(total: string): string;
  // Passo 5: seja sincera
  compraSincera: string;
  compraSinceraSub: string;
  compraSinceridade: Record<Sinceridade, { titulo: string; sub: string }>;
  // Analisando
  compraAnalisando: string;
  compraAnaliseItens: string[];
  // Resultado
  /** O título grande, pelo resultado e pelo quanto ela precisa. `soPorImpulso`: cabia, ficou amarelo por ser impulso. */
  compraVereditoTitulo(v: Veredito, s: Sinceridade, soPorImpulso: boolean): string;
  /** "Escolhi: 10x sem juros", quando ela pediu para o app decidir. */
  compraEscolhi(forma: string): string;
  // O quadro visual (05/10: "tem muito texto na tela"): uma barra de onde sai o dinheiro, a data
  // do sonho e a régua das parcelas. Só rótulos curtos.
  compraQPreco: string;
  compraQParcela(vezes: number): string;
  compraLegLivre: string;
  compraLegSobra: string;
  compraLegGuardado: string;
  compraLegFalta: string;
  compraQCabe: string;
  compraAtraso(meses: number): string;
  compraSemPrevisao: string;
  compraJurosChip(valor: string): string;
  compraAvisoDados: string;
  compraQParcelasMes: string;
  compraParcelasAcima: string;
  compraPagandoAte(mes: string): string;
  compraPorMes: string;
  // Quero muito: o que vale mais
  compraOQueValeMais: string;
  compraPrioridadeCompra: string;
  compraPrioridadeCompraSub(meta: string, mes: string): string;
  compraPrioridadeSonho(meta: string, mes: string): string;
  compraPrioridadeSonhoSub: string;
  compraVerComoCaber: string;
  compraDecidir: string;
  // Fazer caber
  compraCaberTitulo: string;
  compraCaberSub: string;
  compraCaberNadaTitulo: string;
  compraCaberNada(valor: string): string;
  compraCaminho(c: CaminhoParaTexto): { titulo: string; detalhe: string; comoCompra: string };
  compraSeloCabe: string;
  compraSeloSemDivida: string;
  compraSeloCusto: string;
  compraSeguirCom: string;
  compraEscolhaUm: string;
  // Decidir
  compraOQueVaiFazer: string;
  compraSugestao: string;
  compraDecComprarSub(precisa: boolean): string;
  compraDecGuardar: string;
  compraDecGuardarSub: string;
  compraDecGuardarMeta(mensal: string, mes: string): string;
  compraDecAmanhaSub: string;
  compraDecDesistir: string;
  compraDecDesistirSub: string;
  // Fim
  compraFimComprarTitulo: string;
  compraFimGuardarTitulo: string;
  compraFimGuardar(mensal: string, meses: number, mes: string, corte: string | null): string;
  compraFimAmanhaTitulo: string;
  compraFimDesistirTitulo: string;
  compraCriarMeta: string;
  compraMetaCriada: string;
  compraVerMeta: string;
};

const mesesTxt = (n: number) => `${n} ${n === 1 ? "mês" : "meses"}`;

export const PADRAO_COMPRA: TextosCompra = {
  compraOutraCoisa: "Outra coisa",
  compraOutraCoisaPergunta: "O que é?",
  compraOutraCoisaExemplo: "Ex.: bolsa, bicicleta, presente",
  compraQuantoCusta: "Quanto custa?",
  compraDigitarExato: "Digitar o valor exato",
  compraVoltarRoleta: "Voltar para a roleta",
  compraContinuar: "Continuar",
  compraComoPagar: "Como você pensou em pagar?",
  compraAVistaSub: "Sai tudo de uma vez",
  compraParceladoSub: "No cartão ou financiado",
  compraDecideVoce: "Quero que você decida",
  compraDecideVoceSub: "O app vê o jeito que pesa menos",
  compraEmQuantasVezes: "Em quantas vezes?",
  compraAnos: (a) => `${a} anos`,
  compraTemJuros: "Tem juros?",
  compraJurosNao: "Não",
  compraJurosSim: "Sim",
  compraJurosNaoSei: "Não sei",
  compraQuantoJuros: "Quanto de juros, ao mês?",
  compraResumoParcela: (n, p, j, t) =>
    `${n}x de ${p}${j === "nao" ? " sem juros" : j === "sim" ? ` com ${t} ao mês` : `. Sem saber, conto ${t} ao mês, o comum em loja.`}`,
  compraTotalPago: (t) => `Total pago: ${t}`,
  compraSincera: "Sinceramente…",
  compraSinceraSub: "Essa compra é",
  compraSinceridade: {
    precisa: { titulo: "Preciso mesmo", sub: "Faz falta no dia a dia" },
    quero: { titulo: "Quero muito", sub: "Penso nela faz tempo" },
    impulso: { titulo: "Impulso", sub: "Vi agora e quis" },
  },
  compraAnalisando: "Analisando seu mês…",
  compraAnaliseItens: ["Seus gastos do mês", "Compras que você já decidiu", "Suas metas e a reserva", "Quanto costuma sobrar"],
  compraVereditoTitulo: (v, s, soPorImpulso) => {
    if (v === "ok") return "Pode comprar.";
    if (s === "precisa") return v === "custo" ? "Precisa? Dá para fazer." : "Hoje não fecha, nem apertando.";
    if (v === "custo") return soPorImpulso ? "Cabe, mas foi impulso." : "Dá, mas tem um custo.";
    return "Eu não compraria agora.";
  },
  compraEscolhi: (f) => `Escolhi: ${f}`,
  compraQPreco: "Preço",
  compraQParcela: (n) => `Parcela (${n}x)`,
  compraLegLivre: "Livre",
  compraLegSobra: "Dia a dia",
  compraLegGuardado: "Do guardado",
  compraLegFalta: "Falta",
  compraQCabe: "Cabe no que está livre ✓",
  compraAtraso: (n) => `+${n} ${n === 1 ? "mês" : "meses"}`,
  compraSemPrevisao: "sem previsão",
  compraJurosChip: (v) => `⚠️ +${v} de juros`,
  compraAvisoDados: "Confira seus dados",
  compraQParcelasMes: "Parcelas no mês",
  compraParcelasAcima: "Acima de 15% da renda",
  compraPagandoAte: (mes) => `⏳ Ainda pagando em ${mes}`,
  compraPorMes: "/mês",
  compraOQueValeMais: "O que vale mais para você?",
  compraPrioridadeCompra: "Comprar agora",
  compraPrioridadeCompraSub: (meta, mes) => `${meta} vai para ${mes}`,
  compraPrioridadeSonho: (meta, mes) => `${meta} em ${mes}`,
  compraPrioridadeSonhoSub: "A compra vira uma meta e vem depois",
  compraVerComoCaber: "Ver como fazer caber",
  compraDecidir: "Decidir",
  compraCaberTitulo: "Dá para fazer caber",
  compraCaberSub: "Escolha um caminho. Cada um mostra o que acontece com o seu mês.",
  compraCaberNadaTitulo: "Esse ainda não cabe",
  compraCaberNada: (v) => `Para ${v}, não tem atalho que caiba no seu mês de hoje. Vale um plano com calma: juntar uma entrada maior primeiro ou esperar a renda subir.`,
  compraCaminho: (c) => {
    switch (c?.chave) {
      case "parcelar":
        return { titulo: `Parcelar em ${c.vezes}x sem juros`, detalhe: `${c.vezes}x de ${c.porMes}`, comoCompra: `Em ${c.vezes}x de ${c.porMes}, sem juros` };
      case "barato":
        return c.vezes && c.vezes > 1
          ? { titulo: `Procurar um de até ${c.valor}`, detalhe: `Em ${c.vezes}x sem juros, cabe no que sobra`, comoCompra: `Um de até ${c.valor}, em ${c.vezes}x sem juros` }
          : { titulo: `Procurar um de até ${c.valor}`, detalhe: "À vista, cabe no que sobra", comoCompra: `Um de até ${c.valor}, à vista` };
      case "cortar":
        return {
          titulo: `Gastar ${c.valor} a menos`,
          detalhe: `Em ${c.cortes}${c.cortePorMes ? ", por mês" : ", só neste mês"}`,
          comoCompra: `Gastando ${c.valor} a menos${c.cortePorMes ? " por mês" : " neste mês"}`,
        };
      case "desconto":
        return { titulo: "Pedir desconto à vista", detalhe: `Loja costuma dar uns 10%: ${c.valor} em vez de ${c.parcelado} parcelado`, comoCompra: `À vista com desconto, por ${c.valor}` };
      case "juntarRapido":
        return { titulo: `Juntar mais rápido: compra em ${c.mes}`, detalhe: `Gastando ${c.cortes} a menos por mês, à vista`, comoCompra: `Juntando ${c.porMes} por mês` };
      case "juntar":
        return { titulo: `Juntar e comprar em ${c.mes}`, detalhe: `Guardando ${c.porMes} por mês, à vista`, comoCompra: `Juntando ${c.porMes} por mês` };
      default:
        return { titulo: "", detalhe: "", comoCompra: "" };
    }
  },
  compraSeloCabe: "Cabe ✓",
  compraSeloSemDivida: "Sem dívida ✓",
  compraSeloCusto: "Ainda tem custo",
  compraSeguirCom: "Seguir com esse",
  compraEscolhaUm: "Escolha um caminho",
  compraOQueVaiFazer: "Então, o que você vai fazer?",
  compraSugestao: "Sugestão",
  compraDecComprarSub: (precisa) => (precisa ? "Do jeito que pesa menos" : "Do jeito que a gente viu"),
  compraDecGuardar: "Vou guardar primeiro",
  compraDecGuardarSub: "Vira uma meta no app",
  compraDecGuardarMeta: (mensal, mes) => `Meta de ${mensal} por mês, compra em ${mes}`,
  compraDecAmanhaSub: "Se amanhã ainda quiser, volta aqui",
  compraDecDesistir: "Vou desistir",
  compraDecDesistirSub: "Não preciso disso agora",
  compraFimComprarTitulo: "Boa compra.",
  compraFimGuardarTitulo: "Compra planejada.",
  compraFimGuardar: (mensal, meses, mes, corte) =>
    `${mensal} por mês por ${mesesTxt(meses)}${corte ? `, gastando ${corte} a menos` : ""}. Em ${mes} você compra à vista, sem dívida.`,
  compraFimAmanhaTitulo: "Fechado.",
  compraFimDesistirTitulo: "Dinheiro mantido.",
  compraCriarMeta: "Criar a meta",
  compraMetaCriada: "Meta criada.",
  compraVerMeta: "Ver a meta",
};
