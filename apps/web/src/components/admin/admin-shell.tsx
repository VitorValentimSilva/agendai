"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/components/site/brand";
import { useMe, type Me } from "@/hooks/use-admin";
import { api, ApiError } from "@/lib/api/client";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard, owner: false },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays, owner: false },
  { href: "/admin/servicos", label: "Serviços", icon: Scissors, owner: true },
  { href: "/admin/profissionais", label: "Profissionais", icon: UsersRound, owner: true },
  { href: "/admin/clientes", label: "Clientes", icon: Users, owner: true },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings, owner: true },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Sessão inválida/expirada → volta ao login
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [me.error, router, pathname]);

  const items = NAV.filter((n) => !n.owner || me.data?.role === "OWNER");
  const ownerOnly = NAV.find((n) => n.owner && pathname.startsWith(n.href));
  const forbidden = me.data?.role === "PROFESSIONAL" && ownerOnly;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex" aria-label="Menu do painel">
        <SidebarContent items={items} pathname={pathname} me={me.data} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Abrir menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu do painel</SheetTitle>
              <SidebarContent items={items} pathname={pathname} me={me.data} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <BrandMark className="size-8" />
          <span className="font-display font-semibold">Navalha de Ouro</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {me.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-56" />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          ) : forbidden ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="font-medium">Esta área é exclusiva do dono do negócio.</p>
              <Button asChild className="mt-4">
                <Link href="/admin/agenda">Ir para a minha agenda</Link>
              </Button>
            </div>
          ) : me.data ? (
            children
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  items,
  pathname,
  me,
  onNavigate,
}: {
  items: typeof NAV;
  pathname: string;
  me?: Me;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function logout() {
    await api.POST("/auth/logout");
    queryClient.clear();
    router.replace("/admin/login");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <BrandMark />
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold">Navalha de Ouro</p>
          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">Painel · Agendaí</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Seções">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className={cn("size-4", active && "text-gold")} />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <ExternalLink className="size-4" /> Ver site público
        </Link>
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="size-9">
            <AvatarFallback className="bg-gold/15 text-xs font-semibold text-gold">{me ? initials(me.name) : "…"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{me?.name ?? "Carregando..."}</p>
            <p className="text-xs text-muted-foreground">{me?.role === "OWNER" ? "Dono" : me ? "Profissional" : ""}</p>
          </div>
          <ThemeToggle />
        </div>
        <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground" onClick={() => void logout()}>
          <LogOut /> Sair
        </Button>
      </div>
    </div>
  );
}
