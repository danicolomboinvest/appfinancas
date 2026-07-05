import { QuickExpenseFab } from "./QuickExpenseFab";

export default function MensalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <QuickExpenseFab />
    </>
  );
}
