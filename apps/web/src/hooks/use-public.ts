"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";

export function useBusiness() {
  return useQuery({ queryKey: ["business"], queryFn: () => unwrap(api.GET("/business")), staleTime: 5 * 60_000 });
}

export function useServices() {
  return useQuery({ queryKey: ["services"], queryFn: () => unwrap(api.GET("/services")), staleTime: 5 * 60_000 });
}

export function useTeam() {
  return useQuery({ queryKey: ["team"], queryFn: () => unwrap(api.GET("/professionals")), staleTime: 5 * 60_000 });
}

export function useServiceProfessionals(serviceId: string | undefined) {
  return useQuery({
    queryKey: ["service-professionals", serviceId],
    enabled: Boolean(serviceId),
    queryFn: () =>
      unwrap(api.GET("/services/{serviceId}/professionals", { params: { path: { serviceId: serviceId! } } })),
  });
}

export function useAvailableDays(params: { serviceId?: string; professionalId?: string; from: string; to: string }) {
  return useQuery({
    queryKey: ["available-days", params],
    enabled: Boolean(params.serviceId && params.professionalId),
    queryFn: () =>
      unwrap(
        api.GET("/availability/days", {
          params: {
            query: { serviceId: params.serviceId!, professionalId: params.professionalId!, from: params.from, to: params.to },
          },
        }),
      ),
  });
}

export function useSlots(params: { serviceId?: string; professionalId?: string; date?: string }) {
  return useQuery({
    queryKey: ["slots", params],
    enabled: Boolean(params.serviceId && params.professionalId && params.date),
    staleTime: 10_000,
    queryFn: () =>
      unwrap(
        api.GET("/availability", {
          params: { query: { serviceId: params.serviceId!, professionalId: params.professionalId!, date: params.date! } },
        }),
      ),
  });
}

export function useAppointmentByToken(token: string) {
  return useQuery({
    queryKey: ["appointment", token],
    queryFn: () => unwrap(api.GET("/appointments/manage/{token}", { params: { path: { token } } })),
    // Enquanto o Pix está pendente, consulta a cada 4s para mostrar a confirmação sozinho
    refetchInterval: (query) => (query.state.data?.status === "PENDING_PAYMENT" ? 4000 : false),
  });
}
