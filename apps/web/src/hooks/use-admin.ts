"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, unwrap, type Schemas } from "@/lib/api/client";

export type Me = Schemas["MeDto"];
export type AdminAppointment = Schemas["AdminAppointmentDto"];
export type AppointmentStatus = AdminAppointment["status"];

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => unwrap(api.GET("/auth/me")), staleTime: 5 * 60_000, retry: false });
}

export function useDashboard() {
  return useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => unwrap(api.GET("/admin/dashboard")) });
}

export function useAgenda(params: { from: string; to: string; professionalId?: string }) {
  return useQuery({
    queryKey: ["admin", "agenda", params],
    queryFn: () =>
      unwrap(
        api.GET("/admin/appointments", {
          params: { query: { from: params.from, to: params.to, ...(params.professionalId ? { professionalId: params.professionalId } : {}) } },
        }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useAdminServices() {
  return useQuery({ queryKey: ["admin", "services"], queryFn: () => unwrap(api.GET("/admin/services")) });
}

export function useAdminProfessionals() {
  return useQuery({ queryKey: ["admin", "professionals"], queryFn: () => unwrap(api.GET("/admin/professionals")) });
}

export function useBusinessSettings(enabled = true) {
  return useQuery({ queryKey: ["admin", "business"], enabled, queryFn: () => unwrap(api.GET("/admin/business")) });
}

export function useTimeOffs(params: { from?: string; to?: string; professionalId?: string }) {
  return useQuery({
    queryKey: ["admin", "time-offs", params],
    queryFn: () => unwrap(api.GET("/admin/time-offs", { params: { query: params } })),
  });
}

export function useCustomers(params: { search?: string; page: number; pageSize?: number }) {
  return useQuery({
    queryKey: ["admin", "customers", params],
    queryFn: () => unwrap(api.GET("/admin/customers", { params: { query: { ...params, pageSize: params.pageSize ?? 20 } } })),
    placeholderData: (prev) => prev,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "customer", id],
    enabled: Boolean(id),
    queryFn: () => unwrap(api.GET("/admin/customers/{id}", { params: { path: { id: id! } } })),
  });
}

/** Invalida tudo do painel após uma mudança (agenda, dashboard, clientes...). */
export function useInvalidateAdmin() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin"] });
}

export function useChangeStatus() {
  const invalidate = useInvalidateAdmin();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      unwrap(api.PATCH("/admin/appointments/{id}/status", { params: { path: { id } }, body: { status } })),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error("Não foi possível alterar o status", { description: e.message }),
  });
}

export function useIntegrations() {
  return useQuery({ queryKey: ["admin", "integrations"], queryFn: () => unwrap(api.GET("/admin/integrations")), staleTime: 5 * 60_000 });
}

export function useReport(params: { from: string; to: string; professionalId?: string }) {
  return useQuery({
    queryKey: ["admin", "report", params],
    queryFn: () =>
      unwrap(
        api.GET("/admin/reports", {
          params: { query: { from: params.from, to: params.to, ...(params.professionalId ? { professionalId: params.professionalId } : {}) } },
        }),
      ),
    placeholderData: (prev) => prev,
  });
}

export function useWaitlist(status: "ACTIVE" | "NOTIFIED" | "BOOKED" | "CANCELED" | "ALL") {
  return useQuery({
    queryKey: ["admin", "waitlist", status],
    queryFn: () => unwrap(api.GET("/admin/waitlist", { params: { query: { status } } })),
  });
}

export function useMessages() {
  return useQuery({
    queryKey: ["admin", "messages"],
    queryFn: () => unwrap(api.GET("/admin/messages", { params: { query: { limit: 100 } } })),
    refetchInterval: 15_000,
  });
}
