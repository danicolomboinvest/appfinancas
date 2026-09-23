import { SheetListPage } from "../SheetListPage";
import { CreateStockIntlSheetForm } from "./CreateStockIntlSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="STOCK_INTL"
      createForm={<CreateStockIntlSheetForm />}
    />
  );
}
