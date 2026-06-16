/**
 * Thin Amadeus self-service API client.
 *
 * Implements only what the hotel-search demo needs:
 *   1. OAuth2 token (client_credentials)
 *   2. List hotel IDs by city
 *   3. Fetch hotel offers for those IDs
 *
 * Docs: https://developers.amadeus.com/self-service/category/hotels
 *
 * NOTE: Amadeus is shutting down its self-service portal in July 2026. The
 * default mode for this boilerplate is `mock` — see ./mock-amadeus.ts. Set
 * AMADEUS_MODE=live in .env if you have credentials for a working provider
 * with an Amadeus-compatible response shape.
 */

import { MockAmadeusClient } from "./mock-amadeus.js";

export interface HotelSearchClient {
  hotelsByCity(cityCode: string, limit?: number): Promise<HotelByCity[]>;
  hotelOffers(args: {
    hotelIds: string[];
    checkInDate: string;
    checkOutDate: string;
    adults?: number;
  }): Promise<HotelOffer[]>;
}

export class AmadeusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmadeusError";
  }
}

type CachedToken = { value: string; expiresAt: number };

export type HotelByCity = {
  hotelId: string;
  name?: string;
  iataCode?: string;
  [k: string]: unknown;
};

export type HotelOffer = {
  hotel?: { hotelId?: string; name?: string; cityCode?: string };
  offers?: Array<{
    price?: { total?: string; currency?: string };
    room?: { typeEstimated?: { category?: string; beds?: number } };
  }>;
  [k: string]: unknown;
};

export class AmadeusClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private token: CachedToken | null = null;

  constructor(opts?: {
    clientId?: string;
    clientSecret?: string;
    baseUrl?: string;
  }) {
    this.clientId = opts?.clientId ?? process.env.AMADEUS_CLIENT_ID ?? "";
    this.clientSecret =
      opts?.clientSecret ?? process.env.AMADEUS_CLIENT_SECRET ?? "";
    this.baseUrl = (
      opts?.baseUrl ??
      process.env.AMADEUS_BASE_URL ??
      "https://test.api.amadeus.com"
    ).replace(/\/$/, "");
  }

  private isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private async getToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new AmadeusError(
        "Amadeus credentials are not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET in your .env file.",
      );
    }

    const now = Date.now();
    if (this.token && this.token.expiresAt - 60_000 > now) {
      return this.token.value;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new AmadeusError(`Token request failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as {
      access_token: string;
      expires_in?: number;
    };
    this.token = {
      value: json.access_token,
      expiresAt: now + (json.expires_in ?? 1800) * 1000,
    };
    return this.token.value;
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<T> {
    const token = await this.getToken();
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new AmadeusError(`GET ${path} failed: ${res.status} ${text}`);
    }
    return (await res.json()) as T;
  }

  async hotelsByCity(cityCode: string, limit = 20): Promise<HotelByCity[]> {
    const data = await this.get<{ data?: HotelByCity[] }>(
      "/v1/reference-data/locations/hotels/by-city",
      { cityCode: cityCode.toUpperCase() },
    );
    return (data.data ?? []).slice(0, limit);
  }

  async hotelOffers(args: {
    hotelIds: string[];
    checkInDate: string;
    checkOutDate: string;
    adults?: number;
  }): Promise<HotelOffer[]> {
    const { hotelIds, checkInDate, checkOutDate, adults = 1 } = args;
    if (hotelIds.length === 0) return [];

    const results: HotelOffer[] = [];
    for (let i = 0; i < hotelIds.length; i += 20) {
      const batch = hotelIds.slice(i, i + 20);
      try {
        const data = await this.get<{ data?: HotelOffer[] }>(
          "/v3/shopping/hotel-offers",
          {
            hotelIds: batch.join(","),
            checkInDate,
            checkOutDate,
            adults,
            bestRateOnly: "true",
          },
        );
        results.push(...(data.data ?? []));
      } catch {
        // Skip unavailable batches rather than failing the whole search.
      }
    }
    return results;
  }
}

/**
 * Return the configured hotel-search client.
 *   AMADEUS_MODE=mock (default) → fixtures in ./mock-amadeus.ts
 *   AMADEUS_MODE=live           → real Amadeus client (requires credentials)
 */
export function getClient(): HotelSearchClient {
  const mode = (process.env.AMADEUS_MODE ?? "mock").toLowerCase();
  if (mode === "live") return new AmadeusClient();
  return new MockAmadeusClient();
}
