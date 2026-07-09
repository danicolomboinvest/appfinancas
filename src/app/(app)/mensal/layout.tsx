import { QuickExpenseFab } from "./QuickExpenseFab";
import { VoiceEntryFab } from "./VoiceEntryFab";

export default function MensalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <VoiceEntryFab />
      <QuickExpenseFab />
    </>
  );
}
