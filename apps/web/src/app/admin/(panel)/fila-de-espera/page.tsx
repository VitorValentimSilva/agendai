import type { Metadata } from "next";
import { WaitlistView } from "@/components/admin/waitlist-view";

export const metadata: Metadata = { title: "Fila de espera" };

export default function Page() {
  return <WaitlistView />;
}
