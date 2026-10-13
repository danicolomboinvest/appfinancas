import { padrao } from "./padrao";
import { inteiro, estadoParaFrase, type Voz } from "../voice-base";

/**
 * A voz do Titânio (decisão da dona, 11/10/2026): "mais curta e firme". Exemplo dela:
 * "R$ 648 até domingo. Dá para o mês."
 *
 * Regras: frase curta, o número primeiro, sem gíria, sem apelido, sem emoji, sem exclamação.
 * Cobra pelo número, nunca pela pessoa. O que não está escrito aqui fala como o Padrão.
 * Quem vinha do Disciplina ou do Game cai aqui.
 */
export const titanio: Voz = {
  ...padrao,
  saudacao: (p, nome) => `${p === "manha" ? "Bom dia" : p === "tarde" ? "Boa tarde" : "Boa noite"}${nome ? `, ${nome}` : ""}.`,
  subSaudacao: () => null,
  rotuloResultado: "Sobrou",
  fraseResultado: (estadoBruto, d) => {
    const estado = estadoParaFrase(estadoBruto, d.resultado);
    const v = inteiro(d.money, d.resultado);
    if (estado === "bom") return `${v} de sobra. Mês no lugar.`;
    if (estado === "normal") return `${v} de sobra. Dá para guardar mais.`;
    if (estado === "ruim") return d.mesFechado ? `${v} a menos. Revise o próximo mês.` : `${v} a menos. Ainda dá para ajustar.`;
    return null;
  },
  ritmo: { rapido: "Rápido demais", limite: "No limite", dentro: "No ritmo" },
  tituloOrcamento: (mes) => `Plano de ${mes}`,
  fraseOrcamento: (d) => {
    const { situacao, restante, porDia, diasRestantes, ultimoDia, money } = d;
    if (situacao === "sem-plano") return "Sem plano neste mês. Defina quanto gastar.";
    if (situacao === "estourou") return `${inteiro(money, restante)} acima do plano. Segure o resto do mês.`;
    if (porDia === null || diasRestantes === 0) return `${inteiro(money, restante)} livres no fim do mês.`;
    const base = `${inteiro(money, porDia)} por dia até dia ${ultimoDia}.`;
    if (situacao === "adiantado") return `${base} Está gastando rápido.`;
    if (situacao === "folgado") return `${base} Sobra folga. Guarde a diferença.`;
    return `${base} Dá para o mês.`;
  },
  mesVazio: "Nada lançado neste mês. Registre um gasto ou importe o extrato.",
  metaBatida: (nome) => `${nome}: meta batida.`,
  rodape: () => null,
  titulos: {
    ...padrao.titulos,
    focoLivreSemana: "Livre nesta semana",
    focoLivreMes: "Livre no mês",
    focoRitmoP: (d, s) => `${s} até o fim do mês. ${d === 1 ? "Falta 1 dia" : `Faltam ${d} dias`}.`,
    metaGuardar: (v) => `${v} este mês.`,
  },
};
