import { SheetListPage } from "../SheetListPage";
import { CreateStockSheetForm } from "./CreateStockSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="STOCK"
      createForm={<CreateStockSheetForm />}
    />
  );
}
