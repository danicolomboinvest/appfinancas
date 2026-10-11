import { AbasEmPilulas, type AbaEmPilula } from "@/components/shell/AbasEmPilulas";
import { PaywallCard } from "@/components/shell/PaywallCard";
import { getRequiredSession } from "@/lib/auth/session";
import { hasPremiumAccess } from "@/lib/repositories/allowedEmail.repo";
import { ehEmpresa } from "@/lib/profiles/empresa";

/**
 * As abas da Carteira na versão nova (rodadas 16 e 51): Meus ativos · Proventos · Estratégia ·
 * Oportunidades, em pílulas que deslizam, como na Visão geral. "Por objetivo" saiu: o objetivo
 * fica no detalhe do ativo e na meta. Oportunidades entra "em breve".
 */
const ABAS: AbaEmPilula[] = [
  { href: "/carteira", label: "Meus ativos", rotas: ["/carteira", "/carteira/por-objetivo"] },
  { href: "/carteira/proventos", label: "Proventos" },
  { href: "/carteira/estrategia", label: "Estratégia" },
  { href: "/carteira/oportunidades", label: "Oportunidades" },
];

export default async function CarteiraLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getRequiredSession();
  const premium = await hasPremiumAccess(ctx.userId);

  // Empresa: o caixa e os ativos bastam. Estratégia, proventos e assessoria são de quem monta
  // carteira de investimento pessoal; a Dani não quis esse peso no perfil de negócio.
  return (
    <>
      {!ehEmpresa(ctx.profileKind) && <AbasEmPilulas abas={ABAS} rotulo="Abas da Carteira" />}
      {premium ? children : <PaywallCard feature="Carteira de Investimentos" />}
    </>
  );
}
