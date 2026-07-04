import { auth } from "@/lib/auth/auth.config";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <AppShell isAdmin={session?.user.role === "ADMIN"} userEmail={session?.user.email ?? undefined}>
      {children}
    </AppShell>
  );
}
