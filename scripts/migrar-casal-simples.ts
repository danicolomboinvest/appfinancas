/**
 * Migração do Nós dois para o Casal simples (aprovado em 13/10/2026, casal-simples-proposta.html).
 *
 *   npx tsx scripts/migrar-casal-simples.ts                      → ENSAIO: só lê e mostra o que faria
 *   npx tsx scripts/migrar-casal-simples.ts --casa=<id>          → ensaio de uma casa só
 *   npx tsx scripts/migrar-casal-simples.ts --aplicar --casa=<id>   → migra (uma casa por vez)
 *   npx tsx scripts/migrar-casal-simples.ts --desfazer --casa=<id>  → volta como estava
 *   --relatorio=<arquivo.json>                                   → grava o relatório também
 *   --levar=<id,id>  /  --levar-repetidos                        → leva também os possíveis repetidos
 *     (por padrão eles ficam no perfil Casal, para não contar duas vezes; o ensaio lista cada um)
 *
 * <id> é o id do vínculo do par (MembroCasal). O ensaio não grava nada em lugar nenhum. Aplicar e
 * desfazer recusam fora do banco local, a menos que venha --banco-de-producao-confirmado (que a
 * dona precisa pedir: nada aqui roda em produção por conta própria).
 *
 * Enquanto a casa não migra, ela continua no Nós dois como sempre: quem decide é a coluna
 * MembroCasal.modelo ("nos-dois" ou "simples"), uma por casa.
 */
import { writeFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";
import { lerConfigCasal } from "../src/lib/casal/acerto";
import { assinaturas, planejarMigracao, type Destino, type PlanoDaMigracao, type RegistroDaMigracao, type RetratoDaCasa } from "../src/lib/casa/migracao";

const args = process.argv.slice(2);
const opcao = (nome: string) => args.find((a) => a.startsWith(`--${nome}=`))?.split("=").slice(1).join("=") ?? null;
const aplicar = args.includes("--aplicar");
const desfazer = args.includes("--desfazer");
const casaPedida = opcao("casa");
const arquivo = opcao("relatorio");
const escolha = { levarRepetidos: args.includes("--levar-repetidos"), levar: (opcao("levar") ?? "").split(",").filter(Boolean) };

const host = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
const local = ["localhost", "127.0.0.1", "::1"].includes(host);
if ((aplicar || desfazer) && !local && !args.includes("--banco-de-producao-confirmado")) {
  console.error(`Recusei: aplicar e desfazer só rodam no banco local (DATABASE_URL aponta para "${host || "nada"}").`);
  process.exit(1);
}
if ((aplicar || desfazer) && !casaPedida) {
  console.error("Aplicar e desfazer são uma casa por vez: passe --casa=<id do vínculo>.");
  process.exit(1);
}

const prisma = new PrismaClient();
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const primeiro = (s: string | null | undefined, reserva: string) => (s ?? "").trim().split(/\s+/)[0] || reserva;

async function pessoalDe(userId: string): Promise<string | null> {
  const p = await prisma.financialProfile.findFirst({ where: { userId, kind: "PESSOAL" }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true } });
  return p?.id ?? null;
}

async function retratar(membroId: string): Promise<RetratoDaCasa & { casalPadraoDaTitular: boolean; parSemComeco: boolean }> {
  const m = await prisma.membroCasal.findUniqueOrThrow({
    where: { id: membroId },
    select: {
      id: true,
      letra: true,
      userId: true,
      profileId: true,
      user: { select: { name: true, email: true, onboardedAt: true } },
      profile: { select: { userId: true, casal: true, isDefault: true, user: { select: { name: true, email: true } } } },
    },
  });
  const config = lerConfigCasal(m.profile.casal);
  const letraPar = m.letra === "A" ? "A" : "B";
  const [pessoalTitular, pessoalPar, linhas, fechamentos, metas, orcamentos, lotes] = await Promise.all([
    pessoalDe(m.profile.userId),
    pessoalDe(m.userId),
    prisma.monthlyEntry.findMany({
      where: { profileId: m.profileId },
      select: {
        id: true, userId: true, pessoa: true, soMeu: true, doCasal: true, category: true, amount: true, year: true, month: true, entryDate: true, description: true, externalId: true,
        goal: { select: { profileId: true } },
        customCategory: { select: { id: true, name: true, profileId: true } },
      },
    }),
    prisma.fechamentoCasal.count({ where: { profileId: m.profileId } }),
    prisma.goal.count({ where: { profileId: m.profileId } }),
    prisma.budget.count({ where: { profileId: m.profileId } }),
    prisma.importBatch.count({ where: { profileId: m.profileId } }),
  ]);
  const meses = [...new Set(linhas.map((l) => `${l.year}-${l.month}`))].map((k) => ({ year: Number(k.split("-")[0]), month: Number(k.split("-")[1]) }));
  const externos = linhas.map((l) => l.externalId).filter((x): x is string => Boolean(x));
  const doDestino = async (userId: string, profileId: string | null) => {
    if (!profileId) return { externos: [] as string[], assinaturas: [] as string[] };
    const [ext, mesmas] = await Promise.all([
      externos.length ? prisma.monthlyEntry.findMany({ where: { userId, profileId, externalId: { in: externos } }, select: { externalId: true } }) : Promise.resolve([]),
      meses.length
        ? prisma.monthlyEntry.findMany({ where: { userId, profileId, OR: meses }, select: { year: true, month: true, entryDate: true, amount: true, description: true, category: true } })
        : Promise.resolve([]),
    ]);
    return {
      externos: ext.map((e) => e.externalId!).filter(Boolean),
      assinaturas: mesmas.flatMap((l) => assinaturas({ ...l, amount: Number(l.amount), entryDate: l.entryDate ? l.entryDate.toISOString().slice(0, 10) : null })),
    };
  };
  const [dt, dp] = await Promise.all([doDestino(m.profile.userId, pessoalTitular), doDestino(m.userId, pessoalPar)]);
  const daConfig = (letra: "A" | "B") => (letra === "A" ? config.nomeA : config.nomeB);
  const nome = (letra: "A" | "B", conta: { name: string | null; email: string }) => (/^Pessoa [12]$/.test(daConfig(letra)) ? primeiro(conta.name, conta.email.split("@")[0]) : daConfig(letra));
  return {
    membroId: m.id,
    casalProfileId: m.profileId,
    titularId: m.profile.userId,
    parId: m.userId,
    letraPar,
    nomes: { titular: nome(letraPar === "A" ? "B" : "A", m.profile.user), par: nome(letraPar, m.user) },
    pessoalTitular,
    pessoalPar,
    lancamentos: linhas.map((l) => ({
      id: l.id,
      userId: l.userId,
      pessoa: l.pessoa,
      soMeu: l.soMeu,
      doCasal: l.doCasal,
      category: l.category,
      amount: Number(l.amount),
      year: l.year,
      month: l.month,
      entryDate: l.entryDate ? l.entryDate.toISOString().slice(0, 10) : null,
      description: l.description,
      externalId: l.externalId,
      metaDoCasal: l.goal?.profileId === m.profileId,
      categoriaPersonalizada: l.customCategory && l.customCategory.profileId === m.profileId ? { id: l.customCategory.id, nome: l.customCategory.name } : null,
    })),
    externosNoDestino: { titular: dt.externos, par: dp.externos },
    assinaturasNoDestino: { titular: dt.assinaturas, par: dp.assinaturas },
    preservados: { acertos: config.acertos, fechamentos, metas, orcamentos, lotes },
    casalPadraoDaTitular: m.profile.isDefault,
    parSemComeco: m.user.onboardedAt === null,
  };
}

function imprimir(r: RetratoDaCasa, p: PlanoDaMigracao) {
  const t = r.nomes.titular;
  const pa = r.nomes.par;
  console.log(`\n== Casa ${r.membroId}: ${t} (titular) e ${pa} (par, letra ${r.letraPar}) ==`);
  console.log(`Lançamentos no Nós dois: ${r.lancamentos.length}`);
  console.log(`  → Pessoal de ${t}${p.criarPessoal.titular ? " (CRIA o Pessoal)" : ""}: ${p.contagem.paraTitular.quantos} (gastos ${reais(p.contagem.paraTitular.gasto)}, entradas ${reais(p.contagem.paraTitular.entrada)})`);
  console.log(`  → Pessoal de ${pa}${p.criarPessoal.par ? " (CRIA o Pessoal)" : ""}: ${p.contagem.paraPar.quantos} (gastos ${reais(p.contagem.paraPar.gasto)}, entradas ${reais(p.contagem.paraPar.entrada)})`);
  console.log(`  Só meu mantido: ${p.contagem.soMeu.titular} de ${t}, ${p.contagem.soMeu.par} de ${pa}`);
  console.log(`  Entram como "Da casa" (no acerto): ${p.contagem.daCasa} · como "Meu" (o par vê, fora do acerto): ${p.contagem.daPessoaForaDoAcerto}`);
  const motivos = p.ficam.reduce<Record<string, number>>((a, f) => ({ ...a, [f.motivo]: (a[f.motivo] ?? 0) + 1 }), {});
  console.log(`  Ficam no perfil Casal: ${p.ficam.length}${p.ficam.length ? ` (${Object.entries(motivos).map(([k, v]) => `${v} ${k}`).join(", ")})` : ""}`);
  if (p.categorias.length) console.log(`  Categorias levadas com o mesmo nome: ${p.categorias.map((c) => `${c.nome} → ${c.destino === "titular" ? t : pa}`).join(", ")}`);
  if (p.possiveisRepetidos.length) {
    const ficam = new Set(p.ficam.filter((f) => f.motivo === "possível repetido").map((f) => f.id));
    console.log(`  ATENÇÃO, ${p.possiveisRepetidos.length} possível(is) repetido(s) (o mesmo valor no mesmo mês, com o mesmo nome ou dia, já no Pessoal). Para não contar duas vezes, ${ficam.size ? "ficam no perfil Casal" : "vão mesmo assim (escolha dela)"}:`);
    for (const x of p.possiveisRepetidos.slice(0, 30)) console.log(`    - ${x.dia} ${x.descricao} ${reais(x.valor)} → ${x.destino === "titular" ? t : pa} ${ficam.has(x.id) ? "(fica)" : "(vai)"}  id ${x.id}`);
    if (ficam.size) console.log(`    Para levar algum: --levar=<id,id>  ·  todos: --levar-repetidos`);
  }
  const pr = p.preservados;
  console.log(`  Preservado no perfil Casal: meses acertados [${pr.acertos.join(", ") || "nenhum"}], ${pr.fechamentos} mês(es) fechado(s) a dois, ${pr.metas} meta(s) a dois, ${pr.orcamentos} linha(s) de orçamento, ${pr.lotes} lote(s) de importação`);
}

async function aplicarCasa(r: Awaited<ReturnType<typeof retratar>>, p: PlanoDaMigracao) {
  const agora = new Date();
  await prisma.$transaction(
    async (tx) => {
      const vinculo = await tx.membroCasal.findUniqueOrThrow({ where: { id: r.membroId }, select: { modelo: true, saiuEm: true } });
      if (vinculo.modelo !== "nos-dois" || vinculo.saiuEm) throw new Error("Esta casa não está ativa no Nós dois (já migrou ou o par saiu).");
      const perfisCriados: string[] = [];
      const pessoal: Record<Destino, string> = { titular: r.pessoalTitular ?? "", par: r.pessoalPar ?? "" };
      const dono: Record<Destino, string> = { titular: r.titularId, par: r.parId };
      for (const d of ["titular", "par"] as const) {
        if (pessoal[d]) continue;
        const temPadrao = await tx.financialProfile.findFirst({ where: { userId: dono[d], isDefault: true }, select: { id: true } });
        const novo = await tx.financialProfile.create({ data: { userId: dono[d], name: "Pessoal", kind: "PESSOAL", icon: "wallet", theme: "padrao", isDefault: !temPadrao }, select: { id: true } });
        pessoal[d] = novo.id;
        perfisCriados.push(novo.id);
      }
      // Categorias personalizadas do Casal: a de mesmo nome no Pessoal de destino, ou uma nova.
      const categoriasCriadas: string[] = [];
      const mapa = new Map<string, string>();
      for (const c of p.categorias) {
        const existente = await tx.customCategory.findFirst({ where: { userId: dono[c.destino], profileId: pessoal[c.destino], name: c.nome }, select: { id: true } });
        if (existente) {
          mapa.set(`${c.destino}|${c.deId}`, existente.id);
          continue;
        }
        const origem = await tx.customCategory.findUnique({ where: { id: c.deId }, select: { icon: true } });
        const nova = await tx.customCategory.create({ data: { userId: dono[c.destino], profileId: pessoal[c.destino], name: c.nome, icon: origem?.icon ?? "tag" }, select: { id: true } });
        categoriasCriadas.push(nova.id);
        mapa.set(`${c.destino}|${c.deId}`, nova.id);
      }
      const originais = new Map(
        (await tx.monthlyEntry.findMany({ where: { id: { in: p.movimentos.map((x) => x.id) } }, select: { id: true, userId: true, profileId: true, customCategoryId: true, doCasal: true } })).map((l) => [l.id, l]),
      );
      // Agrupado por destino e categoria: poucas gravações, todas presas ao perfil Casal de origem.
      const grupos = new Map<string, { destino: Destino; categoria: string | null; doCasal: boolean | null; ids: string[] }>();
      for (const mv of p.movimentos) {
        const categoria = mv.categoriaPersonalizada ? (mapa.get(`${mv.destino}|${mv.categoriaPersonalizada.id}`) ?? null) : null;
        const k = `${mv.destino}|${categoria ?? "-"}|${mv.doCasalNovo ?? "-"}`;
        const g = grupos.get(k) ?? { destino: mv.destino, categoria, doCasal: mv.doCasalNovo, ids: [] };
        g.ids.push(mv.id);
        grupos.set(k, g);
      }
      for (const g of grupos.values()) {
        const data: Prisma.MonthlyEntryUncheckedUpdateManyInput = { userId: dono[g.destino], profileId: pessoal[g.destino] };
        if (g.categoria) data.customCategoryId = g.categoria;
        if (g.doCasal !== null) data.doCasal = g.doCasal;
        const feito = await tx.monthlyEntry.updateMany({ where: { id: { in: g.ids }, profileId: r.casalProfileId }, data });
        if (feito.count !== g.ids.length) throw new Error("Algum lançamento mudou durante a migração. Nada foi gravado; rode de novo.");
      }
      let padraoDaTitularAntes: string | null = null;
      if (r.casalPadraoDaTitular) {
        padraoDaTitularAntes = r.casalProfileId;
        await tx.financialProfile.updateMany({ where: { userId: r.titularId }, data: { isDefault: false } });
        await tx.financialProfile.update({ where: { id: pessoal.titular }, data: { isDefault: true } });
      }
      if (r.parSemComeco) await tx.user.update({ where: { id: r.parId }, data: { onboardedAt: agora } });
      const registro: RegistroDaMigracao = {
        versao: 1,
        em: agora.toISOString(),
        lancamentos: p.movimentos.map((mv) => {
          const o = originais.get(mv.id)!;
          return { id: o.id, userId: o.userId, profileId: o.profileId!, customCategoryId: o.customCategoryId, doCasal: o.doCasal };
        }),
        perfisCriados,
        categoriasCriadas,
        padraoDaTitularAntes,
        onboardingDoParMarcado: r.parSemComeco,
      };
      await tx.membroCasal.update({
        where: { id: r.membroId },
        data: { modelo: "simples", perfilTitularId: pessoal.titular, perfilParId: pessoal.par, migradoEm: agora, migracao: registro as unknown as Prisma.InputJsonValue },
      });
    },
    { timeout: 120_000 },
  );
}

async function desfazerCasa(membroId: string) {
  const m = await prisma.membroCasal.findUniqueOrThrow({ where: { id: membroId }, select: { modelo: true, migracao: true, migradoEm: true, perfilTitularId: true, perfilParId: true, userId: true, profileId: true, profile: { select: { userId: true } } } });
  if (m.modelo !== "simples" || !m.migracao) throw new Error("Esta casa não foi migrada por este script.");
  const reg = m.migracao as unknown as RegistroDaMigracao;
  const novosDepois = await prisma.monthlyEntry.count({
    where: { OR: [{ userId: m.profile.userId, profileId: m.perfilTitularId ?? "" }, { userId: m.userId, profileId: m.perfilParId ?? "" }], createdAt: { gt: m.migradoEm ?? new Date(0) } },
  });
  const relatorio = { voltaram: 0, perfisApagados: 0, perfisMantidos: 0, categoriasApagadas: 0, novosDepois };
  await prisma.$transaction(
    async (tx) => {
      for (const l of reg.lancamentos) {
        const r = await tx.monthlyEntry.updateMany({ where: { id: l.id }, data: { userId: l.userId, profileId: l.profileId, customCategoryId: l.customCategoryId, ...(l.doCasal !== undefined ? { doCasal: l.doCasal } : {}) } });
        relatorio.voltaram += r.count;
      }
      for (const id of reg.categoriasCriadas) {
        const usada = await tx.monthlyEntry.count({ where: { customCategoryId: id } });
        const orc = await tx.budget.count({ where: { customCategoryId: id } });
        if (usada + orc === 0) {
          await tx.customCategory.delete({ where: { id } });
          relatorio.categoriasApagadas++;
        }
      }
      if (reg.padraoDaTitularAntes) {
        await tx.financialProfile.updateMany({ where: { userId: m.profile.userId }, data: { isDefault: false } });
        await tx.financialProfile.update({ where: { id: reg.padraoDaTitularAntes }, data: { isDefault: true } });
      }
      for (const id of reg.perfisCriados) {
        const usado = (await tx.monthlyEntry.count({ where: { profileId: id } })) + (await tx.budget.count({ where: { profileId: id } })) + (await tx.goal.count({ where: { profileId: id } })) + (await tx.importBatch.count({ where: { profileId: id } }));
        if (usado === 0) {
          await tx.financialProfile.delete({ where: { id } });
          relatorio.perfisApagados++;
        } else relatorio.perfisMantidos++;
      }
      if (reg.onboardingDoParMarcado) await tx.user.updateMany({ where: { id: m.userId }, data: { onboardedAt: null } });
      await tx.membroCasal.update({ where: { id: membroId }, data: { modelo: "nos-dois", perfilTitularId: null, perfilParId: null, migradoEm: null, migracao: Prisma.DbNull } });
    },
    { timeout: 120_000 },
  );
  return relatorio;
}

async function main() {
  if (desfazer) {
    const r = await desfazerCasa(casaPedida!);
    console.log(`Casa ${casaPedida} voltou para o Nós dois: ${r.voltaram} lançamento(s) de volta ao perfil Casal, ${r.categoriasApagadas} categoria(s) criada(s) apagada(s), ${r.perfisApagados} Pessoal(is) criado(s) apagado(s)${r.perfisMantidos ? `, ${r.perfisMantidos} mantido(s) porque já têm dados novos` : ""}.`);
    if (r.novosDepois) console.log(`ATENÇÃO: ${r.novosDepois} lançamento(s) foram feitos nos Pessoais depois da migração e continuam lá (são de cada um).`);
    return;
  }
  const casas = await prisma.membroCasal.findMany({
    where: { saiuEm: null, modelo: "nos-dois", profile: { kind: "CASAL" }, ...(casaPedida ? { id: casaPedida } : {}) },
    select: { id: true },
    orderBy: { entrouEm: "asc" },
  });
  const jaMigradas = await prisma.membroCasal.count({ where: { saiuEm: null, modelo: "simples" } });
  console.log(`${aplicar ? "APLICANDO" : "ENSAIO (nada é gravado)"} · banco ${host || "?"} · ${casas.length} casa(s) no Nós dois · ${jaMigradas} já no Casal simples`);
  const relatorio: unknown[] = [];
  for (const c of casas) {
    const r = await retratar(c.id);
    const p = planejarMigracao(r, escolha);
    imprimir(r, p);
    relatorio.push({ casa: c.id, nomes: r.nomes, criarPessoal: p.criarPessoal, contagem: p.contagem, ficam: p.ficam, categorias: p.categorias, possiveisRepetidos: p.possiveisRepetidos, preservados: p.preservados });
    if (aplicar) {
      await aplicarCasa(r, p);
      console.log("  FEITO. Para voltar: npx tsx scripts/migrar-casal-simples.ts --desfazer --casa=" + c.id);
    }
  }
  if (arquivo) writeFileSync(arquivo, JSON.stringify({ em: new Date().toISOString(), banco: host, modo: aplicar ? "aplicar" : "ensaio", casas: relatorio }, null, 2));
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
