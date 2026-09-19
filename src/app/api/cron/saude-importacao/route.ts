import { NextResponse } from "next/server";
import { getImportHealth } from "@/lib/repositories/import-diagnostic.repo";
import { purgeExpiredImportFiles } from "@/lib/repositories/import-file.repo";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { prisma } from "@/lib/db/prisma";
import { avisarPessoas, pessoasAAvisar, type ResultadoDoAviso } from "@/lib/support/import-outreach";

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
  const secret = process.env.CRON_SECRET;
  const authorized = secret
    ? request.headers.get("authorization") === `Bearer ${secret}`
    : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  // Puxa conversa com quem ficou na mão. Roda todo dia, mesmo em dia sem falha nova: o que
  // importa aqui não é o erro ter acontecido hoje, é a pessoa ainda estar sem solução.
  // `?avisar=0` desliga o disparo sem desligar o relatório.
  const podeAvisar = url.searchParams.get("avisar") !== "0";
  const avisos = podeAvisar ? await avisarPessoas(await pessoasAAvisar(), dryRun) : [];

  // Retenção dos arquivos guardados. Roda ANTES de qualquer saída antecipada: em dia sem falha
  // a função retornava cedo, e aí extrato de cliente ficaria parado no banco além do prazo.
  const arquivosApagados = await purgeExpiredImportFiles();

  const problemas = health.falhas + health.parciais + health.implausiveis + erros.length;
  // Aviso que não chegou é problema mesmo em dia sem falha nova: é alguém esperando resposta.
  const naoAlcancadas = avisos.filter((a) => !a.enviado && a.status !== "simulado");
  if (problemas === 0 && naoAlcancadas.length === 0 && !dryRun) {
    return NextResponse.json({ ok: true, ...resumo(health), erros: 0, arquivosApagados, avisos: avisos.length, enviado: false, motivo: "dia sem falha" });
  }

  const destino = process.env.SUPPORT_EMAIL ?? process.env.SMTP_USER;
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
  };
}

type ErroServidor = { routePath: string | null; message: string; vezes: number; ultimoEm: Date };

/** Por que o aviso não chegou, em português, com o que a Dani precisa fazer a respeito. */
const MOTIVO_DO_AVISO: Record<string, string> = {
  "fora-da-janela": "o WhatsApp não deixou (faz mais de 24h que ela não fala com você) — precisa chamar na mão",
  "nao-encontrado": "não achei essa pessoa no ManyChat pelo e-mail dela — precisa chamar na mão",
  "sem-token": "o ManyChat ainda não está configurado no app",
  "sem-fluxo": "falta dizer ao app qual fluxo do ManyChat disparar",
  erro: "o ManyChat recusou o envio",
  "sem-configuracao": "o ManyChat ainda não está configurado no app",
  simulado: "simulação (nada foi enviado)",
};

function relatorioEmail(
  h: Awaited<ReturnType<typeof getImportHealth>>,
  days: number,
  erros: ErroServidor[],
  avisos: ResultadoDoAviso[],
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

  const semSucesso = h.pessoasSemSucesso
    .map((p) => `<li>${escapar(p.email)} — ${p.tentativas} tentativa${p.tentativas === 1 ? "" : "s"}, nenhum lançamento importado</li>`)
    .join("");

  const enviados = avisos.filter((a) => a.enviado);
  const naoEnviados = avisos.filter((a) => !a.enviado);
  const listaAvisadas = enviados
    .map((a) => `<li>${escapar(a.nome ?? a.email)} — ${escapar(a.problema)}</li>`)
    .join("");
  const listaNaMao = naoEnviados
    .map(
      (a) =>
        `<li><b>${escapar(a.nome ?? a.email)}</b> — ${escapar(a.problema)}<br/>
         <span style="color:#666">${escapar(a.email)} · ${escapar(MOTIVO_DO_AVISO[a.status] ?? a.status)}</span></li>`,
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
      ${listaAvisadas ? `<h3>O ManyChat já puxou conversa com</h3><ul>${listaAvisadas}</ul>` : ""}
      ${listaNaMao ? `<h3 style="color:#b00">Estas você precisa chamar na mão</h3><ul>${listaNaMao}</ul><p style="color:#666">O app tentou e não conseguiu entregar. Elas estão esperando resposta sem saber.</p>` : ""}
      ${listaErros ? `<h3>Erros de servidor</h3><ul>${listaErros}</ul>` : ""}
      <p style="color:#999;font-size:12px">O cabeçalho do arquivo aparece acima quando existe — é a linha de nomes de coluna, o que identifica o formato do banco. Nenhum valor ou transação é guardado.</p>
    </div>`,
  };
}

function escapar(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c);
}
