/**
 * Regras do convite do par (aprovado pela dona em 11/10/2026, casal-login-proposta.html).
 * Tudo aqui é puro (sem banco), pra ser testado com as datas e os casos de borda que quebram link.
 *
 * - O convite vale 7 dias e serve para qualquer pessoa, com ou sem conta no SPI.
 * - Uso único: aceito, ele não abre mais nada.
 * - A titular pode cancelar; "Mandar de novo" gera outro link e o anterior para de valer.
 * - Um par por vez em cada Nós dois, e cada pessoa em um Nós dois por vez.
 */

export const VALIDADE_DO_CONVITE_DIAS = 7;
export const VALIDADE_DO_CONVITE_MS = VALIDADE_DO_CONVITE_DIAS * 24 * 60 * 60 * 1000;

/** Depois que o Casal da titular para de valer, o par pode baixar a cópia por 90 dias. */
export const DIAS_GUARDADO_SEM_RENOVAR = 90;
export const GUARDADO_SEM_RENOVAR_MS = DIAS_GUARDADO_SEM_RENOVAR * 24 * 60 * 60 * 1000;

/**
 * Versão do texto que o par aceita ao entrar (LGPD: guardar qual texto e quando). Mudou o texto
 * das três frases abaixo, muda a versão.
 */
export const TERMOS_DO_PAR_VERSAO = "par-2026-10-11";

/** As três frases dos termos, na tela de entrada (protótipo c2). `{titular}` e `{par}` são nomes. */
export function frasesDosTermos(titular: string, par: string): string[] {
  return [`${titular} vê o que for nosso e o que for do ${par}`, "O que for só meu, só eu vejo", "Se eu sair, levo uma cópia do que lancei"];
}

export type StatusGravado = "aberto" | "aceito" | "cancelado" | "substituido";
export type EstadoDoConvite = StatusGravado | "vencido";

export function ehStatusGravado(v: unknown): v is StatusGravado {
  return v === "aberto" || v === "aceito" || v === "cancelado" || v === "substituido";
}

/** Vencido não é gravado: é um "aberto" cujo prazo passou. Exatamente no instante do prazo, já venceu. */
export function estadoDoConvite(c: { status: string; expiraEm: Date }, agora: Date): EstadoDoConvite {
  const status = ehStatusGravado(c.status) ? c.status : "cancelado";
  if (status !== "aberto") return status;
  return c.expiraEm.getTime() <= agora.getTime() ? "vencido" : "aberto";
}

export function prazoDoConvite(criadoEm: Date): Date {
  return new Date(criadoEm.getTime() + VALIDADE_DO_CONVITE_MS);
}

/** Dias inteiros que faltam, arredondando pra cima ("vale 7 dias" logo depois de criar, "1 dia" no último). */
export function diasRestantes(expiraEm: Date, agora: Date): number {
  const ms = expiraEm.getTime() - agora.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Qual tela o link mostra. A ordem importa: primeiro o que é do próprio convite (não existe,
 * cancelado, trocado, vencido, usado), depois o que é do Nós dois (o Casal parou de valer, já tem
 * par) e por último o que é de quem abriu (é a titular, já é par aqui ou em outro casal, está
 * logada com outra conta).
 */
export type TelaDoConvite =
  | "invalido"
  | "cancelado"
  | "substituido"
  | "vencido"
  | "usado"
  | "ja-esta-aqui"
  | "casal-inativo"
  | "ja-tem-par"
  | "e-a-titular"
  | "em-outro-casal"
  | "entrar"
  | "aceitar-logado";

export type DadosDaTela = {
  convite: { status: string; expiraEm: Date; userId: string; profileId: string; aceitoPorId: string | null } | null;
  agora: Date;
  /** O Casal da titular vale (acesso ao app e o adicional do parceiro). */
  casalValendo: boolean;
  /** Quem já é o par ativo deste Nós dois, se houver. */
  parAtivoDoPerfil: string | null;
  /** Quem abriu o link: nulo = sem login. */
  visitante: { userId: string; casalAtivoProfileId: string | null } | null;
};

export function decidirTela(d: DadosDaTela): TelaDoConvite {
  const c = d.convite;
  if (!c) return "invalido";
  const estado = estadoDoConvite(c, d.agora);
  const v = d.visitante;
  // Quem já entrou por este convite e abre o link de novo (do histórico do WhatsApp) vai direto.
  if (v && v.casalAtivoProfileId === c.profileId && (estado === "aceito" || d.parAtivoDoPerfil === v.userId)) return "ja-esta-aqui";
  if (estado === "cancelado") return "cancelado";
  if (estado === "substituido") return "substituido";
  if (estado === "vencido") return "vencido";
  if (estado === "aceito") return "usado";
  if (!d.casalValendo) return "casal-inativo";
  if (d.parAtivoDoPerfil) return "ja-tem-par";
  if (!v) return "entrar";
  if (v.userId === c.userId) return "e-a-titular";
  if (v.casalAtivoProfileId) return "em-outro-casal";
  return "aceitar-logado";
}

/** As telas em que dá pra entrar no Nós dois (criar o login, entrar com a conta, ou aceitar logada). */
export function telaDeixaAceitar(t: TelaDoConvite): boolean {
  return t === "entrar" || t === "aceitar-logado";
}

/**
 * A letra do par no casal ("A" ou "B", a mesma de MonthlyEntry.pessoa). Se a titular já escreveu
 * o nome dele numa das duas pessoas da configuração, é essa; senão o par é o "B" (a titular
 * costuma ser a primeira, e o formulário de lançamento começa no "A").
 */
export function letraDoPar(config: { nomeA: string; nomeB: string }, nomePar: string): "A" | "B" {
  const n = (s: string) => s.trim().toLocaleLowerCase("pt-BR");
  if (n(nomePar) && n(config.nomeA) === n(nomePar) && n(config.nomeB) !== n(nomePar)) return "A";
  return "B";
}

export function outraLetra(l: "A" | "B"): "A" | "B" {
  return l === "A" ? "B" : "A";
}

/** Nome do par como foi digitado: sem espaço sobrando, até 30 letras. Vazio não vale. */
export function limparNomeDoPar(bruto: unknown): string {
  return typeof bruto === "string" ? bruto.replace(/\s+/g, " ").trim().slice(0, 30) : "";
}

export function primeiroNome(nome: string | null | undefined, reserva = ""): string {
  const p = (nome ?? "").trim().split(/\s+/)[0];
  return p || reserva;
}

export type CanalDoConvite = "whatsapp" | "email" | "copiar";
export function ehCanal(v: unknown): v is CanalDoConvite {
  return v === "whatsapp" || v === "email" || v === "copiar";
}

/** A mensagem que vai junto do link (WhatsApp e e-mail). Sem travessão, na voz da titular. */
export function mensagemDoConvite(nomePar: string, link: string): string {
  const oi = nomePar ? `Oi, ${nomePar}!` : "Oi!";
  return `${oi} Te convidei para o Nós dois no SPI Finance, para a gente cuidar do dinheiro da casa junto. É grátis para você. O link vale 7 dias: ${link}`;
}
