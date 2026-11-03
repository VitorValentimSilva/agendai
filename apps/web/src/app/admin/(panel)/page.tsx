import type { Metadata } from "next";
import { DashboardView } from "@/components/admin/dashboard-view";

export const metadata: Metadata = { title: "Visão geral" };

export default function AdminHome() {
  return <DashboardView />;
}
