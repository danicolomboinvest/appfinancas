"use client";

import { upload } from "@vercel/blob/client";
import { ehFalhaDeRede } from "@/lib/erros/rede";
import { UPLOAD_MAX_BYTES, vaiPeloArmazenamento } from "@/lib/import/limites";

/**
 * Envio do arquivo da importação (19/10/2026).
 *
 * 1. O arquivo é lido para a memória ANTES do envio. No celular, o arquivo escolhido muitas vezes
 *    ainda está no Drive/iCloud ou some da pasta de downloads no meio do caminho, e o navegador
 *    derrubava o envio com "Failed to fetch" (20 vezes numa semana, 12 delas no /comecar, a
 *    primeira tela de quem acabou de comprar), e a tela culpava a internet. Agora, se o celular
 *    não entrega o arquivo, a mensagem diz isso.
 * 2. Acima de 4 MB (teto da Vercel) o arquivo vai direto do aparelho para o armazenamento privado
 *    e o servidor busca de lá (src/lib/import/arquivo-grande.ts).
 * 3. Se a conexão cai no meio, tenta mais uma vez sozinho (a leitura não grava nada: repetir é
 *    seguro). No caso de 19/10 a mesma pessoa conseguiu um minuto depois, tentando de novo à mão.
 */

export class ArquivoNaoAbriu extends Error {
  constructor(causa: unknown) {
    super(causa instanceof Error ? `${causa.name}: ${causa.message}` : String(causa));
    this.name = "ArquivoNaoAbriu";
  }
}

export class ArmazenamentoFora extends Error {
  constructor(detalhe: string) {
    super(detalhe);
    this.name = "ArmazenamentoFora";
  }
}

const naMemoria = new WeakMap<File, Promise<File>>();

/** O arquivo inteiro na memória (uma vez por arquivo escolhido). */
export function arquivoNaMemoria(file: File): Promise<File> {
  let pronto = naMemoria.get(file);
  if (!pronto) {
    pronto = file.arrayBuffer().then(
      (bytes) => new File([bytes], file.name, { type: file.type, lastModified: file.lastModified }),
      (err) => {
        naMemoria.delete(file);
        throw new ArquivoNaoAbriu(err);
      },
    );
    naMemoria.set(file, pronto);
  }
  return pronto;
}

let pastaPedida: Promise<string> | null = null;

async function pastaNoArmazenamento(): Promise<string> {
  pastaPedida ??= fetch("/api/importar/envio", { cache: "no-store" })
    .then(async (r) => {
      const corpo = (await r.json().catch(() => null)) as { pasta?: string } | null;
      if (!r.ok || !corpo?.pasta) throw new ArmazenamentoFora(`pasta: ${r.status}`);
      return corpo.pasta;
    })
    .catch((err) => {
      pastaPedida = null;
      throw err;
    });
  return pastaPedida;
}

/** Nome sem acento nem espaço, para o caminho no armazenamento (o nome de verdade vai à parte). */
export function nomeParaOArmazenamento(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return limpo.replace(/^[-.]+/, "") || "arquivo";
}

/**
 * Monta o formulário da leitura: com o arquivo dentro (até 4 MB) ou com o caminho dele no
 * armazenamento (acima disso). `campos` vão como estão (docType, encoding, senha…).
 */
export async function montarEnvio(file: File, campos: Record<string, string>): Promise<FormData> {
  const arquivo = await arquivoNaMemoria(file);
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.set(k, v);
  if (!vaiPeloArmazenamento(arquivo.size)) {
    form.set("file", arquivo);
    return form;
  }
  const pasta = await pastaNoArmazenamento();
  let enviado: { pathname: string };
  try {
    enviado = await upload(pasta + nomeParaOArmazenamento(file.name), arquivo, {
      access: "private",
      handleUploadUrl: "/api/importar/envio",
      contentType: arquivo.type || undefined,
    });
  } catch (err) {
    // Queda de conexão segue como queda (vale a nova tentativa); o resto é do armazenamento.
    if (ehFalhaDeRede(err)) throw err;
    throw new ArmazenamentoFora(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  }
  form.set("blob", enviado.pathname);
  form.set("nomeDoArquivo", file.name);
  return form;
}

/** Tenta de novo uma vez, sozinho, se a conexão caiu no meio. */
export async function comNovaTentativa<T>(fazer: () => Promise<T>, esperaMs = 1500): Promise<T> {
  try {
    return await fazer();
  } catch (err) {
    if (!ehFalhaDeRede(err)) throw err;
    await new Promise((r) => setTimeout(r, esperaMs));
    return fazer();
  }
}

/**
 * O erro que vai para o registro, com o tipo e a faixa de tamanho do arquivo (sem nome nem
 * conteúdo): é o que separa "arquivo grande" de "conexão caiu" na próxima investigação.
 */
export function erroComOArquivo(err: unknown, file: File): Error {
  const base = err instanceof Error ? err : new Error(String(err));
  const tipo = (file.name.match(/\.(\w{2,5})$/)?.[1] ?? "sem-extensao").toLowerCase();
  const faixa = file.size > UPLOAD_MAX_BYTES ? "acima de 4 MB" : "até 4 MB";
  const comDetalhe = new Error(`${base.message} [${tipo}, ${faixa}]`);
  comDetalhe.name = base.name;
  return comDetalhe;
}
