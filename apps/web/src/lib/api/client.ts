import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

/**
 * Client tipado da API. O navegador fala só com o Next: `/api/*` é reescrito
 * para `${API_URL}/*` (ver next.config.ts), então o cookie httpOnly fica no domínio do site.
 */
export const api = createClient<paths>({ baseUrl: "/api", credentials: "include" });

export type Schemas = components["schemas"];

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(" ");
    if (typeof m === "string") return m;
  }
  if (status === 429) return "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.";
  if (status >= 500) return "Nosso servidor teve um problema. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

/** Desembrulha a resposta do openapi-fetch: devolve `data` ou lança ApiError com mensagem amigável. */
export async function unwrap<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await promise;
  } catch {
    throw new ApiError("Sem conexão com o servidor. Verifique sua internet.", 0);
  }
  const { data, error, response } = result;
  if (!response.ok) throw new ApiError(messageFrom(error, response.status), response.status);
  return data as T;
}
