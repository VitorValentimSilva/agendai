"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, LoaderCircle, QrCode, Timer, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, unwrap, type Schemas } from "@/lib/api/client";
import { formatPrice } from "@/lib/format";

type Appointment = Schemas["PublicAppointmentDto"];

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(target).getTime() - now);
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { expired: ms === 0, label: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

/** Pix pendente: QR, copia e cola, contagem regressiva. O status é atualizado pela página (polling). */
export function PixPayment({ appointment, token }: { appointment: Appointment; token: string }) {
  const queryClient = useQueryClient();
  const payment = appointment.payment!;
  const countdown = useCountdown(payment.expiresAt);
  const simulated = payment.provider === "SIMULATED";

  const simulate = useMutation({
    mutationFn: () => unwrap(api.POST("/appointments/manage/{token}/simulate-payment", { params: { path: { token } } })),
    onSuccess: (data) => {
      queryClient.setQueryData(["appointment", token], data);
      toast.success("Pagamento recebido!", { description: "Seu horário está confirmado." });
    },
    onError: (e) => toast.error("Não foi possível simular", { description: e.message }),
  });

  return (
    <section aria-labelledby="pix-title" className="overflow-hidden rounded-2xl border border-gold/40 bg-card">
      <div className="flex items-center justify-between gap-3 border-b bg-gold/10 px-5 py-4">
        <div>
          <h2 id="pix-title" className="flex items-center gap-2 font-semibold">
            <QrCode className="size-4 text-gold" /> Pague com Pix para confirmar
          </h2>
          <p className="text-sm text-muted-foreground">
            {payment.amountCents < appointment.priceCents ? "Sinal" : "Valor"} de{" "}
            <strong className="text-foreground">{formatPrice(payment.amountCents)}</strong>
            {payment.amountCents < appointment.priceCents && ` · restante ${formatPrice(appointment.priceCents - payment.amountCents)} no local`}
          </p>
        </div>
        <span
          className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1 font-mono text-sm tabular-nums"
          aria-label={`Tempo restante ${countdown.label}`}
        >
          <Timer className="size-3.5 text-gold" /> {countdown.label}
        </span>
      </div>
      <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="mx-auto rounded-xl bg-white p-3">
          {payment.qrCodeBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${payment.qrCodeBase64}`} alt="QR code do Pix" className="size-44" />
          ) : payment.qrCode ? (
            <QRCodeSVG value={payment.qrCode} size={176} aria-label="QR code do Pix" />
          ) : null}
        </div>
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            Abra o app do seu banco, escolha <strong className="text-foreground">Pix → Pagar com QR code</strong> ou use o código
            copia e cola. A confirmação aparece aqui automaticamente.
          </p>
          {payment.qrCode && (
            <div className="flex gap-2">
              <input
                readOnly
                value={payment.qrCode}
                aria-label="Pix copia e cola"
                className="h-10 min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard?.writeText(payment.qrCode!).then(
                    () => toast.success("Código Pix copiado!"),
                    () => toast.error("Não foi possível copiar."),
                  )
                }
              >
                <Copy /> Copiar
              </Button>
            </div>
          )}
          <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <LoaderCircle className="size-3.5 animate-spin" /> Aguardando pagamento… o horário fica reservado até o tempo acabar.
          </p>
          {simulated && (
            <div className="rounded-xl border border-dashed border-info/40 bg-info/5 p-3 text-sm">
              <p className="text-muted-foreground">
                Demonstração: este Pix é <strong className="text-foreground">simulado</strong> (nenhum valor é cobrado).
              </p>
              <Button size="sm" className="mt-2" onClick={() => simulate.mutate()} disabled={simulate.isPending}>
                {simulate.isPending ? <LoaderCircle className="animate-spin" /> : <WandSparkles />} Simular pagamento
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
