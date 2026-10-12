import { Mail } from "lucide-react";
import { ASSUNTO_IMPORTACAO, linkDoSuporte, mensagemDeErroDeImportacao } from "@/lib/support/whatsapp-link";

/**
 * O botão que resolve o problema da pessoa na hora em que ele acontece.
 *
 * Antes, a tela de erro MANDAVA a pessoa "falar com o suporte" e não dava caminho nenhum — ela
 * teria que sair da importação, achar o menu e começar a explicar do zero. Sete pessoas pediram
 * reembolso sem nunca ter falado com a Dani; este botão é a diferença entre desistir e resolver.
 * Abre o e-mail do atendimento (06/10/2026; antes era o WhatsApp) com o arquivo e o erro escritos.
 */
export function FalarComSuporte({
  arquivo,
  problema,
  rotulo = "Me ajuda com isso",
  discreto = false,
}: {
  arquivo?: string | null;
  problema?: string | null;
  rotulo?: string;
  /** Link pequeno e neutro, sem cara de botão (a revisão da importação, 12/10/2026). */
  discreto?: boolean;
}) {
  const href = linkDoSuporte(mensagemDeErroDeImportacao({ arquivo, problema }), ASSUNTO_IMPORTACAO);
  return (
    <a
      href={href}
      className={
        discreto
          ? "inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
          : "inline-flex w-fit items-center gap-2 rounded-full bg-accent-gradient px-4 py-2 text-sm font-semibold text-on-accent shadow-premium-sm transition-opacity hover:opacity-95"
      }
    >
      {!discreto && <Mail size={16} strokeWidth={2} />}
      {rotulo}
    </a>
  );
}
