import { SheetListPage } from "../SheetListPage";
import { CreateStockSheetForm } from "./CreateStockSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="STOCK"
      title="Análises de Ações"
      subtitle="Digite o nome ou o código e o app faz a leitura dos números."
      createForm={<CreateStockSheetForm />}
    />
  );
}
