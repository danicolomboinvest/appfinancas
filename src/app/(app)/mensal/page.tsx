import { redirect } from "next/navigation";

export default function MensalPage() {
  redirect(`/mensal/${new Date().getFullYear()}`);
}
