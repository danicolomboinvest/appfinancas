import { describe, expect, it } from "vitest";
import { isNubankStatement, parseNubankStatement } from "../nubank-pdf";
import { parseStatement } from "../statement-parser";
import { profileDocument } from "../profile";

/** Extrato fictício com a mesma estrutura do PDF do Nubank (cabeçalho por página, dia com
 * entradas e saídas, descrição em várias linhas, valor sozinho, quebra de página no meio). */
const NUBANK = `MARIA EXEMPLO LTDA
12.345.678/0001-90 0001	CNPJ Agência Conta
1234567-8
a	01 DE MAIO DE 2026 31 DE MAIO DE 2026 VALORES EM R$
Saldo final do período
R$ 179,00
Saldo inicial
Rendimento líquido
Total de entradas
Total de saídas
Saldo final do período
100,00
+0,00
+5.400,00
-5.321,00
179,00
Movimentações
04 MAI 2026 Total de saídas - 1.500,00
Transferência enviada pelo Pix Fulano de Tal - •••.111.222-•• - NU
PAGAMENTOS - IP (0260) Agência: 1 Conta:
1111111-1
1.500,00
Saldo do dia 2.830,10
08 MAI 2026 Total de saídas - 321,00
Pagamento de boleto efetuado CONTABIL LTDA 321,00
Saldo do dia 2.509,10
15 MAI 2026 Total de entradas + 5.400,00
Resgate RDB 400,00
Transferência recebida pelo Pix EMPRESA CLIENTE S.A. - 47.965.438/0001-78
- BANCO XPTO S.A. (0208) Agência: 50
Conta: 414527-0
5.000,00
Total de saídas - 3.500,00
Aplicação RDB 3.000,00
Transferência enviada pelo Pix Beltrano - •••.333.444-•• - CAIXA
Tem alguma dúvida? Mande uma mensagem para nosso time de atendimento pelo chat do app ou ligue 4020 0185 (capitais e regiões
metropolitanas) ou 0800 591 2117 (demais localidades). Atendimento 24h.
Extrato gerado dia 01 de junho de 2026 às 10:00 1 de 2

-- 1 of 2 --

MARIA EXEMPLO LTDA
12.345.678/0001-90 0001	CNPJ Agência Conta
1234567-8
a	01 DE MAIO DE 2026 31 DE MAIO DE 2026 VALORES EM R$
ECONOMICA FEDERAL (0104) Agência: 259 Conta:
1288000000849252309-1
500,00
Saldo do dia 179,00
`;

describe("parseNubankStatement", () => {
  const txns = parseNubankStatement(NUBANK);

  it("reads every movement, with the sign coming from the day's block (entradas/saídas)", () => {
    expect(txns).toHaveLength(6);
    const entradas = txns.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
    const saidas = txns.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);
    expect(entradas).toBe(5400);
    expect(saidas).toBe(-5321);
  });

  it("dates every movement and keeps the description before the masked CPF/CNPJ", () => {
    expect(txns[0]).toEqual({ date: "2026-05-04", description: "Transferência enviada pelo Pix Fulano de Tal", amount: -1500 });
    expect(txns[1]).toEqual({ date: "2026-05-08", description: "Pagamento de boleto efetuado CONTABIL LTDA", amount: -321 });
    expect(txns[2]).toEqual({ date: "2026-05-15", description: "Resgate RDB", amount: 400 });
    expect(txns[3].description).toBe("Transferência recebida pelo Pix EMPRESA CLIENTE S.A.");
    expect(txns[4]).toEqual({ date: "2026-05-15", description: "Aplicação RDB", amount: -3000 });
  });

  it("survives a page break in the middle of a movement without gluing the page header in", () => {
    expect(txns[5]).toEqual({ date: "2026-05-15", description: "Transferência enviada pelo Pix Beltrano", amount: -500 });
  });

  it("is what parseStatement uses for a PDF that looks like Nubank", () => {
    expect(isNubankStatement(NUBANK)).toBe(true);
    expect(parseStatement(NUBANK, "pdf")).toHaveLength(6);
    expect(isNubankStatement("12/05/2026 IFOOD 45,90")).toBe(false);
  });
});

/**
 * Extrato fictício da conta PESSOA FÍSICA: mesma estrutura, mas SEM as linhas "Saldo do dia"
 * (só a conta PJ tem). Era esse formato que o app não reconhecia.
 */
const NUBANK_PF = `Joana Exemplo da Silva
•••.111.222-•• 0001	CPF Agência Conta
7654321-0
a	01 DE SETEMBRO DE 2026 19 DE SETEMBRO DE 2026 VALORES EM R$
Saldo final do período
R$ 42,00
Saldo inicial
Total de entradas
Total de saídas
Saldo final do período
1.000,00
+2.500,00
-3.458,00
42,00
Movimentações
02 SET 2026 Total de saídas - 158,00
Compra no débito SUPERMERCADO EXEMPLO 158,00
05 SET 2026 Total de entradas + 2.500,00
Transferência recebida pelo Pix EMPREGADOR EXEMPLO LTDA - 11.222.333/0001-44
- BANCO EXEMPLO S.A. (0999) Agência: 1 Conta:
9999999-9
2.500,00
11 SET 2026 Total de saídas - 3.300,00
Pagamento de boleto efetuado ALUGUEL EXEMPLO 1.800,00
Transferência enviada pelo Pix Fulano Exemplo - •••.555.666-•• - NU
PAGAMENTOS - IP (0260) Agência: 1 Conta:
1234567-8
1.500,00
Extrato gerado dia 20 de setembro de 2026 às 09:00 1 de 1
`;

describe("extrato do Nubank de conta pessoa física (sem 'Saldo do dia')", () => {
  it("é reconhecido como Nubank mesmo sem a linha de saldo diário", () => {
    expect(isNubankStatement(NUBANK_PF)).toBe(true);
  });

  it("lê todos os lançamentos, com o sinal vindo do bloco do dia", () => {
    const txns = parseStatement(NUBANK_PF, "pdf");
    expect(txns).toHaveLength(4);
    expect(txns[0]).toEqual({ date: "2026-09-02", description: "Compra no débito SUPERMERCADO EXEMPLO", amount: -158 });
    expect(txns[1].amount).toBe(2500);
    expect(txns[2]).toEqual({ date: "2026-09-11", description: "Pagamento de boleto efetuado ALUGUEL EXEMPLO", amount: -1800 });
    expect(txns[3].amount).toBe(-1500);
  });

  it("mostra Nubank na tela, e não o banco que aparece numa transferência recebida", () => {
    expect(profileDocument(NUBANK_PF, "NU_000_01SET2026_19SET2026.pdf").institution).toBe("Nubank");
  });
});

/** Vários extratos mensais juntados num PDF só (ilovepdf & cia): cada mês traz o próprio
 * cabeçalho com período e resumo, e o resumo do 2º mês virava lançamento. Fictício. */
const MES = (mes: string, nome: string, ini: string, ent: string, sai: string, fim: string, corpo: string) => `JOANA EXEMPLO
•••.123.456-•• 0001	CPF Agência Conta
1234567-8
a	01 DE ${nome} DE 2026 28 DE ${nome} DE 2026 VALORES EM R$
Saldo final do período
R$ ${fim}
Saldo inicial
Rendimento líquido
Total de entradas
Total de saídas
Saldo final do período
${ini}
+0,00
+${ent}
-${sai}
${fim}
Movimentações
${corpo}
Extrato gerado dia 08 de outubro de 2026 às 09:08 1 de 1

-- ${mes} of 2 --

`;
const JUNTADOS =
  MES("1", "JANEIRO", "954,79", "1.000,00", "1.200,00", "754,79", `05 JAN 2026 Total de entradas + 1.000,00
Transferência recebida pelo Pix EMPRESA S.A. - 11.222.333/0001-44 - BCO XPTO
1.000,00
10 JAN 2026 Total de saídas - 1.200,00
Pagamento de boleto efetuado ALUGUEL 1.200,00`) +
  MES("2", "FEVEREIRO", "754,79", "300,00", "500,00", "554,79", `03 FEV 2026 Total de saídas - 500,00
Transferência enviada pelo Pix Fulano - •••.111.222-•• - NU
500,00
20 FEV 2026 Total de entradas + 300,00
Transferência recebida pelo Pix Beltrano - •••.333.444-•• - CAIXA
300,00`);

describe("extratos do Nubank de vários meses juntados num PDF", () => {
  it("lê cada mês com o seu cabeçalho, sem transformar o resumo do mês seguinte em lançamento", () => {
    const txns = parseNubankStatement(JUNTADOS);
    expect(txns.map((t) => [t.date, t.amount])).toEqual([
      ["2026-01-05", 1000],
      ["2026-01-10", -1200],
      ["2026-02-03", -500],
      ["2026-02-20", 300],
    ]);
  });

  it("confere a soma de todos os meses, não só do primeiro", async () => {
    const { conferirLeitura } = await import("../conferencia");
    expect(conferirLeitura(JUNTADOS, "statement", parseNubankStatement(JUNTADOS)).status).toBe("fechou");
  });
});
