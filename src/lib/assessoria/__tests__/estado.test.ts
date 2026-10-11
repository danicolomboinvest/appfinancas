import { describe, expect, it } from "vitest";
import { EQI_ABRIR_CONTA_URL } from "@/lib/eqi";
import { crmLigado, enviarLeadDaAssessoria } from "../crm";
import { estadoDaAssessoria, proximoEstado, TEXTOS_DA_ASSESSORIA } from "../estado";

describe("assessoria na Carteira (rodadas 68, 73 e 76)", () => {
  it("o link de abrir conta é exatamente o da seção 12, com o assessor da Fatos", () => {
    expect(EQI_ABRIR_CONTA_URL).toBe(
      "https://lps.eqi.com.br/abertura-de-conta-eqi_inst02_alwayson_x_a_x_x/?utm_campaign=AAAAMMDD-CPT-AON-BSE-X&utm_source=PRC-XXX-XXX&utm_medium=XXX-CT1-XXX&utm_content=OUT-QAS&campaignId=7014V000002J1onQAC&assessor=6135074&manual_referral=true#form",
    );
  });

  it("'Já abri minha conta' leva a conferindo; 'Ainda não abri' desfaz", () => {
    expect(estadoDaAssessoria(null)).toBe("nao_cliente");
    expect(proximoEstado("nao_cliente", "ja_abri")).toBe("confirmando");
    expect(proximoEstado("confirmando", "ainda_nao")).toBe("nao_cliente");
    expect(proximoEstado("cliente", "ainda_nao")).toBe("cliente");
    expect(estadoDaAssessoria("qualquer")).toBe("nao_cliente");
  });

  it("os textos não falam de custo, prazo, remuneração, garantia nem 'escritório da Dani'", () => {
    const tudo = JSON.stringify(TEXTOS_DA_ASSESSORIA).toLowerCase();
    for (const proibido of ["custo", "prazo", "remunera", "garant", "escritório da dani", "melhor rentabilidade", "sem risco", "a confirmar", "assessor"]) {
      expect(tudo).not.toContain(proibido);
    }
    expect(TEXTOS_DA_ASSESSORIA.nao_cliente.titulo).toContain("Fatos Capital");
  });

  it("o lead para o CRM está desligado: nada é enviado, nem com a chave", async () => {
    expect(crmLigado({ CRM_API_KEY: "x" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    const lead = { nome: "Ana", whatsapp: "", email: "", patrimonio: "", horario: "", canal: "", origemNoApp: "acompanhamento" as const };
    expect(await enviarLeadDaAssessoria({ ...lead, consentimentoEm: null })).toEqual({ enviado: false, motivo: "sem_consentimento" });
    expect(await enviarLeadDaAssessoria({ ...lead, consentimentoEm: new Date() })).toEqual({ enviado: false, motivo: "desligado" });
  });
});
