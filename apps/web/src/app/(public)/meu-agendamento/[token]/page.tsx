import { Suspense } from "react";
import type { Metadata } from "next";
import { ManageAppointment, ManageHeader } from "@/components/booking/manage-appointment";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Meu agendamento", robots: { index: false } };

export default function ManagePage() {
  return (
    <>
      <Suspense fallback={<div className="h-16 border-b border-border/60" />}>
        <ManageHeader />
      </Suspense>
      <main id="conteudo" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
          <ManageAppointment />
        </Suspense>
      </main>
    </>
  );
}
