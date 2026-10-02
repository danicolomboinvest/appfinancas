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
