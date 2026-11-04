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

/**
 * Dias com horário livre. Com `manageToken` (remarcação), consulta pelo agendamento:
 * vale para qualquer negócio (independe do subdomínio) e o horário atual não conta como ocupado.
 */
export function useAvailableDays(params: { serviceId?: string; professionalId?: string; from: string; to: string; manageToken?: string }) {
  const { manageToken, ...rest } = params;
  return useQuery({
    queryKey: ["available-days", params],
    enabled: Boolean(manageToken || (params.serviceId && params.professionalId)),
    queryFn: () =>
      manageToken
        ? unwrap(
            api.GET("/appointments/manage/{token}/availability/days", {
              params: { path: { token: manageToken }, query: { from: rest.from, to: rest.to } },
            }),
          )
        : unwrap(
            api.GET("/availability/days", {
              params: {
                query: { serviceId: rest.serviceId!, professionalId: rest.professionalId!, from: rest.from, to: rest.to },
              },
            }),
          ),
  });
}

export function useSlots(params: { serviceId?: string; professionalId?: string; date?: string; manageToken?: string }) {
  const { manageToken, ...rest } = params;
  return useQuery({
    queryKey: ["slots", params],
    enabled: Boolean(params.date && (manageToken || (params.serviceId && params.professionalId))),
    staleTime: 10_000,
    queryFn: () =>
      manageToken
        ? unwrap(
            api.GET("/appointments/manage/{token}/availability", {
              params: { path: { token: manageToken }, query: { date: rest.date! } },
            }),
          )
        : unwrap(
            api.GET("/availability", {
              params: { query: { serviceId: rest.serviceId!, professionalId: rest.professionalId!, date: rest.date! } },
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
