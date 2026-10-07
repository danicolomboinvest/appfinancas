"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useProfileTheme } from "@/components/profiles/ProfileThemeProvider";
import { Card } from "@/components/ui/Card";
import { LinhaDaConta, type ContaSerial } from "@/app/(app)/orcamento/contas/LinhaDaConta";

/** No Foco, no máximo três: o resto está a um toque, no "Ver todas". */
const NO_FOCO = 3;

/**
 * Contas a pagar no Foco (05/10/2026): só quando tem conta atrasada ou vencendo em 7 dias, com o
 * "Paguei" ali mesmo. A tela das contas mora no Orçamento (pedido da Dani); aqui é o lembrete.
 */
export function ContasDoFoco({ contas, atrasadas, hoje }: { contas: ContaSerial[]; atrasadas: number; hoje: string }) {
  const { voz } = useProfileTheme();
  const t = voz.titulos;

  if (contas.length === 0) return null;

  return (
    <Card className="p-5">
      <p className={`text-caption font-semibold ${atrasadas > 0 ? "text-danger" : "text-ink-muted"}`}>{t.contasFocoEy}</p>
      <p className="mt-1 text-body font-semibold text-ink">{t.contasFocoTitulo(atrasadas, contas.length - atrasadas)}</p>
      <ul className="mt-2 divide-y divide-border">
        {contas.slice(0, NO_FOCO).map((c) => (
          <LinhaDaConta key={c.id} conta={c} hoje={hoje} />
        ))}
      </ul>
      <Link href="/orcamento/contas" className="mt-2 inline-flex min-h-11 items-center gap-1 text-caption font-semibold text-accent-strong">
        {contas.length > NO_FOCO ? `${t.contasFocoVerTodas} (${contas.length})` : t.contasFocoVerTodas}
        <ChevronRight size={14} aria-hidden />
      </Link>
    </Card>
  );
}
