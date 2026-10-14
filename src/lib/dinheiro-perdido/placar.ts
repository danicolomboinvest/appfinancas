import type { Achado, TipoDeAchado, TipoDeTarifa } from "./detectar";

/**
 * O que a pessoa decide em cada carta, o que soma no "Até agora" e a mensagem de estorno pronta.
 * Puro, sem banco e sem tela: o servidor e a tela usam as mesmas regras.
 */

export type EstadoDoAchado = "aberto" | "uso" | "nao_uso" | "pedi_estorno" | "estornado" | "descartado";
export const ESTADOS: readonly EstadoDoAchado[] = ["aberto", "uso", "nao_uso", "pedi_estorno", "estornado", "descartado"];

/** Uma decisão guardada: a fotografia dos valores e a escolha. */
export type Decidido = { mensal: number | null; unico: number | null; estado: EstadoDoAchado };

/**
 * "Até agora" (pedido da Dani, 12/10): o que já foi recuperado. Soma o que ela marcou como "não
 * uso" (ou "vou rever", "quero rever": a mesma escolha, cortar) pelo valor do mês, e o estorno que
 * caiu pelo valor de uma vez. Pedido de estorno ainda sem resposta não soma.
 */
export function ateAgora(decididos: Decidido[]): { porMes: number; porAno: number; deUmaVez: number; quantos: number } {
  let porMes = 0;
  let deUmaVez = 0;
  let quantos = 0;
  for (const d of decididos) {
    if (d.estado === "nao_uso" && d.mensal) {
      porMes += d.mensal;
      quantos += 1;
    } else if (d.estado === "estornado") {
      const v = d.unico ?? d.mensal ?? 0;
      if (v > 0) {
        deUmaVez += v;
        quantos += 1;
      }
    }
  }
  porMes = Math.round(porMes * 100) / 100;
  deUmaVez = Math.round(deUmaVez * 100) / 100;
  return { porMes, porAno: Math.round((porMes * 12 + deUmaVez) * 100) / 100, deUmaVez, quantos };
}

/** Quanto falta para o SPI se pagar, e quantas vezes ele já se pagou. */
export function contraOPreco(porAno: number, preco: number): { pagou: boolean; vezes: number; falta: number } {
  if (!(preco > 0)) return { pagou: false, vezes: 0, falta: 0 };
  const vezes = Math.floor(porAno / preco);
  return { pagou: porAno >= preco, vezes, falta: Math.max(0, Math.round((preco - porAno) * 100) / 100) };
}

/** As duas escolhas de cada carta (protótipo B): a da esquerda corta, a da direita deixa como está. */
export type Escolhas = { sim: string; nao: string; estadoSim: EstadoDoAchado; estadoNao: EstadoDoAchado; abreEstorno: boolean };

/**
 * IOF e juros não são tarifa (13/10/2026, pedido da Dani): o IOF da compra internacional é imposto
 * e não tem estorno; os juros e a multa vêm de atraso ou do parcelamento da fatura. A carta mostra
 * o nome certo, explica, e não abre mensagem de estorno nem soma no "Até agora".
 */
export function ehImpostoOuJuros(a: Pick<Achado, "tipo" | "tarifa">): boolean {
  return a.tipo === "tarifa" && (a.tarifa === "iof" || a.tarifa === "juros");
}

export function escolhasDaCarta(a: Pick<Achado, "tipo" | "tarifa" | "mensal" | "unico">): Escolhas {
  // "Vou evitar" fica guardado como descartado: não é dinheiro que volta, então não soma.
  if (ehImpostoOuJuros(a)) return { sim: "Vou evitar", nao: "Tudo bem", estadoSim: "descartado", estadoNao: "uso", abreEstorno: false };
  if (a.tipo === "repetida") return { sim: "Pedir estorno", nao: "Foram 2 pedidos", estadoSim: "pedi_estorno", estadoNao: "descartado", abreEstorno: true };
  if (a.tipo === "aumento") return { sim: "Vou rever", nao: "Tudo bem", estadoSim: "nao_uso", estadoNao: "uso", abreEstorno: false };
  if (a.tipo === "tarifa") {
    // Tarifa de uma vez: só o estorno traz de volta.
    if (!a.mensal) return { sim: "Pedir estorno", nao: "Está certo", estadoSim: "pedi_estorno", estadoNao: "uso", abreEstorno: true };
    if (a.tarifa === "seguro") return { sim: "Não lembro", nao: "Contratei", estadoSim: "nao_uso", estadoNao: "uso", abreEstorno: true };
    return { sim: "Quero rever", nao: "Está certo", estadoSim: "nao_uso", estadoNao: "uso", abreEstorno: true };
  }
  return { sim: "Não uso", nao: "Uso", estadoSim: "nao_uso", estadoNao: "uso", abreEstorno: false };
}

/** Quanto a escolha "sim" põe no "para recuperar" (por ano): o mês × 12, ou o de uma vez. IOF e juros, nada. */
export function valorDoSim(a: Pick<Achado, "tipo" | "tarifa" | "mensal" | "unico">): number {
  if (ehImpostoOuJuros(a)) return 0;
  return a.mensal ? a.mensal * 12 : (a.unico ?? 0);
}

export const ROTULO_DO_TIPO: Record<TipoDeAchado, string> = {
  assinatura: "Assinatura",
  repetida: "Cobrança repetida",
  tarifa: "Cobranças do banco",
  aumento: "Aumentou",
};

export function rotuloDaCarta(a: Pick<Achado, "tipo" | "tarifa">): string {
  if (a.tipo === "tarifa") return a.tarifa === "seguro" ? "Seguro escondido" : a.tarifa === "iof" ? "IOF" : a.tarifa === "juros" ? "Juros e multa" : "Tarifa escondida";
  if (a.tipo === "assinatura") return "Assinatura esquecida";
  return ROTULO_DO_TIPO[a.tipo];
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** O porquê da carta, numa linha. Sempre "vale conferir", nunca "indevida". */
export function porqueDaCarta(a: Pick<Achado, "tipo" | "tarifa" | "dia" | "meses" | "datas" | "antes" | "agora" | "mensal">, money: (v: number) => string): string {
  if (a.tipo === "repetida" && a.datas && a.datas.length >= 2) {
    const dias = Math.round(Math.abs(Date.parse(a.datas[1]) - Date.parse(a.datas[0])) / 86_400_000);
    const quando = dias === 0 ? "no mesmo dia" : dias === 1 ? "um dia depois" : `${dias} dias depois`;
    return `Mesmo valor, ${quando}. Vale conferir.`;
  }
  if (a.tipo === "aumento" && a.antes && a.agora) return `Era ${money(a.antes)}. Agora é ${money(a.agora)}.`;
  if (a.tipo === "tarifa") {
    if (a.tarifa === "seguro") return "Lembra de ter contratado? Se não, vale pedir o comprovante.";
    if (a.tarifa === "pacote") return "Existe conta só com serviços essenciais, sem tarifa. Vale perguntar.";
    if (a.tarifa === "anuidade") return "Muitos cartões tiram a anuidade se você pedir. Vale tentar.";
    if (a.tarifa === "iof") return "É imposto da compra em outra moeda. Não tem estorno.";
    if (a.tarifa === "juros") return "Vem de atraso ou de parcelar a fatura. Pagar em dia evita.";
    return "Cobrança do banco. Vale conferir se faz sentido.";
  }
  const dia = a.dia ? `Todo dia ${a.dia}` : "Todo mês";
  return a.meses > 1 ? `${dia}, há ${a.meses} meses.` : `${dia}.`;
}

/** A linha pequena embaixo do valor grande. */
export function subDaCarta(a: Pick<Achado, "tipo" | "mensal" | "unico" | "datas">, money: (v: number) => string): string {
  if (!a.mensal) {
    const datas = a.datas && a.datas.length > 0 ? `, ${a.datas.map(dm).join(" e ")}` : "";
    return `uma vez${datas}`;
  }
  if (a.tipo === "aumento") return `no ano · +${money(a.mensal)} por mês`;
  return `no ano · ${money(a.mensal)} por mês`;
}

const TARIFA_NA_FRASE: Record<TipoDeTarifa, string> = {
  pacote: "a tarifa de pacote de serviços",
  anuidade: "a anuidade do cartão",
  seguro: "um seguro",
  iof: "uma cobrança de IOF",
  juros: "uma cobrança de juros e multa",
};

/**
 * A mensagem pronta para o SAC (protótipo B). Em primeira pessoa, educada, sem acusar: "podem
 * verificar e, se for o caso, estornar".
 */
export function mensagemDeEstorno(
  a: Pick<Achado, "tipo" | "tarifa" | "quem" | "mensal" | "unico" | "datas" | "valorDaCobranca" | "nome">,
  money: (v: number) => string,
): string {
  const abre = "Olá, tudo bem?";
  const fecha = "Agradeço desde já.";
  if (a.tipo === "repetida") {
    const valor = money(a.valorDaCobranca ?? a.unico ?? 0);
    const dias = a.datas && a.datas.length >= 2 ? ` nos dias ${dm(a.datas[0])} e ${dm(a.datas[1])}` : "";
    return `${abre} Conferindo meu extrato, vi duas cobranças iguais de ${a.quem}, de ${valor},${dias}. Fiz só uma compra. Podem verificar e, se for o caso, estornar a segunda? ${fecha}`;
  }
  if (a.tipo === "tarifa") {
    const oQue = TARIFA_NA_FRASE[a.tarifa ?? "pacote"];
    if (a.tarifa === "pacote")
      return `${abre} Vi no meu extrato ${oQue}, de ${money(a.mensal ?? a.unico ?? 0)} por mês. Quero passar para os serviços essenciais, que não têm tarifa. Podem me ajudar com isso? ${fecha}`;
    if (a.tarifa === "anuidade")
      return `${abre} Vi no meu extrato ${oQue}, de ${money(a.mensal ?? a.unico ?? 0)}. Gostaria de pedir a isenção da anuidade. Podem verificar? ${fecha}`;
    if (a.tarifa === "seguro")
      return `${abre} Vi no meu extrato ${oQue}, de ${money(a.mensal ?? a.unico ?? 0)}${a.mensal ? " por mês" : ""}, e não me lembro de ter contratado. Podem me enviar o comprovante da contratação? Se não houver, peço o cancelamento e o estorno do que foi cobrado. ${fecha}`;
    const datas = a.datas && a.datas.length > 0 ? ` em ${a.datas.map(dm).join(" e ")}` : "";
    return `${abre} Vi no meu extrato ${oQue}, de ${money(a.unico ?? a.mensal ?? 0)}${datas}. Podem me explicar a que se refere? Se tiver sido por engano, peço o estorno. ${fecha}`;
  }
  return `${abre} Quero cancelar a assinatura de ${a.quem}. Podem confirmar o cancelamento? ${fecha}`;
}
