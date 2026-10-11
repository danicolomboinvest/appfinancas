/**
 * O número de destaque da versão nova (11/10/2026): grande e leve (40px, peso 300), com o R$ e o
 * sinal pequenos na frente, para o olho ir direto no valor ("R$ 648" vira "R$" miúdo + "648").
 * É o mesmo jeito em todo herói do app: Resumo, Orçamento, Metas, Carteira.
 *
 * Recebe o texto já formatado pelo money() (respeita moeda e valores ocultos).
 */
export const NUMERO_DESTAQUE = "text-[2.5rem] font-light leading-none tracking-[-0.03em] tabular-nums max-[359px]:text-[2.25rem]";

/** Separa o prefixo (sinal, símbolo da moeda) do número: "+R$ 383" vira ["+R$", "383"]. */
export function separarPrefixo(texto: string): [string, string] {
  const i = texto.search(/\d|•/);
  if (i <= 0) return ["", texto];
  return [texto.slice(0, i).trim(), texto.slice(i)];
}

export function PrefixoPequeno({ children }: { children: string }) {
  return <span className="mr-[0.14em] text-[0.48em] font-normal tracking-normal opacity-75">{children}</span>;
}

export function ValorDestaque({ texto, className = NUMERO_DESTAQUE }: { texto: string; className?: string }) {
  const [prefixo, numero] = separarPrefixo(texto);
  return (
    <span className={`inline-flex items-baseline ${className}`}>
      {prefixo && <PrefixoPequeno>{prefixo}</PrefixoPequeno>}
      {numero}
    </span>
  );
}
