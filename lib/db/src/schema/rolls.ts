import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { charactersTable } from "./characters";

export const rollsTable = pgTable("rolls", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().references(() => charactersTable.id, { onDelete: "cascade" }),
  diceType: text("dice_type").notNull(),
  result: integer("result").notNull(),
  modifier: integer("modifier"),
  total: integer("total").notNull(),
  label: text("label"),
  rolledAt: timestamp("rolled_at").notNull().defaultNow(),
});

export const insertRollSchema = createInsertSchema(rollsTable).omit({ id: true, rolledAt: true });
export type InsertRoll = z.infer<typeof insertRollSchema>;
export type Roll = typeof rollsTable.$inferSelect;
