"use client";

import { useEffect, useMemo, useState } from "react";
import { PerguntasDoCasal } from "@/components/casa/PerguntasDoCasal";
import { casalNoDigitarAction } from "@/app/(app)/mensal/[year]/[month]/casa-actions";
import { ehDaCasa, type CasaNaTela } from "@/lib/casa/regras";
import { DIVISAO_PADRAO, escolhasNoFormulario, type ComoDivide, type DeQuem, type DivisaoDaCasa, type Escolhas } from "@/lib/casa/escolhas";

/** O que a voz já disse ("Lucas pagou, metade cada"): marca as perguntas no lugar do padrão. */
export type CasalDaFala = { deQuem?: DeQuem; pagouOPar?: boolean; divide?: ComoDivide };

/**
 * O bloco do Casal simples dentro do Digitar (versão A, 15/10/2026). Fica num componente só para o
 * Digitar continuar fácil de juntar com o que outros ramos põem nele. Os campos vão no formulário
 * "digitar-mais" (o Digitar já junta tudo dele no Salvar), por inputs escondidos com form=.
 *
 * O padrão: "De quem é?" pela loja (o que ela ensinou, ou o automático: Moradia e mercado);
 * "Quem pagou?" Eu; "Como divide?" a regra da casa.
 */
export function CasalNoDigitar({
  casa,
  ano,
  mes,
  valor,
  categoria,
  descricao,
  money,
  daFala,
}: {
  casa: CasaNaTela;
  ano: number;
  mes: number;
  valor: number;
  /** A categoria escolhida: a padrão (MORADIA) ou o id de uma criada. */
  categoria: string | null;
  descricao: string;
  money: (v: number) => string;
  daFala?: CasalDaFala;
}) {
  const [divisao, setDivisao] = useState<DivisaoDaCasa>(DIVISAO_PADRAO);
  const [regras, setRegras] = useState<Map<string, boolean>>(() => new Map());
  useEffect(() => {
    let vivo = true;
    casalNoDigitarAction(ano, mes)
      .then((r) => {
        if (!vivo || !r) return;
        setDivisao(r.divisao);
        setRegras(new Map(r.regras));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [ano, mes]);

  // "Da casa" pela loja, enquanto ela não tocar em "De quem é?" (ou a voz não disser).
  const pelaLoja = useMemo(
    () =>
      ehDaCasa(
        {
          category: "EXPENSE",
          parentCategory: categoria && /^[A-Z_]+$/.test(categoria) ? categoria : null,
          subcategory: null,
          description: descricao || null,
          doCasal: null,
          soMeu: false,
        },
        regras,
      ),
    [categoria, descricao, regras],
  );
  const [escolhido, setEscolhido] = useState<Partial<Escolhas>>(() => ({
    ...(daFala?.deQuem ? { deQuem: daFala.deQuem } : {}),
    ...(daFala?.pagouOPar !== undefined ? { pagouOPar: daFala.pagouOPar } : {}),
    ...(daFala?.divide ? { divide: daFala.divide } : {}),
  }));
  const escolhas: Escolhas = {
    deQuem: escolhido.deQuem ?? (pelaLoja ? "casa" : "meu"),
    pagouOPar: escolhido.pagouOPar ?? false,
    divide: escolhido.divide ?? divisao.modo,
    parte: escolhido.parte ?? 50,
  };
  const campos = escolhasNoFormulario(escolhas, divisao.modo);

  return (
    <div data-casal-no-digitar>
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" form="digitar-mais" name={k} value={v} />
      ))}
      <PerguntasDoCasal
        casa={casa}
        escolhas={escolhas}
        aoMudar={(e) =>
          setEscolhido((antes) => ({
            ...antes,
            ...(e.deQuem !== escolhas.deQuem ? { deQuem: e.deQuem } : {}),
            ...(e.pagouOPar !== escolhas.pagouOPar ? { pagouOPar: e.pagouOPar } : {}),
            ...(e.divide !== escolhas.divide ? { divide: e.divide } : {}),
            ...(e.parte !== escolhas.parte ? { parte: e.parte } : {}),
          }))
        }
        divisao={divisao}
        valor={valor}
        money={money}
        pelaLoja={!escolhido.deQuem && pelaLoja}
      />
    </div>
  );
}
