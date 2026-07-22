import type { WeeklyRecap } from "@/lib/recap/weekly";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Envolve texto em várias linhas dentro de uma largura máxima. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Desenha um card compartilhável do Resumo Semanal (estilo "retrospectiva") num canvas e
 * devolve como PNG, sem dependência externa. Formato 1080×1350 (retrato, bom pra story/feed).
 */
export async function buildRecapShareImage(recap: WeeklyRecap): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");

  // Fundo escuro com brilho dourado no topo.
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 0.7);
  glow.addColorStop(0, "rgba(221,161,94,0.28)");
  glow.addColorStop(1, "rgba(10,10,10,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  ctx.textAlign = "center";

  // Cabeçalho
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 30px Georgia, serif";
  ctx.fillText(recap.rangeLabel.toUpperCase(), cx, 150);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 92px Georgia, serif";
  ctx.fillText("Meu resumo", cx, 260);
  ctx.fillText("da semana", cx, 360);

  // Blocos de destaque
  const savedPositive = recap.allTimeSaved >= 0;
  const blocks: { label: string; value: string; color: string }[] = [
    { label: "Gastei esta semana", value: formatBRL(recap.weekSpent), color: "#f0c989" },
    {
      label: savedPositive ? "Ficou no meu bolso desde o início" : "Saldo desde o início",
      value: formatBRL(recap.allTimeSaved),
      color: savedPositive ? "#6fcb9f" : "#e2836a",
    },
    { label: "Potencial em 10 anos nesse ritmo", value: formatBRL(Math.max(0, recap.projection10y)), color: "#f0c989" },
  ];

  let y = 560;
  for (const block of blocks) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "500 34px system-ui, -apple-system, Arial";
    for (const line of wrap(ctx, block.label, W - 160)) {
      ctx.fillText(line, cx, y);
      y += 44;
    }
    ctx.fillStyle = block.color;
    ctx.font = "800 96px system-ui, -apple-system, Arial";
    ctx.fillText(block.value, cx, y + 78);
    y += 78 + 96;
  }

  // Rodapé / marca
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "600 30px system-ui, -apple-system, Arial";
  ctx.fillText("SPI Finance", cx, H - 90);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar a imagem."))), "image/png");
  });
}

/** Texto de fallback quando não dá pra compartilhar imagem. */
export function buildRecapShareText(recap: WeeklyRecap): string {
  const parts = [
    `Meu resumo da semana (${recap.rangeLabel}):`,
    `• Gastei ${formatBRL(recap.weekSpent)}`,
    `• ${recap.allTimeSaved >= 0 ? "Ficou no bolso" : "Saldo"} desde o início: ${formatBRL(recap.allTimeSaved)}`,
    `• Potencial em 10 anos: ${formatBRL(Math.max(0, recap.projection10y))}`,
  ];
  return parts.join("\n");
}
