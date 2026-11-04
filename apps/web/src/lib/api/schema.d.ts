/**
 * ARQUIVO GERADO — não edite manualmente.
 * Fonte: apps/api/openapi.json
 * Comando: npm run gen:api
 */

export type paths = {
    "/admin/appointments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Agenda entre duas datas (inclusive), no fuso do negócio */
        get: operations["Agenda_agenda"];
        put?: never;
        /** Agendamento manual (balcão/telefone). Ignora antecedência mínima. */
        post: operations["Agenda_manual"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/appointments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Agenda_one"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/appointments/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Mudar status (confirmar, concluir, faltou, cancelar) */
        patch: operations["Agenda_status"];
        trace?: never;
    };
    "/admin/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Horários livres para agendamento manual (sem antecedência mínima) */
        get: operations["Agenda_slots"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/business": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Settings_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Settings_update"];
        trace?: never;
    };
    "/admin/customers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Customers_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/customers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Customers_detail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["Customers_update"];
        trace?: never;
    };
    "/admin/dashboard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Métricas do painel (no papel PROFESSIONAL, só a própria agenda) */
        get: operations["Agenda_getDashboard"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/professionals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Catalog_listProfessionals"];
        put?: never;
        post: operations["Catalog_createProfessional"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/professionals/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove o profissional (ou só desativa, se já houver agendamentos) */
        delete: operations["Catalog_deleteProfessional"];
        options?: never;
        head?: never;
        patch: operations["Catalog_updateProfessional"];
        trace?: never;
    };
    "/admin/professionals/{id}/working-hours": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Substitui o expediente semanal (vários intervalos por dia) */
        put: operations["Catalog_setWorkingHours"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/services": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Catalog_listServices"];
        put?: never;
        post: operations["Catalog_createService"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/services/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove o serviço (ou só desativa, se já houver agendamentos) */
        delete: operations["Catalog_deleteService"];
        options?: never;
        head?: never;
        patch: operations["Catalog_updateService"];
        trace?: never;
    };
    "/admin/time-offs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Catalog_listTimeOffs"];
        put?: never;
        /** Cria bloqueio (sem profissional = negócio inteiro, só OWNER) */
        post: operations["Catalog_createTimeOff"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/admin/time-offs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["Catalog_deleteTimeOff"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/appointments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Criar agendamento (cliente) */
        post: operations["Public_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/appointments/manage/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ver agendamento pelo token */
        get: operations["Public_byToken"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/appointments/manage/{token}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancelar pelo token (respeita a política de cancelamento) */
        post: operations["Public_cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/appointments/manage/{token}/ics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Baixar o agendamento em .ics */
        get: operations["Public_ics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/appointments/manage/{token}/reschedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Remarcar pelo token (mesmo serviço e profissional) */
        post: operations["Public_reschedule"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Auth_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["Auth_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["Auth_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/signup": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cadastro self-service: cria o negócio, o dono e serviços iniciais */
        post: operations["Auth_signup"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/slug-available": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Verifica se o endereço (slug) está livre */
        get: operations["Auth_slugAvailable"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Horários livres em uma data (fuso do negócio) */
        get: operations["Public_slots"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/availability/days": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Dias com pelo menos um horário livre (para o calendário) */
        get: operations["Public_days"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/business": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Dados públicos do negócio */
        get: operations["Public_business"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/reset-demo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Mesmo que o POST — usado pelo Cron da Vercel */
        get: operations["Internal_resetGet"];
        put?: never;
        /** Apaga e recria os dados de demonstração (Authorization: Bearer CRON_SECRET) */
        post: operations["Internal_resetPost"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/professionals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Equipe (profissionais ativos) */
        get: operations["Public_team"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/services": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Serviços ativos */
        get: operations["Public_services"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/services/{serviceId}/professionals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Profissionais que fazem o serviço */
        get: operations["Public_professionals"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        AdminAppointmentDto: {
            code: string;
            createdAt: string;
            customer: components["schemas"]["AppointmentCustomerRefDto"];
            endsAt: string;
            id: string;
            manageToken: string;
            notes: string | null;
            priceCents: number;
            professional: components["schemas"]["AppointmentProfessionalRefDto"];
            service: components["schemas"]["AppointmentServiceRefDto"];
            /** @enum {string} */
            source: "ONLINE" | "MANUAL";
            startsAt: string;
            status: components["schemas"]["AppointmentStatus"];
        };
        AdminProfessionalDto: {
            active: boolean;
            avatarUrl: string | null;
            bio: string | null;
            id: string;
            name: string;
            serviceIds: string[];
            userEmail: string | null;
            workingHours: components["schemas"]["WorkingHoursItemDto"][];
        };
        AdminServiceDto: {
            active: boolean;
            description: string | null;
            durationMinutes: number;
            id: string;
            name: string;
            priceCents: number;
            professionalIds: string[];
        };
        AgendaDto: {
            appointments: components["schemas"]["AdminAppointmentDto"][];
            timeOffs: components["schemas"]["TimeOffDto"][];
            timezone: string;
        };
        AppointmentCustomerRefDto: {
            email: string | null;
            id: string;
            name: string;
            whatsapp: string;
        };
        AppointmentProfessionalRefDto: {
            avatarUrl: string | null;
            id: string;
            name: string;
        };
        AppointmentServiceRefDto: {
            durationMinutes: number;
            id: string;
            name: string;
        };
        /** @enum {string} */
        AppointmentStatus: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW" | "PENDING_PAYMENT";
        AvailabilityDto: {
            date: string;
            slots: components["schemas"]["SlotDto"][];
            timezone: string;
        };
        AvailableDaysDto: {
            /**
             * @example [
             *       "2026-11-04",
             *       "2026-11-05"
             *     ]
             */
            days: string[];
        };
        BusinessSettingsDto: {
            addressLine: string;
            cancellationPolicyHours: number;
            city: string;
            description: string | null;
            email: string | null;
            id: string;
            instagram: string | null;
            maxAdvanceDays: number;
            minAdvanceMinutes: number;
            name: string;
            phone: string;
            slotIntervalMinutes: number;
            slug: string;
            state: string;
            timezone: string;
            whatsapp: string;
        };
        CreateAppointmentDto: {
            customer: components["schemas"]["CustomerInputDto"];
            /** @example Prefiro máquina 2 nas laterais. */
            notes?: string;
            /**
             * @description ID do profissional ou "any" para qualquer um.
             * @example any
             */
            professionalId: string;
            serviceId: string;
            /**
             * @description Início em ISO 8601 (UTC).
             * @example 2026-11-04T12:00:00.000Z
             */
            startsAt: string;
        };
        CreatedAppointmentDto: {
            business: components["schemas"]["PublicBusinessRefDto"];
            code: string;
            customerName: string;
            endsAt: string;
            manage: components["schemas"]["ManageInfoDto"];
            /** @description Token secreto para o cliente gerenciar o agendamento. */
            manageToken: string;
            notes: string | null;
            priceCents: number;
            professional: components["schemas"]["AppointmentProfessionalRefDto"];
            service: components["schemas"]["AppointmentServiceRefDto"];
            startsAt: string;
            status: components["schemas"]["AppointmentStatus"];
        };
        CustomerDetailDto: {
            appointmentsCount: number;
            createdAt: string;
            email: string | null;
            history: components["schemas"]["AdminAppointmentDto"][];
            id: string;
            lastVisitAt: string | null;
            name: string;
            nextAppointmentAt: string | null;
            notes: string | null;
            totalSpentCents: number;
            whatsapp: string;
        };
        CustomerInputDto: {
            /** @example joao@email.com */
            email?: string;
            /** @example João da Silva */
            name: string;
            /**
             * @description WhatsApp com DDD; aceita máscara.
             * @example (19) 99999-0000
             */
            whatsapp: string;
        };
        CustomerListItemDto: {
            appointmentsCount: number;
            email: string | null;
            id: string;
            lastVisitAt: string | null;
            name: string;
            nextAppointmentAt: string | null;
            totalSpentCents: number;
            whatsapp: string;
        };
        CustomerPageDto: {
            items: components["schemas"]["CustomerListItemDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        DashboardDto: {
            appointmentsToday: number;
            appointmentsWeek: number;
            /** @description 0..1, últimos 30 dias */
            cancellationRate: number;
            expectedRevenueMonthCents: number;
            /** @description 0..1, últimos 30 dias */
            noShowRate: number;
            realizedRevenueMonthCents: number;
            series: components["schemas"]["DashboardSeriesPointDto"][];
            timezone: string;
            today: string;
            topServices: components["schemas"]["TopServiceDto"][];
            upcoming: components["schemas"]["AdminAppointmentDto"][];
        };
        DashboardSeriesPointDto: {
            appointments: number;
            date: string;
            /** @description Faturamento realizado (concluídos) em centavos */
            revenueCents: number;
        };
        LoginDto: {
            /** @example demo@agendai.app */
            email: string;
            /** @example demo1234 */
            password: string;
        };
        ManageInfoDto: {
            canChange: boolean;
            deadline: string;
            reason: string | null;
        };
        ManualAppointmentDto: {
            customer: components["schemas"]["CustomerInputDto"];
            notes?: string;
            /** @description ID do profissional ou "any" */
            professionalId: string;
            serviceId: string;
            startsAt: string;
        };
        MeDto: {
            businessId: string;
            businessName: string;
            businessSlug: string;
            businessTimezone: string;
            email: string;
            id: string;
            name: string;
            professionalId: string | null;
            /** @enum {string} */
            role: "OWNER" | "PROFESSIONAL";
        };
        OpeningHoursDto: {
            intervals: components["schemas"]["OpeningIntervalDto"][];
            /** @description 0 = domingo */
            weekday: number;
        };
        OpeningIntervalDto: {
            end: number;
            /** @description Minutos desde 00:00 */
            start: number;
        };
        ProfessionalInputDto: {
            active?: boolean;
            avatarUrl?: string | null;
            bio?: string | null;
            name: string;
            serviceIds?: string[];
        };
        PublicAppointmentDto: {
            business: components["schemas"]["PublicBusinessRefDto"];
            code: string;
            customerName: string;
            endsAt: string;
            manage: components["schemas"]["ManageInfoDto"];
            notes: string | null;
            priceCents: number;
            professional: components["schemas"]["AppointmentProfessionalRefDto"];
            service: components["schemas"]["AppointmentServiceRefDto"];
            startsAt: string;
            status: components["schemas"]["AppointmentStatus"];
        };
        PublicBusinessDto: {
            addressLine: string;
            cancellationPolicyHours: number;
            city: string;
            description: string | null;
            email: string | null;
            instagram: string | null;
            maxAdvanceDays: number;
            minAdvanceMinutes: number;
            name: string;
            openingHours: components["schemas"]["OpeningHoursDto"][];
            phone: string;
            /** @example barbearia */
            segment: string;
            slotIntervalMinutes: number;
            slug: string;
            state: string;
            timezone: string;
            whatsapp: string;
        };
        PublicBusinessRefDto: {
            address: string;
            cancellationPolicyHours: number;
            name: string;
            timezone: string;
            whatsapp: string;
        };
        PublicProfessionalDto: {
            avatarUrl: string | null;
            bio: string | null;
            id: string;
            name: string;
        };
        PublicServiceDto: {
            description: string | null;
            durationMinutes: number;
            id: string;
            name: string;
            priceCents: number;
        };
        RescheduleDto: {
            /** @example 2026-11-05T13:00:00.000Z */
            startsAt: string;
        };
        ResetDemoResultDto: {
            appointments: number;
            customers: number;
            ok: boolean;
        };
        ServiceInputDto: {
            active?: boolean;
            description?: string | null;
            durationMinutes: number;
            name: string;
            /** @description Preço em centavos */
            priceCents: number;
            professionalIds?: string[];
        };
        SignupDto: {
            /** @example Rua das Flores, 100 — Centro */
            addressLine: string;
            /** @example Barbearia do Zé */
            businessName: string;
            /** @example Campinas */
            city: string;
            /** @example ze@barbearia.com */
            email: string;
            /** @example José da Silva */
            ownerName: string;
            /** @example senha-forte-123 */
            password: string;
            /** @enum {string} */
            segment: "barbearia" | "salao" | "clinica" | "estudio";
            /**
             * @description Endereço do seu link: letras minúsculas, números e hífen.
             * @example barbearia-do-ze
             */
            slug: string;
            /** @example SP */
            state: string;
            /** @example (19) 99999-0000 */
            whatsapp: string;
        };
        SlotDto: {
            end: string;
            professionalIds: string[];
            /** @description Início em ISO (UTC) */
            start: string;
            /**
             * @description Horário no fuso do negócio
             * @example 09:30
             */
            time: string;
        };
        SlugAvailabilityDto: {
            available: boolean;
            reason: string | null;
            slug: string;
        };
        TimeOffDto: {
            endsAt: string;
            id: string;
            professionalId: string | null;
            reason: string | null;
            startsAt: string;
        };
        TimeOffInputDto: {
            endsAt: string;
            /** @description Vazio = negócio inteiro */
            professionalId?: string | null;
            reason?: string | null;
            startsAt: string;
        };
        TopServiceDto: {
            count: number;
            name: string;
            revenueCents: number;
            serviceId: string;
        };
        UpdateBusinessDto: {
            addressLine?: string;
            cancellationPolicyHours?: number;
            city?: string;
            description?: string | null;
            email?: string | null;
            instagram?: string | null;
            maxAdvanceDays?: number;
            minAdvanceMinutes?: number;
            name?: string;
            phone?: string;
            slotIntervalMinutes?: number;
            state?: string;
            timezone?: string;
            whatsapp?: string;
        };
        UpdateCustomerDto: {
            email?: string | null;
            name?: string;
            notes?: string | null;
        };
        UpdateProfessionalDto: {
            active?: boolean;
            avatarUrl?: string | null;
            bio?: string | null;
            name?: string;
            serviceIds?: string[];
        };
        UpdateServiceDto: {
            active?: boolean;
            description?: string | null;
            durationMinutes?: number;
            name?: string;
            /** @description Preço em centavos */
            priceCents?: number;
            professionalIds?: string[];
        };
        UpdateStatusDto: {
            status: components["schemas"]["AppointmentStatus"];
        };
        WorkingHoursInputDto: {
            items: components["schemas"]["WorkingHoursItemDto"][];
        };
        WorkingHoursItemDto: {
            endMinute: number;
            /** @description Minutos desde 00:00 */
            startMinute: number;
            /** @description 0 = domingo */
            weekday: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export interface operations {
    Agenda_agenda: {
        parameters: {
            query: {
                from: string;
                professionalId?: string;
                to: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AgendaDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Agenda_manual: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManualAppointmentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminAppointmentDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Agenda_one: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminAppointmentDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Agenda_status: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateStatusDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminAppointmentDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Agenda_slots: {
        parameters: {
            query: {
                date: string;
                /** @description ID do profissional ou "any". */
                professionalId: string;
                serviceId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AvailabilityDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Settings_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessSettingsDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Settings_update: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateBusinessDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BusinessSettingsDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Customers_list: {
        parameters: {
            query?: {
                page?: number;
                pageSize?: number;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerPageDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Customers_detail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Customers_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCustomerDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerDetailDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Agenda_getDashboard: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DashboardDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_listProfessionals: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProfessionalDto"][];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_createProfessional: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProfessionalInputDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProfessionalDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_deleteProfessional: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_updateProfessional: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProfessionalDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProfessionalDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_setWorkingHours: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WorkingHoursInputDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminProfessionalDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_listServices: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminServiceDto"][];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_createService: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ServiceInputDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminServiceDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_deleteService: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_updateService: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateServiceDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AdminServiceDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_listTimeOffs: {
        parameters: {
            query?: {
                from?: string;
                professionalId?: string;
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TimeOffDto"][];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_createTimeOff: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TimeOffInputDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TimeOffDto"];
                };
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Catalog_deleteTimeOff: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem sessão */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sem permissão para o papel atual */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Public_create: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAppointmentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedAppointmentDto"];
                };
            };
            /** @description Horário indisponível ou reservado por outra pessoa */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Public_byToken: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicAppointmentDto"];
                };
            };
        };
    };
    Public_cancel: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicAppointmentDto"];
                };
            };
        };
    };
    Public_ics: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Public_reschedule: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RescheduleDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicAppointmentDto"];
                };
            };
        };
    };
    Auth_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MeDto"];
                };
            };
        };
    };
    Auth_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    Auth_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MeDto"];
                };
            };
        };
    };
    Auth_signup: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SignupDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MeDto"];
                };
            };
        };
    };
    Auth_slugAvailable: {
        parameters: {
            query: {
                slug: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SlugAvailabilityDto"];
                };
            };
        };
    };
    Public_slots: {
        parameters: {
            query: {
                date: string;
                /** @description ID do profissional ou "any". */
                professionalId: string;
                serviceId: string;
            };
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AvailabilityDto"];
                };
            };
        };
    };
    Public_days: {
        parameters: {
            query: {
                from: string;
                professionalId: string;
                serviceId: string;
                to: string;
            };
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AvailableDaysDto"];
                };
            };
        };
    };
    Public_business: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicBusinessDto"];
                };
            };
        };
    };
    Internal_resetGet: {
        parameters: {
            query?: never;
            header: {
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResetDemoResultDto"];
                };
            };
        };
    };
    Internal_resetPost: {
        parameters: {
            query?: never;
            header: {
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ResetDemoResultDto"];
                };
            };
        };
    };
    Public_team: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicProfessionalDto"][];
                };
            };
        };
    };
    Public_services: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicServiceDto"][];
                };
            };
        };
    };
    Public_professionals: {
        parameters: {
            query?: never;
            header?: {
                /** @description Slug do negócio (multiempresa). Sem ele, usa o negócio padrão. */
                "x-business-slug"?: string;
            };
            path: {
                serviceId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicProfessionalDto"][];
                };
            };
        };
    };
}
