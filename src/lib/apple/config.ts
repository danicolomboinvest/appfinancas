import { createHash } from "node:crypto";

/**
 * Assinatura do SPI Finance pela Apple (out/2026). A Apple recusou o app (guideline 3.1.1) porque
 * o acesso comprado fora (Hubla) não podia ser comprado dentro do app. Pela 3.1.3(b), quem
 * comprou fora continua entrando, desde que o mesmo acesso também esteja à venda pela Apple.
 */
export const BUNDLE_ID = "com.danicolombo.spifinance";
export const APP_APPLE_ID = 6810748473;

/** Os ids têm que ser IGUAIS aos cadastrados em App Store Connect > Assinaturas. */
export const PRODUTOS_APPLE = {
  mensal: "com.danicolombo.spifinance.mensal",
  anual: "com.danicolombo.spifinance.anual",
} as const;

export const IDS_DOS_PRODUTOS: readonly string[] = Object.values(PRODUTOS_APPLE);

/**
 * O appAccountToken que o app manda junto da compra: um UUID fixo por e-mail da conta. A Apple
 * devolve ele dentro da transação assinada, e é assim que o servidor confere que a compra foi
 * feita a partir DESTA conta (um recibo copiado de outra pessoa não passa). Vem do e-mail, e não
 * do id, pra quem exclui a conta e cria de novo com o mesmo e-mail não perder a assinatura paga.
 */
export function tokenDaConta(email: string): string {
  const h = createHash("sha256").update(`spi-finance-apple:${email.trim().toLowerCase()}`).digest("hex");
  // Formato de UUID v4 (versão 4, variante RFC 4122), que é o que o StoreKit aceita.
  const variante = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Apple Root CA - G3 (DER em base64), baixado de apple.com/certificateauthority.
 * SHA-256 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79 */
export const RAIZ_APPLE_G3 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";
