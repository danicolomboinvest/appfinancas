import Link from "next/link";
import { cobrancaDosAdicionaisLigada } from "@/lib/casal-login/adicional";
import { redirect } from "next/navigation";
import { CheckCircle2, Users, X } from "lucide-react";
import { getRequiredSession, type AuthContext } from "@/lib/auth/session";
import { ehCasal } from "@/lib/profiles/casal";
import { nowInBrazil } from "@/lib/date/brazil-now";
import { carregarAcertoDoMes, planoDaCasa } from "@/lib/repositories/casal.repo";
import { ReciboDoAcerto } from "@/components/casal-login/ReciboDoAcerto";
import { CombinarDivisao } from "@/components/casal-login/CombinarDivisao";
import { dadosDaDivisao, dadosDoRecibo } from "./dados-da-tela";
import { nosDoisDaTitular } from "@/lib/repositories/casal-login.repo";
import { estadoDoFechamentoDoMes, lancamentosDoMesNoCasal, metasDoCasalLista, meuNoCasal } from "@/lib/repositories/nos-dois.repo";
import { mesParaFechar } from "@/lib/casal-login/fechamento";
import { outraLetra } from "@/lib/casal-login/regras";
import { ChamarOPar } from "@/components/casal-login/ChamarOPar";
import { MeuNoCasal } from "@/components/casal-login/MeuNoCasal";
import { LancamentosDoCasal } from "@/components/casal-login/LancamentosDoCasal";
import { MetasDoCasal } from "@/components/casal-login/MetasDoCasal";
import { CartaoFecharOMes } from "@/components/casal-login/FecharOMes";
import { TelaNosDois } from "@/components/casal-login/TelaNosDois";

/**
 * Nós dois (só existe no perfil Casal). Em cima, o acerto do mês em recibo, calculado pelos
 * lançamentos (quem pagou cada gasto da casa; out/2026). Depois os nomes e a forma de dividir, e
 * por último a calculadora "Quanto cada um contribui?", pra simular com rendas digitadas.
 *
 * Login do par (11/10/2026): a titular sem par vê o convite ("Agora, chame o seu par"); com o
 * convite mandado, o cartão "Aguardando". Com o par dentro, os dois veem o mesmo Nós dois: o
 * acerto, "O meu no casal", fechar o mês a dois, metas a dois e os lançamentos.
 */
export default async function DivisaoPage({ searchParams }: { searchParams: Promise<{ entrou?: string }> }) {
  const ctx = await getRequiredSession();
  if (!ehCasal(ctx.profileKind)) redirect("/dashboard");
  const now = nowInBrazil();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  if (ctx.par) return <NosDoisDoPar ctx={ctx} ano={ano} mes={mes} entrou={(await searchParams).entrou === "1"} />;

  const [acerto, nosDois, plano] = await Promise.all([carregarAcertoDoMes(ctx, ano, mes), nosDoisDaTitular(ctx), planoDaCasa(ctx, ano, mes)]);
  const { convite } = nosDois;
  const nomeTitular = nosDois.par && outraLetra(nosDois.par.letra) === "B" ? acerto.config.nomeB : acerto.config.nomeA;

  if (!nosDois.par) {
    return (
      <div className="flex flex-col gap-6">
        <ChamarOPar
          agoraIso={new Date().toISOString()}
          nomeTitular={nomeTitular}
          casalValendo={nosDois.casalValendo}
          podeLiberar={cobrancaDosAdicionaisLigada()}
          convite={
            convite
              ? { nomePar: convite.nomePar, estado: convite.estado, canal: convite.canal, enviadoEmIso: convite.enviadoEm?.toISOString() ?? null, criadoEmIso: convite.criadoEm.toISOString(), expiraEmIso: convite.expiraEm.toISOString() }
              : null
          }
        />
        <ReciboDoAcerto d={dadosDoRecibo(acerto, "A")} />
        <CombinarDivisao d={dadosDaDivisao(acerto, { letraTitular: "A", souPar: false, plano, mostrarRenda: acerto.config.mostrarRenda === true })} />
      </div>
    );
  }

  const letraPar = nosDois.par.letra;
  const minhaLetra = outraLetra(letraPar);
  return (
    <div className="flex flex-col gap-5">
      <NosDoisADois ctx={ctx} ano={ano} mes={mes} acerto={acerto} minhaLetra={minhaLetra} letraTitular={minhaLetra} souPar={false} plano={plano} />
    </div>
  );
}

/** O Nós dois visto pelo par: só o que é do casal, com o "O meu no casal" e o + dele. */
async function NosDoisDoPar({ ctx, ano, mes, entrou }: { ctx: AuthContext; ano: number; mes: number; entrou: boolean }) {
  const par = ctx.par!;
  const acerto = await carregarAcertoDoMes(ctx, ano, mes);
  const letraTitular = outraLetra(par.letra);
  return (
    <div className="flex flex-col gap-5">
      {entrou && (
        <div className="flex items-center gap-3 rounded-2xl bg-success-soft px-4 py-3 text-[15px] text-success">
          <CheckCircle2 size={18} strokeWidth={1.8} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">Você entrou no Nós dois de {par.nomeTitular}</span>
          <Link href="/divisao" aria-label="Fechar aviso" className="-mr-1 flex size-9 items-center justify-center rounded-full">
            <X size={16} strokeWidth={1.8} aria-hidden />
          </Link>
        </div>
      )}
      <p className="flex items-center gap-2 px-1 text-[14px] text-ink-muted">
        <Users size={16} strokeWidth={1.6} className="shrink-0" aria-hidden />
        Você vê o que é do casal. O pessoal de {par.nomeTitular} não aparece aqui.
      </p>
      <NosDoisADois ctx={ctx} ano={ano} mes={mes} acerto={acerto} minhaLetra={par.letra} letraTitular={letraTitular} souPar plano={await planoDaCasa(ctx, ano, mes)} />
    </div>
  );
}

/** O miolo que os dois veem quando o casal tem os dois logins. */
async function NosDoisADois({
  ctx,
  ano,
  mes,
  acerto,
  minhaLetra,
  letraTitular,
  souPar,
  plano,
}: {
  plano: number | null;
  ctx: AuthContext;
  ano: number;
  mes: number;
  acerto: Awaited<ReturnType<typeof carregarAcertoDoMes>>;
  minhaLetra: "A" | "B";
  letraTitular: "A" | "B";
  souPar: boolean;
}) {
  const anterior = mesParaFechar({ ano, mes });
  const [meu, lancamentos, metas, fechamento, acertoAnterior] = await Promise.all([
    meuNoCasal(ctx, acerto, minhaLetra),
    lancamentosDoMesNoCasal(ctx, ano, mes),
    metasDoCasalLista(ctx),
    estadoDoFechamentoDoMes(ctx, anterior.ano, anterior.mes),
    carregarAcertoDoMes(ctx, anterior.ano, anterior.mes),
  ]);
  const nomes = { A: acerto.config.nomeA, B: acerto.config.nomeB };
  const pessoas = { minha: minhaLetra, titular: letraTitular, nomes };
  const temMesAnterior = acertoAnterior.totalDaCasa > 0;
  const hoje = nowInBrazil();
  return (
    <TelaNosDois
      mes={{
        nomes,
        letraTitular,
        mes,
        dia: hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes ? hoje.getDate() : new Date(ano, mes, 0).getDate(),
        diasNoMes: new Date(ano, mes, 0).getDate(),
        plano,
        totalDaCasa: acerto.totalDaCasa,
        pagou: acerto.pagou,
        parte: acerto.parte,
        contas: acerto.contas.map((c) => ({ chave: c.chave, nome: c.nome, parentCategory: c.parentCategory, valor: c.valor, pagou: c.pagou })),
        lancamentos,
      }}
      acerto={<ReciboDoAcerto d={dadosDoRecibo(acerto, letraTitular)} />}
      fechamento={temMesAnterior ? <CartaoFecharOMes fechamento={fechamento} pessoas={pessoas} mes={anterior.mes} acertado={acertoAnterior.acertado} /> : null}
      orcamento={
        <div className="flex flex-col gap-5">
          <MeuNoCasal dados={meu} meuNome={nomes[minhaLetra]} souPar={souPar} mes={mes} />
          <CombinarDivisao d={dadosDaDivisao(acerto, { letraTitular, souPar, plano, mostrarRenda: acerto.config.mostrarRenda === true })} />
        </div>
      }
      metas={<MetasDoCasal metas={metas} podeCriar />}
      botaoLancar={<LancamentosDoCasal itens={[]} nomes={nomes} letraTitular={letraTitular} minhaLetra={minhaLetra} mes={mes} podeLancar soBotao />}
    />
  );
}
