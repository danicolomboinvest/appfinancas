import Link from "next/link";
import { Repeat } from "lucide-react";
import { LINK_VER_DE_NOVO, VIDEOS_COMO_FUNCIONA } from "@/lib/novidades/passos";

/**
 * Os 5 vídeos narrados do Como funciona (aprovados em 11/10/2026), cada um com a capa e o título
 * do index dos vídeos. Os arquivos moram em public/videos (versão leve, ~2 MB cada) e só baixam
 * quando a pessoa toca no play (preload="none").
 *
 * `verDeNovo`: quem já usava o app ganha aqui o "Ver de novo o que mudou". Quem é novo, não.
 */
export function VideosDoComoFunciona({ verDeNovo }: { verDeNovo: boolean }) {
  return (
    <section id="videos" aria-labelledby="videos-titulo" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="videos-titulo" className="titulo-tema px-1 text-lg font-semibold tracking-tight text-ink">
        Os vídeos
      </h2>
      {/* Em pé (9:16), lado a lado: no celular rola de lado, um vídeo e meio à vista. */}
      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        {VIDEOS_COMO_FUNCIONA.map((v) => (
          <figure key={v.arquivo} className="m-0 w-[min(62vw,232px)] shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-surface">
            <video controls playsInline preload="none" poster={v.poster} src={v.src} className="block aspect-[9/16] w-full bg-surface-2 object-cover" />
            <figcaption className="flex flex-col gap-0.5 px-4 py-3">
              <b className="text-[15px] font-semibold text-ink">{v.titulo}</b>
              <span className="text-caption text-ink-muted">{v.sub}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {verDeNovo && (
        <Link href={LINK_VER_DE_NOVO} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 text-[15px] font-medium text-ink hover:bg-surface-hover">
          <Repeat size={16} aria-hidden /> Ver de novo o que mudou
        </Link>
      )}
    </section>
  );
}
