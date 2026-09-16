import { SheetPage } from "../../SheetPage";

export default async function Page(props: PageProps<"/fichas/etfs/[id]">) {
  const { id } = await props.params;
  return <SheetPage id={id} sheetType="ETF" />;
}
