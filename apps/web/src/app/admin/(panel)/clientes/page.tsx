import type { Metadata } from "next";
import { CustomersView } from "@/components/admin/customers-view";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientesPage() {
  return <CustomersView />;
}
