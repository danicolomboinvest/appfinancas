import { redirect } from "next/navigation";

export default function OrcamentoComparativoIndexPage() {
  redirect(`/orcamento/comparativo/${new Date().getFullYear()}`);
}
