import type { Metadata } from "next";
import { ProfessionalsView } from "@/components/admin/professionals-view";

export const metadata: Metadata = { title: "Profissionais" };

export default function ProfissionaisPage() {
  return <ProfessionalsView />;
}
