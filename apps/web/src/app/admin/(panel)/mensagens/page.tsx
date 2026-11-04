import type { Metadata } from "next";
import { MessagesView } from "@/components/admin/messages-view";

export const metadata: Metadata = { title: "Mensagens" };

export default function Page() {
  return <MessagesView />;
}
