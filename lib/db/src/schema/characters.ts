import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const charactersTable = pgTable("characters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  className: text("class_name").notNull(),
  race: text("race").notNull(),
  level: integer("level").notNull().default(1),
  maxHp: integer("max_hp").notNull(),
  currentHp: integer("current_hp").notNull(),
  dtBonus: integer("dt_bonus").notNull().default(0),
  currentDt: integer("current_dt").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  power: integer("power").notNull().default(10),
  vitality: integer("vitality").notNull().default(10),
  spirit: integer("spirit").notNull().default(10),
  agility: integer("agility").notNull().default(10),
  endurance: integer("endurance").notNull().default(10),
  precision: integer("precision").notNull().default(10),
  willpower: integer("willpower").notNull().default(10),
  charisma: integer("charisma").notNull().default(10),
  currentMana: integer("current_mana").notNull().default(0),
  background: text("background"),
  backstory: text("backstory"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;
