import {
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
  date,
} from "drizzle-orm/pg-core";

/** Audit log of hotel searches issued against Amadeus. */
export const hotelSearches = pgTable("hotel_searches", {
  id: serial("id").primaryKey(),
  cityCode: varchar("city_code", { length: 8 }).notNull(),
  checkInDate: date("check_in_date").notNull(),
  checkOutDate: date("check_out_date").notNull(),
  adults: integer("adults").notNull().default(1),
  resultCount: integer("result_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type HotelSearch = typeof hotelSearches.$inferSelect;
export type NewHotelSearch = typeof hotelSearches.$inferInsert;
