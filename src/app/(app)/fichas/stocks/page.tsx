import { SheetListPage } from "../SheetListPage";
import { CreateStockIntlSheetForm } from "./CreateStockIntlSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="STOCK_INTL"
      title="Análises de Stocks"
      subtitle="Ações no exterior: digite o nome ou o código e o app faz a leitura."
      createForm={<CreateStockIntlSheetForm />}
    />
  );
}
