import { SheetListPage } from "../SheetListPage";
import { CreateEtfSheetForm } from "./CreateEtfSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="ETF"
      title="Análises de ETFs"
      subtitle="Digite o código e o app faz a leitura do fundo."
      createForm={<CreateEtfSheetForm />}
    />
  );
}
