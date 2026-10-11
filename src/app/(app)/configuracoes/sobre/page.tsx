import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { BrandMark } from "@/components/brand/BrandMark";
import { Cabecalho } from "../_ajustes/Lista";

export const metadata = { title: "Sobre · SPI Finance" };

const VERSAO = "0.1.0";

/** Sobre (rodadas 25 e 60): o logo Aurora do tema e a versão. */
export default function SobrePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Sobre" sub={`Versão ${VERSAO}.`} />
      <HeroiDoTema>
        <span className="flex items-center gap-3">
          <BrandMark size={52} />
          <b className="text-[17px] font-medium">SPI Finance</b>
        </span>
        <p className="text-[32px] font-light leading-tight">Versão {VERSAO}</p>
        <p className="text-sm text-heroi-suave">Feito para o seu dinheiro andar com calma</p>
      </HeroiDoTema>
    </div>
  );
}
