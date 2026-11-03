import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { BookingFlow } from "@/components/booking/booking-flow";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Agendar horário" };

export default function AgendarPage() {
  return (
    <>
      <SiteHeader showCta={false} />
      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
          <BookingFlow />
        </Suspense>
      </main>
    </>
  );
}
