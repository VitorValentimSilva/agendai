import { Injectable } from '@nestjs/common';
import { env } from '../common/env.js';

export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];

export interface GoogleEventBody {
  summary: string;
  description: string;
  location: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  status: 'confirmed' | 'tentative';
  extendedProperties: { private: Record<string, string> };
}

/** Cliente REST mínimo do Google (OAuth 2.0 + Calendar API v3). */
@Injectable()
export class GoogleClient {
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>();

  get enabled(): boolean {
    return Boolean(env.googleClientId && env.googleClientSecret);
  }

  get redirectUri(): string {
    return `${env.publicApiUrl}/integrations/google/callback`;
  }

  authUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ refreshToken: string; email: string | null }> {
    const data = await this.tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: this.redirectUri });
    if (!data.refresh_token) throw new Error('O Google não devolveu refresh token. Remova o acesso do app na sua conta Google e conecte de novo.');
    return { refreshToken: data.refresh_token, email: emailFromIdToken(data.id_token) };
  }

  async accessToken(refreshToken: string): Promise<string> {
    const cached = this.tokenCache.get(refreshToken);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const data = await this.tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
    if (!data.access_token) throw new Error('Google: falha ao renovar o acesso.');
    this.tokenCache.set(refreshToken, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 });
    return data.access_token;
  }

  /** Cria ou atualiza o evento; devolve o id. Evento apagado no Google é recriado. */
  async upsertEvent(accessToken: string, calendarId: string, eventId: string | null, body: GoogleEventBody): Promise<string> {
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    if (eventId) {
      const res = await fetch(`${base}/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return eventId;
      if (res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar: HTTP ${res.status}`);
    }
    const res = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    if (!res.ok || !data.id) throw new Error(`Google Calendar: HTTP ${res.status}`);
    return data.id;
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar: HTTP ${res.status}`);
  }

  async revoke(refreshToken: string): Promise<void> {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  }

  private async tokenRequest(params: Record<string, string>) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.googleClientId, client_secret: env.googleClientSecret, ...params }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      id_token?: string;
      error_description?: string;
    };
    if (!res.ok) throw new Error(`Google OAuth: ${data.error_description ?? `HTTP ${res.status}`}`);
    return data;
  }
}

/** Lê o e-mail do id_token (já veio direto do Google por TLS; usado só para exibição). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split('.')[1];
  if (!payload) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}
