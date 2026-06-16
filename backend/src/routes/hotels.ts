import { desc } from "drizzle-orm";
import { Hono } from "hono";

import { AmadeusClient, AmadeusError } from "../amadeus.js";
import { db } from "../db/index.js";
import { hotelSearches } from "../db/schema.js";

const hotels = new Hono();
const amadeus = new AmadeusClient();

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  // Accept anything Date.parse handles, then re-emit as YYYY-MM-DD.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

hotels.get("/search", async (c) => {
  const cityCode = (c.req.query("cityCode") ?? "").trim().toUpperCase();
  const checkInDate = parseDate(c.req.query("checkInDate") ?? undefined);
  const checkOutDate = parseDate(c.req.query("checkOutDate") ?? undefined);
  const adults = Math.max(1, Number(c.req.query("adults") ?? "1") || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number(c.req.query("limit") ?? "20") || 20),
  );

  const errors: Record<string, string> = {};
  if (!cityCode) errors.cityCode = "Required IATA city code (e.g. 'PAR').";
  if (!checkInDate) errors.checkInDate = "Required date in YYYY-MM-DD.";
  if (!checkOutDate) errors.checkOutDate = "Required date in YYYY-MM-DD.";
  if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
    errors.checkOutDate = "checkOutDate must be after checkInDate.";
  }
  if (Object.keys(errors).length > 0) {
    return c.json({ errors }, 400);
  }

  try {
    const hotelList = await amadeus.hotelsByCity(cityCode, limit);
    const hotelIds = hotelList
      .map((h) => h.hotelId)
      .filter((id): id is string => Boolean(id));
    const offers = await amadeus.hotelOffers({
      hotelIds,
      checkInDate: checkInDate!,
      checkOutDate: checkOutDate!,
      adults,
    });

    await db.insert(hotelSearches).values({
      cityCode,
      checkInDate: checkInDate!,
      checkOutDate: checkOutDate!,
      adults,
      resultCount: offers.length,
    });

    return c.json({
      query: { cityCode, checkInDate, checkOutDate, adults },
      count: offers.length,
      results: offers,
    });
  } catch (err) {
    if (err instanceof AmadeusError) {
      return c.json({ error: "amadeus_error", detail: err.message }, 502);
    }
    throw err;
  }
});

hotels.get("/history", async (c) => {
  const rows = await db
    .select()
    .from(hotelSearches)
    .orderBy(desc(hotelSearches.createdAt))
    .limit(20);
  return c.json(rows);
});

export default hotels;
