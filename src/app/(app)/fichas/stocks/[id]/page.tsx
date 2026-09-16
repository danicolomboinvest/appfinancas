import { SheetPage } from "../../SheetPage";

export default async function Page(props: PageProps<"/fichas/stocks/[id]">) {
  const { id } = await props.params;
  return <SheetPage id={id} sheetType="STOCK_INTL" />;
}
