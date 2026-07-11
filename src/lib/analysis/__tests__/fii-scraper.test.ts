import { describe, expect, it } from "vitest";
import { buildInvestidor10FiiUrl, parseFiiPage } from "../fii-scraper";

function buildInfoCell(label: string, value: string): string {
  return `
    <div class='cell'>
      <div class="icon"><i class="fas fa-info-circle"></i></div>
      <div class="desc">
        <span class="d-flex justify-content-between align-items-center name">${label}</span>
        <div class="value"><span>${value}</span></div>
      </div>
    </div>
  `;
}

function buildCard(title: string, value: string): string {
  return `
    <div class="_card">
      <div class="_card-header"><div><span title="${title}">${title}</span></div></div>
      <div class="_card-body"><span>${value}</span></div>
    </div>
  `;
}

const TIJOLO_HTML = `
<html><body>
  <div id="table-indicators" class="table table-bordered outter-borderless table-info-fii">
    ${buildInfoCell("Razão Social", "CSHG LOGÍSTICA - FUNDO DE INVESTIMENTO IMOBILIÁRIO")}
    ${buildInfoCell("MANDATO", "Renda")}
    ${buildInfoCell("SEGMENTO", "Logístico / Indústria / Galpões")}
    ${buildInfoCell("TIPO DE FUNDO", "Fundo de Tijolo")}
    ${buildInfoCell("TIPO DE GESTÃO", "Ativa")}
    ${buildInfoCell("TAXA DE ADMINISTRAÇÃO", "0,60% a.a")}
    ${buildInfoCell("VACÂNCIA", "3,90%")}
    ${buildInfoCell("VALOR PATRIMONIAL", "R$ 7,57 Bilhões")}
  </div>
  <section id="cards-ticker" class="cards-ticker--fii">
    ${buildCard("P/VP", "0,90")}
    ${buildCard("Liquidez Diária", "R$ 14,86 M")}
  </section>
  <div id="properties-section">
    <div class="card-propertie">A</div>
    <div class="card-propertie">B</div>
    <div class="card-propertie">C</div>
  </div>
</body></html>
`;

const PAPEL_HTML = `
<html><body>
  <div id="table-indicators" class="table table-bordered outter-borderless table-info-fii">
    ${buildInfoCell("MANDATO", "Títulos e valores mobiliários")}
    ${buildInfoCell("SEGMENTO", "Títulos e Valores Mobiliários")}
    ${buildInfoCell("TIPO DE FUNDO", "Fundo de Papel")}
    ${buildInfoCell("TIPO DE GESTÃO", "Ativa")}
    ${buildInfoCell("TAXA DE ADMINISTRAÇÃO", "1,08 % a.a")}
    ${buildInfoCell("VACÂNCIA", "0,00%")}
    ${buildInfoCell("VALOR PATRIMONIAL", "R$ 10,96 Bilhões")}
  </div>
  <section id="cards-ticker" class="cards-ticker--fii">
    ${buildCard("P/VP", "1,05")}
    ${buildCard("Liquidez Diária", "R$ 24,42 M")}
  </section>
</body></html>
`;

describe("buildInvestidor10FiiUrl", () => {
  it("lowercases the ticker and builds the fiis URL", () => {
    expect(buildInvestidor10FiiUrl("HGLG11")).toBe("https://investidor10.com.br/fiis/hglg11/");
  });
});

describe("parseFiiPage", () => {
  it("extracts tijolo-specific criteria including the property count", () => {
    const results = parseFiiPage(TIJOLO_HTML);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.value]));

    expect(byKey).toEqual({
      mandato: "Renda",
      segmento: "Logístico / Indústria / Galpões",
      tipo_gestao: "Ativa",
      taxa_administracao: "0,60% a.a",
      vacancia_atual: "3,90%",
      patrimonio_liquido: "R$ 7,57 Bilhões",
      p_vp: "0,90",
      liquidez_fii: "R$ 14,86 M",
      numero_imoveis: "3",
    });
  });

  it("extracts papel-specific criteria and omits numero_imoveis when there's no property list", () => {
    const results = parseFiiPage(PAPEL_HTML);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r.value]));

    expect(byKey).toEqual({
      mandato: "Títulos e valores mobiliários",
      segmento: "Títulos e Valores Mobiliários",
      tipo_gestao: "Ativa",
      taxa_administracao: "1,08 % a.a",
      vacancia_atual: "0,00%",
      patrimonio_liquido: "R$ 10,96 Bilhões",
      p_vp: "1,05",
      liquidez_fii: "R$ 24,42 M",
    });
    expect(results.find((r) => r.key === "numero_imoveis")).toBeUndefined();
  });

  it("ignores info cells that aren't in the target catalog (e.g. Razão Social)", () => {
    const results = parseFiiPage(TIJOLO_HTML);
    expect(results.find((r) => r.key === "razao_social")).toBeUndefined();
  });

  it("returns an empty array when the expected sections are absent", () => {
    expect(parseFiiPage("<html><body>página inesperada</body></html>")).toEqual([]);
  });
});
