import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { BookingSuccess } from "@/components/booking/booking-success";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Agendamento confirmado", robots: { index: false } };

export default function SuccessPage() {
  return (
    <>
      <SiteHeader showCta={false} />
      <main id="conteudo" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
          <BookingSuccess />
        </Suspense>
      </main>
    </>
  );
}
