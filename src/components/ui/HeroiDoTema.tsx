/**
 * O herói das telas (06/10/2026): o bloco do número principal. Nos temas de cor ele é pintado
 * (rosa no Girly, marinho no Game…); no Padrão é um cartão com um toque morno do dourado. Sem
 * brilho: a primeira versão tinha um halo da cor da marca no canto, e a Dani achou dourado e
 * brilhante demais. Dentro dele, use `text-heroi-suave` para o secundário e `heroi-veu` para
 * trilhos e chips; a cor do texto já vem daqui.
 */
export function HeroiDoTema({ children, className = "", as: Tag = "section" }: { children: React.ReactNode; className?: string; as?: "section" | "div" }) {
  return (
    <Tag
      className={`rounded-3xl border p-5 ${className}`}
      style={{
        background: "linear-gradient(145deg, var(--color-heroi-de), var(--color-heroi-para))",
        color: "var(--color-heroi-tinta)",
        borderColor: "var(--color-heroi-borda, transparent)",
      }}
    >
      <div className="flex flex-col gap-3">{children}</div>
    </Tag>
  );
}
