import { MessageCircle } from "lucide-react";
import { linkDoSuporte, mensagemDeErroDeImportacao } from "@/lib/support/whatsapp-link";

/**
 * O botão que resolve o problema da pessoa na hora em que ele acontece.
 *
 * Antes, a tela de erro MANDAVA a pessoa "falar com o suporte" e não dava caminho nenhum — ela
 * teria que sair da importação, achar o menu e começar a explicar do zero. Sete pessoas pediram
 * reembolso sem nunca ter falado com a Dani; este botão é a diferença entre desistir e resolver.
 *
 * Some quando não há número configurado, em vez de virar um botão morto.
 */
export function FalarComSuporte({
  arquivo,
  problema,
  rotulo = "Me ajuda com isso",
}: {
  arquivo?: string | null;
  problema?: string | null;
  rotulo?: string;
}) {
  const href = linkDoSuporte(mensagemDeErroDeImportacao({ arquivo, problema }));
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-gradient px-4 py-2 text-sm font-semibold text-on-accent shadow-premium-sm transition-opacity hover:opacity-95"
    >
      <MessageCircle size={16} strokeWidth={2} />
      {rotulo}
    </a>
  );
}
