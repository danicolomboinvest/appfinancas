import { SheetListPage } from "../SheetListPage";
import { CreateFiiSheetForm } from "./CreateFiiSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="FII"
      createForm={<CreateFiiSheetForm />}
    />
  );
}
