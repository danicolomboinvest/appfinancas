import { headers } from "next/headers";

/**
 * O app iOS (Capacitor) acrescenta esta marca no user-agent (appendUserAgent em
 * ~/Claude/spi-finance-ios/capacitor.config.json). Dentro dele valem as regras da Apple: nada de
 * mandar comprar fora (guideline 3.1.1), e a assinatura é vendida pela própria Apple.
 */
export const MARCA_DO_APP_IOS = "SPIFinanceApp-iOS";

export function ehAppDaApple(userAgent: string | null | undefined): boolean {
  return (userAgent ?? "").includes(MARCA_DO_APP_IOS);
}

export async function naAppDaApple(): Promise<boolean> {
  return ehAppDaApple((await headers()).get("user-agent"));
}

/** O app Android (Capacitor) marca o user-agent com isto. O Google deixa o app ser "só de consumo"
 * (quem comprou no site entra, nada se compra no app) e permite dizer "assine pelo site", mas sem
 * link nem botão pra compra fora (Política de Pagamentos do Google Play). */
export const MARCA_DO_APP_ANDROID = "SPIFinanceApp-Android";

export function ehAppAndroid(userAgent: string | null | undefined): boolean {
  return (userAgent ?? "").includes(MARCA_DO_APP_ANDROID);
}

export async function noAppAndroid(): Promise<boolean> {
  return ehAppAndroid((await headers()).get("user-agent"));
}
