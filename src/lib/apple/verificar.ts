import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { APP_APPLE_ID, BUNDLE_ID, RAIZ_APPLE_G3 } from "./config";

/**
 * Confere a assinatura criptográfica do que vem da Apple (transação da compra, aviso de
 * renovação/reembolso) com o certificado raiz dela. Sem isso, qualquer um mandaria um JSON
 * dizendo "comprei" e ganharia acesso.
 *
 * Tenta Produção e depois Sandbox: o revisor da Apple compra no Sandbox contra o servidor de
 * produção, e se o app recusar a compra dele, o app é recusado (guideline 2.1).
 */
const raizes = [Buffer.from(RAIZ_APPLE_G3, "base64")];
const verificadores = [
  new SignedDataVerifier(raizes, true, Environment.PRODUCTION, BUNDLE_ID, APP_APPLE_ID),
  new SignedDataVerifier(raizes, true, Environment.SANDBOX, BUNDLE_ID),
];

async function primeiroQuePassa<T>(tentar: (v: SignedDataVerifier) => Promise<T>): Promise<T> {
  let ultimoErro: unknown;
  for (const v of verificadores) {
    try {
      return await tentar(v);
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro;
}

export function verificarTransacao(jws: string): Promise<JWSTransactionDecodedPayload> {
  return primeiroQuePassa((v) => v.verifyAndDecodeTransaction(jws));
}

export function verificarAviso(signedPayload: string): Promise<ResponseBodyV2DecodedPayload> {
  return primeiroQuePassa((v) => v.verifyAndDecodeNotification(signedPayload));
}
