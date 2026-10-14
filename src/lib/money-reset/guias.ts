/**
 * Os guias do Money Reset nas telas de verdade (05/10/2026; números dos marcos da versão A+B,
 * 12/10/2026): cada passo diz qual botão acender (um seletor CSS) e o que o balão fala. O guia
 * avança quando ela toca no botão aceso, mesmo que o toque troque de tela (a gaveta do +, as Metas).
 *
 * `rota`: em que tela o passo mora; se ela não está lá, o guia leva (`ir`). Sem `rota`, vale em
 * qualquer tela (o "+" está em todas). O último passo acende o botão e, no toque, o guia sai e
 * deixa ela terminar sozinha (o resto da tela já se explica).
 */

export type PassoDoGuia = {
  alvo: string;
  txt: string;
  dica?: string;
  /** No computador o botão é outro (o "+" do celular vira "Registrar" no menu ao lado). */
  txtComputador?: string;
  rota?: string;
  ir?: string;
  redondo?: boolean;
  /** Se ela não achar o botão, o balão oferece "Abrir para mim". */
  abrir?: "registrar";
};

/**
 * Celular: o "+" redondo no canto de baixo (só na Visão geral). Computador: o botão Registrar do
 * menu. Como o Money Reset não tem o "+", o "Começar, eu te guio" já abre a gaveta e começa no passo
 * seguinte (`comecoDoGuia`); este passo só aparece se alguém retomar o guia em outra tela.
 */
const MAIS: PassoDoGuia = {
  alvo: '[data-tour="registrar"]',
  txt: "Toque no +, no canto de baixo",
  txtComputador: "Clique em {Registrar}, no menu ao lado",
  dica: "É por ele que tudo entra no app.",
  redondo: true,
  abrir: "registrar",
};
const IMPORTAR: PassoDoGuia = { alvo: '[data-guia="importar"]', txt: "Toque em {Importar}" };

/**
 * O botão de "Nova meta" nas Metas. Enquanto a tela de Metas não marca o botão com
 * data-guia="nova-meta", vale o cartão "Nova meta" do pé da lista: o único botão que abre a folha
 * da meta sem nome (os de editar levam o nome da meta no aria-label).
 */
const NOVA_META = '[data-guia="nova-meta"], main button[aria-haspopup="dialog"]:not([aria-label])';

/** Por número do marco (1 a 21). */
export const GUIAS: Record<number, PassoDoGuia[]> = {
  // O tipo (extrato ou fatura) o app reconhece sozinho no arquivo: não tem mais botão para escolher.
  1: [
    MAIS,
    IMPORTAR,
    { alvo: '[data-guia="escolher-arquivo"]', txt: "Agora toque aqui e escolha o extrato", dica: "Pode ser um arquivo com os 3 meses. Depois volte ao Money Reset para ver o seu retrato." },
  ],
  2: [
    MAIS,
    IMPORTAR,
    { alvo: '[data-guia="escolher-arquivo"]', txt: "Toque aqui e escolha a fatura", dica: "É o PDF que o banco manda no e-mail. O app reconhece que é fatura; confira o mês em que ela vence." },
  ],
  6: [MAIS, { alvo: '[data-guia="gravar-audio"]', txt: "Toque em {GravarAudio}", dica: "Fale: \"pão, 12 reais, dinheiro\". Confira e salve." }],
  8: [
    { alvo: '[data-guia="orc-editar"]', rota: "/orcamento", ir: "/orcamento", txt: "Toque para montar o {orcamento}" },
    // O texto vem do botão aceso (data-guia-txt): sem plano é "Dividir", com plano é "Ajustar as categorias".
    // O assistente tem dois "Continuar" antes da divisão (a renda e quanto guardar), no mesmo
    // botão: um passo para cada, senão o balão pede o Sugerir enquanto a tela ainda pergunta o guardar.
    { alvo: '[data-guia="orc-ir-divisao"]', rota: "/orcamento", txt: "Toque para ir à divisão", dica: "É ali que vem a divisão da aula." },
    { alvo: '[data-guia="orc-ir-divisao"]', rota: "/orcamento", txt: "Escolha quanto guardar e toque em Continuar" },
    { alvo: '[data-guia="orc-sugerir"]', rota: "/orcamento", txt: "Toque em {Sugerir}", dica: "Vem a divisão da aula, em reais. Ajuste o que não combina, toque em Ver meu plano e depois em Usar este plano." },
  ],
  // A tela da Reserva saiu do app em 11/10: a reserva agora é a meta do tipo Reserva de emergência.
  10: [
    { alvo: NOVA_META, rota: "/planejamento/metas", ir: "/planejamento/metas", txt: "Toque em {NovaMeta} e escolha Reserva", dica: "Quanto custa: uns 3 meses do que você gasta. Sem prazo também vale." },
  ],
  // Não há {Metas} na barra de baixo do celular: o guia leva direto e acende o botão de criar.
  11: [
    { alvo: NOVA_META, rota: "/planejamento/metas", ir: "/planejamento/metas", txt: "Toque em {NovaMeta}", dica: "O que é, quanto custa e para quando. Pesou? Mude a data." },
  ],
  // O {PossoComprar} mora dentro de "Mais opções", fechado: um passo para abrir.
  16: [
    MAIS,
    { alvo: 'details:has([data-guia="posso-comprar"]) > summary', txt: "Toque em Mais opções" },
    { alvo: '[data-guia="posso-comprar"]', ir: "/decidir/comprar", txt: "Toque em {PossoComprar}", dica: "Responde de verdade. Se for impulso, {DecidirAmanha}." },
  ],
  18: [
    { alvo: '[data-guia="ritual"]', rota: "/mensal/foco/ritual", ir: "/mensal/foco/ritual", txt: "Passe pelos cartões e tome a decisão da semana", dica: "Segunda, os gastos. Sábado, os limites." },
  ],
};

/**
 * Onde o guia começa quando ela toca em "Começar, eu te guio". O Money Reset não tem o "+" (ele só
 * existe na Visão geral), então o guia que começa por ele já abre a gaveta e acende o passo seguinte.
 */
export function comecoDoGuia(n: number): { passo: number; abrirRegistrar: boolean } {
  const primeiro = GUIAS[n]?.[0];
  return primeiro?.abrir === "registrar" ? { passo: 1, abrirRegistrar: true } : { passo: 0, abrirRegistrar: false };
}
