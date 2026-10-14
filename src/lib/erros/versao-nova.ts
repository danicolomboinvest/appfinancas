import { ehFalhaDeRede } from "./rede";

/**
 * O app foi atualizado enquanto estava aberto (13/10/2026). Entre 17h51 e 18h11, logo depois de
 * publicações seguidas, quem estava com o app aberto tomou ~10 "Failed to find Server Action" no
 * Início e ~11 falhas ao ler arquivo e ao lançar: o aparelho ainda rodava a versão anterior e
 * chamava ações e arquivos que a versão nova já não tinha. Não é erro de ninguém, e tentar de novo
 * na mesma tela falha igual. O que resolve é abrir a versão nova: aqui o app reconhece esse caso,
 * mostra um aviso curto e recarrega sozinho, no máximo uma vez por minuto (sem laço).
 */

export const AVISO_VERSAO_NOVA = "O app foi atualizado. Abrindo a versão nova...";
/** Uma recarga por minuto, no máximo: se a versão nova também falhar, a tela de erro normal aparece. */
export const INTERVALO_MINIMO_MS = 60_000;
/** Conferir a versão no servidor custa um pedido; uma vez a cada 30 s basta. */
export const INTERVALO_CONFERIR_MS = 30_000;
const CHAVE_ULTIMA_RECARGA = "spi-recarga-versao-nova";

export type MotivoVersaoNova = "acao-sumiu" | "pedaco-sumiu" | "arquivo-404" | "versao-diferente";

function textoDoErro(erro: unknown): string {
  if (erro instanceof Error) return `${erro.name} ${erro.message}`;
  if (typeof erro === "string") return erro;
  if (erro && typeof erro === "object" && "message" in erro) return String((erro as { message: unknown }).message);
  return "";
}

/** Só pela mensagem: o erro diz, por si só, que o aparelho está numa versão que já saiu? */
export function erroDeVersaoNova(erro: unknown): MotivoVersaoNova | null {
  const texto = textoDoErro(erro);
  if (!texto) return null;
  // Ação do servidor que a versão nova não tem mais (Next: UnrecognizedActionError, e o texto do servidor).
  if (/UnrecognizedActionError|failed to find server action|server action .{0,80}was not found on the server|older or newer deployment/i.test(texto)) return "acao-sumiu";
  // Pedaço do código (chunk) que o aparelho foi buscar e não existe mais.
  if (/ChunkLoadError|loading (css )?chunk [\w./-]+ failed|failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(texto)) return "pedaco-sumiu";
  // Arquivo do app (_next/static) que voltou 404.
  if (/_next\/static\S*\s.{0,40}\b404\b|\b404\b.{0,80}_next\/static/i.test(texto)) return "arquivo-404";
  return null;
}

/** Versão do aparelho e a do servidor são diferentes? Vazio (rodando local) nunca conta. */
export function versaoMudou(local: string | null | undefined, servidor: string | null | undefined): boolean {
  return !!local && !!servidor && local !== servidor;
}

/** A última recarga foi há mais de um minuto (ou nunca houve)? */
export function podeRecarregar(agora: number, ultimaRecarga: number | null): boolean {
  if (ultimaRecarga === null || !Number.isFinite(ultimaRecarga)) return true;
  // Relógio que voltou no tempo não libera recarga em laço.
  if (ultimaRecarga > agora) return false;
  return agora - ultimaRecarga >= INTERVALO_MINIMO_MS;
}

/** Erro que PODE ser versão nova, mas a mensagem não diz: vale perguntar a versão ao servidor. */
export function valeConferirVersao(erro: unknown): boolean {
  if (ehFalhaDeRede(erro, true)) return true;
  return /an unexpected response was received from the server/i.test(textoDoErro(erro));
}

export type Ambiente = {
  agora: () => number;
  /** Lê/grava a hora da última recarga (sessionStorage). Sem onde guardar, não recarrega: sem isso não há trava contra laço. */
  lerUltimaRecarga: () => number | null;
  gravarUltimaRecarga: (quando: number) => boolean;
  versaoLocal: () => string;
  /** Pergunta ao servidor a versão no ar; null quando não deu para saber. */
  buscarVersaoDoServidor: () => Promise<string | null>;
  /** Status de um arquivo do app (para o 404 de _next/static); null quando não deu para saber. */
  statusDoArquivo: (url: string) => Promise<number | null>;
  online: () => boolean;
  avisarERecarregar: () => void;
};

/**
 * O recarregador, com tudo de fora injetado (para dar teste sem navegador). Devolve true quando
 * vai recarregar: quem chamou pode deixar de mostrar a mensagem de erro.
 */
export function criarRecarregador(amb: Ambiente) {
  const antesDeRecarregar = new Set<() => void>();
  let ultimaConferencia = Number.NEGATIVE_INFINITY;
  let recarregando = false;

  function recarregar(): boolean {
    if (recarregando) return true;
    const agora = amb.agora();
    let ultima: number | null;
    try {
      ultima = amb.lerUltimaRecarga();
    } catch {
      return false;
    }
    if (!podeRecarregar(agora, ultima)) return false;
    if (!amb.gravarUltimaRecarga(agora)) return false;
    recarregando = true;
    for (const fn of antesDeRecarregar) {
      try {
        fn();
      } catch {
        // guardar o rascunho é melhor esforço
      }
    }
    amb.avisarERecarregar();
    return true;
  }

  /** Só pela mensagem, sem pedido nenhum. */
  function seVersaoNova(erro: unknown): boolean {
    return erroDeVersaoNova(erro) ? recarregar() : false;
  }

  /** Pergunta a versão ao servidor (no máximo a cada 30 s) e recarrega se mudou. */
  async function conferirVersao(): Promise<boolean> {
    const local = amb.versaoLocal();
    if (!local || !amb.online()) return false;
    const agora = amb.agora();
    if (agora - ultimaConferencia < INTERVALO_CONFERIR_MS) return false;
    ultimaConferencia = agora;
    let servidor: string | null = null;
    try {
      servidor = await amb.buscarVersaoDoServidor();
    } catch {
      return false;
    }
    return versaoMudou(local, servidor) ? recarregar() : false;
  }

  /** Para qualquer erro: pela mensagem na hora; se só pode ser versão nova, confere no servidor. */
  async function tratar(erro: unknown): Promise<boolean> {
    if (seVersaoNova(erro)) return true;
    if (valeConferirVersao(erro)) return conferirVersao();
    return false;
  }

  /** Um arquivo do app (_next/static) não carregou: se voltou 404, a versão mudou. */
  async function arquivoNaoCarregou(url: string): Promise<boolean> {
    if (!/\/_next\/static\//.test(url) || !amb.online()) return false;
    let status: number | null = null;
    try {
      status = await amb.statusDoArquivo(url);
    } catch {
      return false;
    }
    if (status === 404) return recarregar();
    return false;
  }

  /** Quem tem algo digitado registra aqui como guardar antes da recarga. Devolve o "desregistrar". */
  function aoRecarregar(fn: () => void): () => void {
    antesDeRecarregar.add(fn);
    return () => {
      antesDeRecarregar.delete(fn);
    };
  }

  return { seVersaoNova, conferirVersao, tratar, arquivoNaoCarregou, aoRecarregar };
}

export type Recarregador = ReturnType<typeof criarRecarregador>;

/** Versão deste aparelho, fixada na hora do build (next.config.ts). */
export const VERSAO_DO_APP = process.env.NEXT_PUBLIC_VERSAO_DO_APP ?? "";

function mostrarAviso(): void {
  try {
    const caixa = document.createElement("div");
    caixa.setAttribute("role", "status");
    caixa.textContent = AVISO_VERSAO_NOVA;
    Object.assign(caixa.style, {
      position: "fixed",
      left: "50%",
      top: "calc(env(safe-area-inset-top, 0px) + 16px)",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      maxWidth: "calc(100vw - 32px)",
      padding: "12px 18px",
      borderRadius: "999px",
      background: "#141414",
      color: "#ffffff",
      font: "600 14px/1.4 system-ui, -apple-system, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      textAlign: "center",
    });
    document.body.appendChild(caixa);
  } catch {
    // sem aviso, recarrega do mesmo jeito
  }
}

function ambienteDoNavegador(): Ambiente {
  return {
    agora: () => Date.now(),
    lerUltimaRecarga: () => {
      const v = window.sessionStorage.getItem(CHAVE_ULTIMA_RECARGA);
      return v === null ? null : Number(v);
    },
    gravarUltimaRecarga: (quando) => {
      try {
        window.sessionStorage.setItem(CHAVE_ULTIMA_RECARGA, String(quando));
        return window.sessionStorage.getItem(CHAVE_ULTIMA_RECARGA) === String(quando);
      } catch {
        return false;
      }
    },
    versaoLocal: () => VERSAO_DO_APP,
    buscarVersaoDoServidor: async () => {
      const r = await fetch("/api/versao", { cache: "no-store" });
      if (!r.ok) return null;
      const corpo = (await r.json()) as { versao?: unknown };
      return typeof corpo.versao === "string" ? corpo.versao : null;
    },
    statusDoArquivo: async (url) => (await fetch(url, { method: "HEAD", cache: "no-store" })).status,
    online: () => navigator.onLine !== false,
    avisarERecarregar: () => {
      mostrarAviso();
      window.setTimeout(() => window.location.reload(), 1200);
    },
  };
}

let doNavegador: Recarregador | null = null;
function recarregador(): Recarregador | null {
  if (typeof window === "undefined") return null;
  doNavegador ??= criarRecarregador(ambienteDoNavegador());
  return doNavegador;
}

/**
 * Ponto único para as telas: chame com qualquer erro (o registrarErroNoCliente já chama). Devolve
 * true quando o app vai recarregar para a versão nova. Nunca lança.
 */
export async function tratarErroDeVersao(erro: unknown): Promise<boolean> {
  try {
    return (await recarregador()?.tratar(erro)) ?? false;
  } catch {
    return false;
  }
}

/** Versão síncrona, só pela mensagem: para decidir na hora se mostra a mensagem de erro. */
export function ehVersaoNovaERecarrega(erro: unknown): boolean {
  try {
    return recarregador()?.seVersaoNova(erro) ?? false;
  } catch {
    return false;
  }
}

export function arquivoDoAppNaoCarregou(url: string): void {
  void recarregador()?.arquivoNaoCarregou(url).catch(() => false);
}

/** Registra o que guardar antes da recarga (ex.: o rascunho do lançamento). */
export function aoRecarregarParaVersaoNova(fn: () => void): () => void {
  return recarregador()?.aoRecarregar(fn) ?? (() => {});
}
