/**
 * Mede a leitura dos prints de teste (gerar.mjs): OCR de verdade em cada print, junta os três de
 * cada banco e compara com o gabarito. Grava os pedaços lidos como fixture dos testes.
 *
 * Uso: npx tsx scripts/prints-de-fatura/medir.ts <pasta-dos-prints> [pasta-das-fixtures]
 */
import fs from "node:fs";
import path from "node:path";
import { lerSegmentosDoPrint } from "../../src/lib/import/ocr-print";
import { comprasDosPrints, juntarPrints, lerPrint, type Segmento } from "../../src/lib/import/print-fatura";
import { semAcentoNemPontuacao } from "../../src/lib/import/comerciante";

type Esperada = { d: string; nome: string; valor: number; parcela?: [number, number]; credito?: boolean; pagamento?: boolean };

const pasta = process.argv[2];
const fixtures = process.argv[3];
const gabarito = JSON.parse(fs.readFileSync(path.join(pasta, "gabarito.json"), "utf8")) as { envio: string; compras: Esperada[]; bancos?: Record<string, Esperada[]> };
const bancos = [...new Set(fs.readdirSync(pasta).filter((f) => /-\d\.(png|jpe?g|json)$/.test(f)).map((f) => f.replace(/-\d\.\w+$/, "")))].sort();
/** A lista de cada layout: a comum, ou a própria (o cartão do BTG/EQI tem datas de parcela antigas). */
const esperadasDe = (banco: string) => (gabarito.bancos?.[banco] ?? gabarito.compras).filter((c) => !c.pagamento);

/** PREP=1: o mesmo preparo que a tela faz antes de mandar (cinza, contraste, claro no escuro). */
async function preparar(buf: Buffer): Promise<Buffer> {
  if (!process.env.PREP) return buf;
  const sharp = (await import("sharp")).default;
  const { prepararPixels, escalaDoPrint } = await import("../../src/lib/import/preparar-print");
  const meta = await sharp(buf).metadata();
  const escala = escalaDoPrint(meta.width ?? 0);
  const { data, info } = await sharp(buf)
    .resize(Math.round((meta.width ?? 0) * escala), null, { kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = prepararPixels(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
  return sharp(Buffer.from(r.pixels.buffer), { raw: { width: r.largura, height: r.altura, channels: 4 } }).png().toBuffer();
}

async function main() {
  let totalAcertos = 0;
  let totalEsperadas = 0;
  for (const banco of bancos) {
    // Pasta das fixtures (.json com os pedaços já lidos): mede sem rodar o OCR de novo.
    const arquivos = fs.readdirSync(pasta).filter((f) => f.replace(/-\d\.\w+$/, "") === banco && /-\d\.(png|jpe?g|json)$/.test(f)).sort();
    const prints: Segmento[][] = [];
    let ms = 0;
    for (const a of arquivos) {
      const t0 = Date.now();
      const { segmentos } = a.endsWith(".json")
        ? { segmentos: JSON.parse(fs.readFileSync(path.join(pasta, a), "utf8")) as Segmento[] }
        : await lerSegmentosDoPrint(await preparar(fs.readFileSync(path.join(pasta, a))));
      ms += Date.now() - t0;
      prints.push(segmentos);
      if (fixtures) {
        fs.mkdirSync(fixtures, { recursive: true });
        fs.writeFileSync(path.join(fixtures, a.replace(/\.\w+$/, ".json")), JSON.stringify(segmentos.map((s) => ({ ...s, x0: Math.round(s.x0), y0: Math.round(s.y0), x1: Math.round(s.x1), y1: Math.round(s.y1) }))));
      }
    }
    const lidas = comprasDosPrints(juntarPrints(prints.map((p) => lerPrint(p, gabarito.envio))), gabarito.envio);
    // Acerto: data, valor (com sinal), parcela e nome igual sem acento/caixa.
    const esperadas = esperadasDe(banco);
    const sobra = [...lidas];
    let acertos = 0;
    const erros: string[] = [];
    for (const e of esperadas) {
      const valor = e.credito ? -Math.abs(e.valor) : e.valor;
      const desc = e.parcela ? `${e.nome} - Parcela ${e.parcela[0]}/${e.parcela[1]}` : e.nome;
      const i = sobra.findIndex((l) => l.date === e.d && Math.abs(l.amount - valor) < 0.001 && semAcentoNemPontuacao(l.description) === semAcentoNemPontuacao(desc));
      if (i >= 0) {
        acertos++;
        sobra.splice(i, 1);
      } else erros.push(`faltou ${e.d} ${desc} ${valor}`);
    }
    for (const s of sobra) erros.push(`sobrou ${s.date} ${s.description} ${s.amount}`);
    totalAcertos += acertos;
    totalEsperadas += esperadas.length;
    console.log(`${banco.padEnd(10)} ${acertos}/${esperadas.length} certas, ${sobra.length} a mais, OCR ${ms} ms`);
    for (const e of erros) console.log(`   ${e}`);
  }
  console.log(`TOTAL ${totalAcertos}/${totalEsperadas}`);
}
void main();
