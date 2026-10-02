import { NextResponse } from "next/server";
import { recusarSeNaoForCron } from "@/lib/cron/autorizacao";
import { getImportHealth } from "@/lib/repositories/import-diagnostic.repo";
import { purgeExpiredImportFiles } from "@/lib/repositories/import-file.repo";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { prisma } from "@/lib/db/prisma";
import { pessoasAAvisar, type PessoaAAvisar } from "@/lib/support/import-outreach";

export const maxDuration = 60;

/**
 * Checagem diária da importação: o que quebrou nas últimas 24 horas, por qual motivo, e quem
 * ficou sem conseguir nada.
 *
 * Existe porque sete pessoas pediram reembolso e não dava pra dizer qual banco falhou — falha
 * de leitura não criava lote nenhum e o log da Vercel apagava em poucos dias. Agora cada
 * tentativa fica registrada (ImportDiagnostic) e este resumo chega por e-mail toda manhã.
 *
 * Só manda e-mail quando tem problema: dia sem falha não vira mensagem (senão vira spam e
 * ninguém lê no dia em que importa).
 *
 * `?days=7` amplia a janela e `?dryRun=1` devolve o relatório sem enviar nada.
 */
export async function GET(request: Request) {
  const recusa = recusarSeNaoForCron(request);
  if (recusa) return recusa;

  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 1), 1), 30);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const health = await getImportHealth(days);
  // Erros de servidor da mesma janela (instrumentation.ts grava agrupado por rota + mensagem).
  const erros = await prisma.appError.findMany({
    where: { ultimoEm: { gte: health.desde } },
    orderBy: { vezes: "desc" },
    take: 15,
    select: { routePath: true, message: true, vezes: true, ultimoEm: true },
  });

  // Quem ficou na mão, pra Dani decidir quem chamar. NÃO manda nada pra cliente: em 29/09/2026
  // ela pediu que nenhuma mensagem saia sem aprovação dela no dia — alarme falso pra quem
  // importou certo é pior que não avisar (a régua de "leu só parte" já errou 10 de 19 num dia).
  // Antes isto disparava o ManyChat sozinho; só não saía nada porque ele não estava configurado.
  const avisos = await pessoasAAvisar();

  // Retenção dos arquivos guardados. Roda ANTES de qualquer saída antecipada: em dia sem falha
  // a função retornava cedo, e aí extrato de cliente ficaria parado no banco além do prazo.
  const arquivosApagados = await purgeExpiredImportFiles();

  const problemas = health.falhas + health.parciais + health.implausiveis + erros.length;
  // Quem está esperando ajuda entra no e-mail mesmo em dia sem falha nova.
  if (problemas === 0 && avisos.length === 0 && !dryRun) {
    return NextResponse.json({ ok: true, ...resumo(health), erros: 0, arquivosApagados, avisos: avisos.length, enviado: false, motivo: "dia sem falha" });
  }

  // `||` e não `??`: o .env.example documenta "padrão: SMTP_USER" e deixa SUPPORT_EMAIL vazia.
  // Com `??`, string vazia conta como valor, então destino virava "" e o raio-X não ia pra
  // ninguém, sem erro e sem log. O resto do projeto já trata vazio como não configurado.
  const destino = process.env.SUPPORT_EMAIL || process.env.SMTP_USER;
  let enviado = false;
  if (!dryRun && destino && isEmailConfigured()) {
    const { subject, html } = relatorioEmail(health, days, erros, avisos);
    const res = await sendEmail({ to: destino, subject, html });
    enviado = res.ok;
  }

  return NextResponse.json({
    ok: true,
    ...resumo(health),
    porCausa: health.porCausa,
    pessoasSemSucesso: health.pessoasSemSucesso,
    pararamNaRevisao: health.pararamNaRevisao,
    errosDeServidor: erros,
    avisos,
    arquivosApagados,
    enviado,
    destino: enviado ? destino : undefined,
  });
}

function resumo(h: Awaited<ReturnType<typeof getImportHealth>>) {
  return {
    desde: h.desde.toISOString(),
    tentativas: h.total,
    falhas: h.falhas,
    leiturasParciais: h.parciais,
    leiturasImplausiveis: h.implausiveis,
    pessoasSemSucesso: h.pessoasSemSucesso.length,
    pararamNaRevisao: h.pararamNaRevisao.length,
  };
}

type ErroServidor = { routePath: string | null; message: string; vezes: number; ultimoEm: Date };

function relatorioEmail(
  h: Awaited<ReturnType<typeof getImportHealth>>,
  days: number,
  erros: ErroServidor[],
  avisos: PessoaAAvisar[],
): { subject: string; html: string } {
  const periodo = days === 1 ? "nas últimas 24 horas" : `nos últimos ${days} dias`;
  const linhas = h.porCausa
    .map(
      (c) => `<li style="margin-bottom:10px">
        <b>${escapar(c.causa)}</b><br/>
        <span style="color:#666">${c.pessoas} pessoa${c.pessoas === 1 ? "" : "s"} · ${c.vezes} tentativa${c.vezes === 1 ? "" : "s"}</span>
        ${c.exemplos.length > 0 ? `<br/><code style="font-size:12px;color:#444">${c.exemplos.map(escapar).join("<br/>")}</code>` : ""}
      </li>`,
    )
    .join("");

  const naRevisao = new Set(h.pararamNaRevisao.map((p) => p.userId));
  const semSucesso = h.pessoasSemSucesso
    .map(
      (p) =>
        `<li>${escapar(p.email)} — ${p.tentativas} tentativa${p.tentativas === 1 ? "" : "s"}, nenhum lançamento importado${
          naRevisao.has(p.userId) ? " <b>(o arquivo foi lido certo: parou na revisão, antes de salvar)</b>" : ""
        }</li>`,
    )
    .join("");

  const quando = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  const listaParaAprovar = avisos
    .map(
      (a) =>
        `<li style="margin-bottom:8px"><b>${escapar(a.nome?.trim() || a.email)}</b> · ${escapar(a.email)}<br/>
         ${escapar(a.problema)}<br/>
         <span style="color:#666">${escapar(a.fileName ?? "arquivo sem nome")} · ${quando(a.quando)}</span></li>`,
    )
    .join("");

  const listaErros = erros
    .map((e) => `<li><b>${escapar(e.routePath ?? "rota desconhecida")}</b> — ${escapar(e.message.slice(0, 160))} <span style="color:#666">(${e.vezes}×)</span></li>`)
    .join("");

  return {
    subject: `SPI Finance · ${h.falhas + h.parciais + h.implausiveis} problema(s) de importação e ${erros.length} erro(s) de servidor ${periodo}`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px;color:#111">
      <h2 style="margin-bottom:4px">Importação ${periodo}</h2>
      <p style="color:#666;margin-top:0">
        ${h.total} tentativa${h.total === 1 ? "" : "s"} · ${h.falhas} falha${h.falhas === 1 ? "" : "s"} ·
        ${h.parciais} leitura${h.parciais === 1 ? "" : "s"} parcial${h.parciais === 1 ? "" : "is"} ·
        ${h.implausiveis} com número implausível
      </p>
      ${linhas ? `<h3>O que quebrou</h3><ul>${linhas}</ul>` : "<p>Nenhuma falha agrupada.</p>"}
      ${semSucesso ? `<h3>Quem tentou e não conseguiu nada</h3><ul>${semSucesso}</ul>` : ""}
      ${listaParaAprovar ? `<h3>Pra você decidir se chama (nada foi enviado)</h3><ul>${listaParaAprovar}</ul><p style="color:#666">Ficaram sem conseguir importar nos últimos 7 dias. Antes de chamar, confira se é mesmo problema: o Claude confere na checagem diária e te mostra o texto pra aprovar. Por e-mail primeiro.</p>` : ""}
      ${listaErros ? `<h3>Erros de servidor</h3><ul>${listaErros}</ul>` : ""}
      <p style="color:#999;font-size:12px">O cabeçalho do arquivo aparece acima quando existe — é a linha de nomes de coluna, o que identifica o formato do banco. Nenhum valor ou transação é guardado.</p>
    </div>`,
  };
}

function escapar(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}
