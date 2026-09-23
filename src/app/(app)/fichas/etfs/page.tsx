import { SheetListPage } from "../SheetListPage";
import { CreateEtfSheetForm } from "./CreateEtfSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="ETF"
      createForm={<CreateEtfSheetForm />}
    />
  );
}
