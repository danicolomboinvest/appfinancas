import { parseStatement } from "../src/lib/import/statement-parser";
import { profileDocument } from "../src/lib/import/profile";

const casos: [string, string][] = [
  ["Nubank CONTA (NU_..._01AGO2026_31AGO2026.csv)", [
    "Data,Valor,Identificador,Descrição",
    "01/08/2026,-1500.00,67c8e7d1-1,Transferência enviada pelo Pix - MARIA SOUZA - 123.456.789-00",
    "03/08/2026,2500.00,67c8e7d1-2,Transferência recebida pelo Pix - EMPRESA LTDA",
    "05/08/2026,-89.90,67c8e7d1-3,Compra no débito - SUPERMERCADO BH",
    "10/08/2026,-1200.50,67c8e7d1-4,Pagamento de fatura",
  ].join("\n")],
  ["Nubank CARTÃO (Nubank_2026-10-13.csv)", [
    "date,title,amount",
    "2026-09-03,Ifood *Ifd,45.90",
    "2026-09-04,Uber *Trip,18.50",
    "2026-09-05,Amazon Br,129.90",
    "2026-09-10,Pagamento recebido,-500.00",
  ].join("\n")],
  ["Inter FATURA (Fatura_2026-09-15.csv)", [
    "Data;Lançamento;Categoria;Tipo;Valor",
    "15/08/2026;POSTO SHELL;Transporte;Compra;R$ 180,00",
    "16/08/2026;NETFLIX.COM;Lazer;Compra;R$ 55,90",
    "20/08/2026;PAGAMENTO FATURA;Outros;Pagamento;-R$ 1.000,00",
  ].join("\n")],
  ["Itaú EXTRATO (Extrato Conta Corrente-xxx.xls → CSV)", [
    "lançamentos",
    "data;lançamento;valor (R$);saldo (R$)",
    "01/09/2026;SALDO ANTERIOR;;1.200,00",
    "02/09/2026;PIX TRANSF MARIA 02/09;-250,00;950,00",
    "03/09/2026;REND PAGO APLIC AUT MAIS;1,45;951,45",
    "05/09/2026;SISPAG FORNECEDOR;-1.100,00;-148,55",
  ].join("\n")],
  ["C6 (C6 setembro.csv)", [
    "Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)",
    "01/09/2026;DANIELA;1234;Alimentação;IFOOD;Única;0,00;0,00;45,90",
    "03/09/2026;DANIELA;1234;Transporte;UBER;Única;0,00;0,00;18,50",
    "05/09/2026;DANIELA;1234;Compras;AMAZON;1/3;0,00;0,00;99,90",
  ].join("\n")],
  ["Sicoob (extrato CSV)", [
    "Data;Histórico;Valor;Saldo",
    "01/09/2026;PAGAMENTO PIX;-120,00;3.400,00",
    "02/09/2026;CREDITO SALARIO;4.500,00;7.900,00",
  ].join("\n")],
  ["Bradesco (extrato CSV com cabeçalho de banco)", [
    "Extrato de: Conta Corrente",
    "Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)",
    "01/09/2026;SALARIO;000123;5.000,00;;5.000,00",
    "02/09/2026;COMPRA CARTAO;000124;;250,00;4.750,00",
  ].join("\n")],
];

for (const [nome, texto] of casos) {
  const p = profileDocument(texto, nome.includes("Nubank_") ? "Nubank_2026-10-13.csv" : undefined);
  const t = parseStatement(texto, "auto");
  const soma = t.reduce((s, x) => s + Math.abs(x.amount), 0);
  const flag = t.length === 0 ? "  <<< ZERO" : t.length < texto.split("\n").length - 2 ? "  <<< LEU MENOS QUE AS LINHAS" : "";
  console.log(`\n${nome}\n  perfil: ${p.kind} | lidos: ${t.length} | soma: ${soma.toFixed(2)}${flag}`);
  for (const x of t) console.log(`     ${x.date}  ${String(x.amount).padStart(10)}  ${x.description.slice(0, 44)}`);
}
