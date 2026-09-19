/**
 * Conversa com o ManyChat, que é onde a Dani já fala com as alunas.
 *
 * Serve pro app conseguir puxar a conversa quando a importação de alguém dá errado, em vez de
 * esperar a pessoa procurar ajuda — foi o que não aconteceu com as sete que pediram reembolso.
 *
 * Duas coisas que moldam todo o desenho, e que valem mais que qualquer código daqui:
 *
 * 1. O WhatsApp só deixa mandar mensagem livre DENTRO DE 24 HORAS do último contato da pessoa.
 *    Fora disso só passa template aprovado. Então o disparo daqui entrega pra quem falou com a
 *    Dani há pouco, e falha pro resto — de propósito, sem fingir que deu certo. Quem não recebe
 *    cai na lista dela no relatório diário.
 * 2. O caminho que SEMPRE funciona é o contrário: a pessoa manda a primeira mensagem (pelo botão
 *    que o app mostra na tela de erro), e aí a janela abre e o fluxo dela responde à vontade.
 *    Por isso o botão é o caminho principal e este disparo é o reforço, não o contrário.
 */

const BASE = "https://api.manychat.com";

export type ManychatResult =
  | { ok: true; subscriberId: string }
  | { ok: false; motivo: "sem-token" | "sem-fluxo" | "nao-encontrado" | "fora-da-janela" | "erro"; detalhe?: string };

export function isManychatConfigured(): boolean {
  return Boolean(process.env.MANYCHAT_API_TOKEN && process.env.MANYCHAT_FLOW_ERRO_IMPORTACAO);
}

async function call(path: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MANYCHAT_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/**
 * Acha a pessoa no ManyChat pelo e-mail.
 *
 * Por e-mail e não por telefone porque a busca por telefone do ManyChat é reconhecidamente
 * furada (devolve sucesso com lista vazia mesmo pra contato que existe) e porque, no WhatsApp,
 * o campo "phone" não é o mesmo que o "WhatsApp ID". E-mail é o que o app tem de confiável:
 * é o mesmo da compra.
 *
 * Quem entrou no ManyChat pelo Instagram pode não ter e-mail nenhum lá — nesse caso não dá
 * match, e a pessoa vai pra lista manual da Dani. Isso é esperado, não é falha.
 */
export async function findSubscriberByEmail(email: string): Promise<string | null> {
  const { status, body } = await call(`/fb/subscriber/findBySystemField?email=${encodeURIComponent(email)}`, {
    method: "GET",
  });
  if (status !== 200) return null;
  const data = (body as { data?: { id?: string | number }[] | { id?: string | number } })?.data;
  const first = Array.isArray(data) ? data[0] : data;
  return first?.id ? String(first.id) : null;
}

/** Dispara o fluxo que a Dani escreveu no ManyChat (o "oi, tudo bem? vi que deu um errinho"). */
export async function sendFlow(subscriberId: string, flowNs: string): Promise<ManychatResult> {
  const { status, body } = await call("/fb/sending/sendFlow", {
    method: "POST",
    body: JSON.stringify({ subscriber_id: subscriberId, flow_ns: flowNs }),
  });
  if (status === 200) return { ok: true, subscriberId };
  const detalhe = typeof body === "object" && body !== null ? JSON.stringify(body).slice(0, 200) : `HTTP ${status}`;
  // Fora da janela de 24h o ManyChat recusa. Não é erro de código: é regra do WhatsApp, e a
  // pessoa precisa ser chamada na mão.
  const foraDaJanela = /24|window|outside|template/i.test(detalhe);
  return { ok: false, motivo: foraDaJanela ? "fora-da-janela" : "erro", detalhe };
}

/**
 * O caminho completo: acha a pessoa pelo e-mail e dispara o fluxo do erro de importação.
 * Nunca lança — quem chama está no meio de um cron e não pode quebrar por causa disto.
 */
export async function avisarErroDeImportacao(email: string): Promise<ManychatResult> {
  const flowNs = process.env.MANYCHAT_FLOW_ERRO_IMPORTACAO;
  if (!process.env.MANYCHAT_API_TOKEN) return { ok: false, motivo: "sem-token" };
  if (!flowNs) return { ok: false, motivo: "sem-fluxo" };
  try {
    const subscriberId = await findSubscriberByEmail(email);
    if (!subscriberId) return { ok: false, motivo: "nao-encontrado" };
    return await sendFlow(subscriberId, flowNs);
  } catch (err) {
    return { ok: false, motivo: "erro", detalhe: err instanceof Error ? err.message.slice(0, 200) : String(err) };
  }
}
