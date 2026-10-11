import { HeroiDoTema } from "@/components/ui/HeroiDoTema";
import { Cabecalho } from "../_ajustes/Lista";

export const metadata = { title: "Backup · SPI Finance" };

/** Backup (rodada 25): todo dia, trancado (memória "Backup cifrado do SPI Finance"). */
export default function BackupPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Cabecalho titulo="Backup" />
      <HeroiDoTema>
        <p className="text-[15px] text-heroi-suave">Seus dados</p>
        <p className="titulo-tema text-[28px] leading-tight">Copiados todo dia</p>
        <p className="text-sm text-heroi-suave">Automático e criptografado. Você não precisa fazer nada.</p>
      </HeroiDoTema>
      <p className="px-1 text-sm text-ink-muted">Se algo der errado, o suporte restaura a partir do backup.</p>
    </div>
  );
}
