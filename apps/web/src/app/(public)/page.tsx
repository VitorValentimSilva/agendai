import { SiteHeader } from "@/components/site/site-header";
import { BusinessHome } from "@/components/site/business-home";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="flex-1">
        <BusinessHome />
      </main>
    </>
  );
}
