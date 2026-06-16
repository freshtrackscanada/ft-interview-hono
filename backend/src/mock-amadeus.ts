/**
 * In-process mock of AmadeusClient.
 *
 * Returns Amadeus-shaped offer payloads so the frontend and downstream code
 * can be developed without third-party credentials.
 *
 * Structure matches the /v3/shopping/hotel-offers response (subset of fields,
 * but consistent and realistic). Swap in a real provider by changing
 * AMADEUS_MODE=live in your .env.
 */

import { createHash } from "node:crypto";

import { MOCK_HOTELS_BY_CITY, type MockHotel } from "./mock-data.js";
import type { HotelByCity, HotelOffer, HotelSearchClient } from "./amadeus.js";

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  if (!Number.isFinite(ms)) return 1;
  return Math.max(1, Math.round(ms / 86_400_000));
}

function stableOffset(seed: string): number {
  // Deterministic ±15% jitter from a seed string.
  const digest = createHash("sha256").update(seed).digest();
  return (digest[0] / 255 - 0.5) * 0.3;
}

function fmt(amount: number): string {
  return amount.toFixed(2);
}

function findHotelByIdWithCity(
  hotelId: string,
): { cityCode: string; hotel: MockHotel } | null {
  for (const [cityCode, hotels] of Object.entries(MOCK_HOTELS_BY_CITY)) {
    const match = hotels.find((h) => h.hotelId === hotelId);
    if (match) return { cityCode, hotel: match };
  }
  return null;
}

export class MockAmadeusClient implements HotelSearchClient {
  async hotelsByCity(cityCode: string, limit = 20): Promise<HotelByCity[]> {
    const rows = MOCK_HOTELS_BY_CITY[cityCode.toUpperCase()] ?? [];
    return rows.slice(0, limit).map((h) => ({
      hotelId: h.hotelId,
      name: h.name,
      chainCode: h.chainCode,
      iataCode: cityCode.toUpperCase(),
      geoCode: { latitude: h.latitude, longitude: h.longitude },
    }));
  }

  async hotelOffers(args: {
    hotelIds: string[];
    checkInDate: string;
    checkOutDate: string;
    adults?: number;
  }): Promise<HotelOffer[]> {
    const { hotelIds, checkInDate, checkOutDate, adults = 1 } = args;
    const nights = nightsBetween(checkInDate, checkOutDate);

    const results: HotelOffer[] = [];
    for (const hotelId of hotelIds) {
      const found = findHotelByIdWithCity(hotelId);
      if (!found) continue;
      const { cityCode, hotel: h } = found;

      const seed = `${h.hotelId}:${checkInDate}:${adults}`;
      const base = h.basePrice;
      const jitter = base * stableOffset(seed);
      const adultFactor = 1 + 0.08 * (Math.max(1, adults) - 1);
      const nightly = (base + jitter) * adultFactor;
      const baseTotal = nightly * nights;
      const taxes = Math.round(baseTotal * 0.115 * 100) / 100;
      const total = Math.round((baseTotal + taxes) * 100) / 100;

      results.push({
        type: "hotel-offers",
        hotel: {
          hotelId: h.hotelId,
          chainCode: h.chainCode,
          name: h.name,
          cityCode,
          latitude: h.latitude,
          longitude: h.longitude,
        },
        available: true,
        offers: [
          {
            id: `mock-offer-${h.hotelId}`,
            checkInDate,
            checkOutDate,
            roomQuantity: 1,
            room: {
              type: h.category,
              typeEstimated: {
                category: h.category,
                beds: h.beds,
                bedType: h.bedType,
              },
              description: {
                text: `${h.category.replace(/_/g, " ").toLowerCase()} with ${h.beds} ${h.bedType.toLowerCase()} bed${h.beds > 1 ? "s" : ""}.`,
                lang: "EN",
              },
            },
            guests: { adults },
            price: {
              currency: h.currency,
              base: fmt(baseTotal),
              total: fmt(total),
              taxes: [
                {
                  code: "TOTAL_TAX",
                  amount: fmt(taxes),
                  currency: h.currency,
                  included: false,
                },
              ],
              variations: {
                average: { base: fmt(nightly) },
              },
            },
            policies: {
              cancellation: {
                type: "FULL_STAY",
                deadline: `${checkInDate}T18:00:00`,
              },
            },
          },
        ],
      });
    }
    return results;
  }
}
