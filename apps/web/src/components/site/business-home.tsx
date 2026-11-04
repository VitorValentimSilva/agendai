"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, AtSign, CalendarCheck, Clock, MapPin, MessageCircle, Phone, Scissors, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ErrorState } from "@/components/site/state";
import { useBusiness, useServices, useTeam } from "@/hooks/use-public";
import { formatDuration, formatPrice, initials, WEEKDAYS } from "@/lib/format";
import { describeIntervals, openStatus, weekdayInTz } from "@/lib/opening";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export function BusinessHome() {
  const business = useBusiness();
  const services = useServices();
  const team = useTeam();

  if (business.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <ErrorState
          title="Não conseguimos carregar a barbearia"
          message={business.error.message}
          onRetry={() => void business.refetch()}
        />
      </div>
    );
  }

  const b = business.data;
  const status = b ? openStatus(b.openingHours, b.timezone) : null;
  // Só calculado no cliente (com dados), no fuso do negócio
  const todayWeekday = b ? weekdayInTz(b.timezone) : -1;
  // Ordem segunda → domingo
  const week = b ? [...b.openingHours.slice(1), b.openingHours[0]!] : [];

  return (
    <>
      {/* Herói */}
      <section className="bg-grain relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-12 pb-14 sm:px-6 md:grid-cols-[1.25fr_1fr] md:items-center md:pt-20 md:pb-20">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
            <motion.p variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
              <MapPin className="size-3.5" />
              {b ? `${b.city} – ${b.state}` : "Campinas – SP"} · Agendamento online
            </motion.p>
            <motion.h1 variants={fadeUp} className="font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl md:text-6xl">
              {b ? (
                <BusinessName name={b.name} />
              ) : (
                <Skeleton className="h-14 w-4/5" />
              )}
            </motion.h1>
            <motion.div variants={fadeUp} className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              {b ? b.description : <Skeleton className="h-16 w-full" />}
            </motion.div>
            <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-lg shadow-gold/10">
                <Link href="/agendar">
                  <CalendarCheck /> Agendar horário
                </Link>
              </Button>
              {b && (
                <Button asChild size="lg" variant="outline">
                  <a href={whatsappLink(b.whatsapp, "Olá! Vim pelo site e gostaria de tirar uma dúvida.")} target="_blank" rel="noreferrer">
                    <MessageCircle /> Falar no WhatsApp
                  </a>
                </Button>
              )}
            </motion.div>
            {status && (
              <motion.p variants={fadeUp} className="mt-6 flex items-center gap-2 text-sm">
                <span className={cn("relative flex size-2.5", status.open ? "text-success" : "text-muted-foreground")}>
                  {status.open && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />}
                  <span className="relative inline-flex size-2.5 rounded-full bg-current" />
                </span>
                <span className="text-muted-foreground">{status.label}</span>
              </motion.p>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
            <Card className="gap-4 border-border/70 bg-card/80 backdrop-blur">
              <CardContent className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="size-4 text-gold" /> Horário de funcionamento
                </div>
                <ul className="space-y-2 text-sm" aria-label="Horários por dia da semana">
                  {b
                    ? week.map((d) => (
                        <li
                          key={d.weekday}
                          className={cn(
                            "flex items-center justify-between gap-4 rounded-lg px-2 py-1.5",
                            d.weekday === todayWeekday && "bg-gold/10 font-medium text-foreground",
                          )}
                        >
                          <span className={cn(d.weekday !== todayWeekday && "text-muted-foreground")}>
                            {WEEKDAYS[d.weekday]}
                            {d.weekday === todayWeekday && <span className="ml-1.5 text-xs text-gold">(hoje)</span>}
                          </span>
                          <span className={cn("tabular-nums", d.intervals.length === 0 && "text-muted-foreground")}>
                            {d.intervals.length ? `${describeIntervals([{ start: Math.min(...d.intervals.map((i) => i.start)), end: Math.max(...d.intervals.map((i) => i.end)) }])}` : "Fechado"}
                          </span>
                        </li>
                      ))
                    : Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-7 w-full" />)}
                </ul>
                <div className="space-y-2.5 border-t pt-4 text-sm text-muted-foreground">
                  {b ? (
                    <>
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                        <span>
                          {b.addressLine}
                          <br />
                          {b.city} – {b.state}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="size-4 shrink-0 text-gold" />
                        <a href={`tel:${b.phone.replace(/\D/g, "")}`} className="hover:text-foreground">
                          {b.phone}
                        </a>
                        {b.phone.replace(/\D/g, "") !== b.whatsapp.replace(/^55/, "") && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{formatPhone(b.whatsapp)}</span>
                          </>
                        )}
                      </p>
                      {b.instagram && (
                        <p className="flex items-center gap-2">
                          <AtSign className="size-4 shrink-0 text-gold" />
                          <span>{b.instagram}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <Skeleton className="h-16 w-full" />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Serviços */}
      <section id="servicos" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionTitle eyebrow="Serviços" title="Escolha o seu e agende em segundos" />
        {services.isError ? (
          <ErrorState message={services.error.message} onRetry={() => void services.refetch()} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.data
              ? services.data.map((s, i) => (
                  <motion.li
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                  >
                    <Link
                      href={`/agendar?servico=${s.id}`}
                      className="group flex h-full flex-col rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-lg hover:shadow-gold/5 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-xl bg-gold/10 text-gold">
                            <Scissors className="size-4.5" />
                          </span>
                          <h3 className="font-semibold">{s.name}</h3>
                        </div>
                        <span className="font-display text-lg font-semibold whitespace-nowrap text-gold">{formatPrice(s.priceCents)}</span>
                      </div>
                      <p className="mt-3 flex-1 text-sm text-muted-foreground">{s.description}</p>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Timer className="size-4" /> {formatDuration(s.durationMinutes)}
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-foreground transition-colors group-hover:text-gold">
                          Agendar <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </motion.li>
                ))
              : Array.from({ length: 6 }, (_, i) => (
                  <li key={i}>
                    <Skeleton className="h-44 w-full rounded-2xl" />
                  </li>
                ))}
          </ul>
        )}
      </section>

      {/* Equipe */}
      <section id="equipe" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
          <SectionTitle eyebrow="Equipe" title="Profissionais que entendem do assunto" />
          <ul className="grid gap-4 sm:grid-cols-3">
            {team.data
              ? team.data.map((p) => (
                  <li key={p.id} className="flex items-start gap-4 rounded-2xl border bg-card p-5">
                    <Avatar className="size-14 ring-2 ring-gold/40 ring-offset-2 ring-offset-card">
                      <AvatarFallback className="bg-gradient-to-br from-gold/30 to-gold/5 font-display text-lg text-gold">
                        {initials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{p.bio}</p>
                    </div>
                  </li>
                ))
              : Array.from({ length: 3 }, (_, i) => (
                  <li key={i}>
                    <Skeleton className="h-28 w-full rounded-2xl" />
                  </li>
                ))}
          </ul>
          <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/15 via-card to-card p-8 text-center sm:p-10">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Bora dar um tapa no visual?</h2>
            <p className="max-w-md text-muted-foreground">
              Escolha o serviço, o profissional e o horário. Você recebe um link para remarcar ou cancelar quando quiser.
            </p>
            <Button asChild size="lg">
              <Link href="/agendar">
                <CalendarCheck /> Agendar agora
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

/** Nome do negócio com a última palavra em destaque dourado. */
function BusinessName({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return <span className="text-gold italic">{name}</span>;
  const last = words.pop();
  return (
    <>
      {words.join(" ")} <span className="text-gold italic">{last}</span>
    </>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
    </div>
  );
}
