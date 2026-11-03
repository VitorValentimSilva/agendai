import type { Metadata } from "next";
import { ServicesView } from "@/components/admin/services-view";

export const metadata: Metadata = { title: "Serviços" };

export default function ServicosPage() {
  return <ServicesView />;
}
