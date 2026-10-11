import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth/session";
import { ehEmpresa } from "@/lib/profiles/empresa";
import { chaveDoTema } from "@/lib/profiles/themes";
import { serverMoney } from "@/lib/money-server";
import { PilhaDeDecisoes } from "@/components/decisoes/PilhaDeDecisoes";
import { EsferasDoDecidir } from "@/components/decisoes/Esferas";
import { carregarDecidir } from "./dados";

/**
 * Decidir da versão nova (rodadas 38, 49 e 57): em cima, a pilha "Pra decidir hoje", uma decisão
 * por vez, com os mesmos avisos que o Resumo conta em "Decisões importantes"; embaixo, "Qual é a
 * sua pergunta?" em esferas, cada uma com o dado vivo do motor e a tela que já responde.
 *
 * As calculadoras saíram daqui: têm a tela delas no menu (Calculadoras).
 */
export default async function DecidirPage() {
  // Decidir é da pessoa (regra dos 90% da renda, pequenos gastos): a empresa não tem.
  const ctx = await getRequiredSession();
  if (ehEmpresa(ctx.profileKind)) redirect("/mensal/foco");
  const tema = chaveDoTema(ctx.profileTheme);
  const money = await serverMoney();
  const { pilha, depois, pilulas } = await carregarDecidir(ctx);

  return (
    <div className="flex flex-col gap-7 pt-1">
      <PilhaDeDecisoes pilha={pilha} depois={depois} />
      <EsferasDoDecidir dados={{ ...pilulas, money: (v) => money(v, { round: true }), tema }} />
    </div>
  );
}
