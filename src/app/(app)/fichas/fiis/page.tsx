import { SheetListPage } from "../SheetListPage";
import { CreateFiiSheetForm } from "./CreateFiiSheetForm";

export default function Page() {
  return (
    <SheetListPage
      sheetType="FII"
      title="Análises de FIIs"
      subtitle="Digite o nome ou o código e o app faz a leitura do fundo."
      createForm={<CreateFiiSheetForm />}
    />
  );
}
