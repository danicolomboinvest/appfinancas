import { SheetPage } from "../../SheetPage";

export default async function Page(props: PageProps<"/fichas/fiis/[id]">) {
  const { id } = await props.params;
  return <SheetPage id={id} sheetType="FII" />;
}
