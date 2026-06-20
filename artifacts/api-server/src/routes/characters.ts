import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, charactersTable, rollsTable } from "@workspace/db";
import {
  CreateCharacterBody,
  GetCharacterParams,
  GetCharacterResponse,
  UpdateCharacterParams,
  UpdateCharacterBody,
  UpdateCharacterResponse,
  DeleteCharacterParams,
  ListCharactersResponse,
  ListCharacterRollsParams,
  ListCharacterRollsResponse,
  CreateRollParams,
  CreateRollBody,
  ApplyDamageParams,
  ApplyDamageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/characters", async (_req, res): Promise<void> => {
  const characters = await db
    .select()
    .from(charactersTable)
    .orderBy(desc(charactersTable.createdAt));
  res.json(ListCharactersResponse.parse(characters));
});

router.post("/characters", async (req, res): Promise<void> => {
  const parsed = CreateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [character] = await db
    .insert(charactersTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(GetCharacterResponse.parse(character));
});

router.get("/characters/:id", async (req, res): Promise<void> => {
  const params = GetCharacterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [character] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.id, params.data.id));

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  res.json(GetCharacterResponse.parse(character));
});

router.patch("/characters/:id", async (req, res): Promise<void> => {
  const params = UpdateCharacterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCharacterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [character] = await db
    .update(charactersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(charactersTable.id, params.data.id))
    .returning();

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  res.json(UpdateCharacterResponse.parse(character));
});

router.delete("/characters/:id", async (req, res): Promise<void> => {
  const params = DeleteCharacterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [character] = await db
    .delete(charactersTable)
    .where(eq(charactersTable.id, params.data.id))
    .returning();

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/characters/:id/apply-damage", async (req, res): Promise<void> => {
  const params = ApplyDamageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ApplyDamageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [character] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.id, params.data.id));

  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  const { amount } = parsed.data;
  const maxDt = character.endurance * 2 + character.dtBonus;
  const dt = character.currentDt;

  let newDt = dt;
  let hpLost = 0;
  let dtDropped = false;
  let absorbed = false;

  if (amount >= dt) {
    // DT drops by 1, overflow damages HP
    newDt = Math.max(0, dt - 1);
    dtDropped = true;
    const overflow = amount - dt;
    hpLost = overflow;
  } else {
    // Damage fully absorbed, DT holds
    absorbed = true;
  }

  const newHp = Math.max(0, character.currentHp - hpLost);

  await db
    .update(charactersTable)
    .set({ currentDt: newDt, currentHp: newHp, updatedAt: new Date() })
    .where(eq(charactersTable.id, params.data.id));

  res.json({ dtDropped, hpLost, newDt, newHp, absorbed, maxDt });
});

router.get("/characters/:id/rolls", async (req, res): Promise<void> => {
  const params = ListCharacterRollsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rolls = await db
    .select()
    .from(rollsTable)
    .where(eq(rollsTable.characterId, params.data.id))
    .orderBy(desc(rollsTable.rolledAt))
    .limit(50);

  res.json(ListCharacterRollsResponse.parse(rolls));
});

router.post("/characters/:id/rolls", async (req, res): Promise<void> => {
  const params = CreateRollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateRollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const modifier = parsed.data.modifier ?? 0;
  const statValue = (parsed.data as any).statValue as number | undefined;

  // Standard DnD die tiers
  function dieForValue(v: number): number {
    if (v <= 4) return 4;
    if (v <= 6) return 6;
    if (v <= 8) return 8;
    if (v <= 10) return 10;
    if (v <= 12) return 12;
    return 20;
  }

  // Recursively build dice list: stat > 20 adds a d20 (cap 20) + dice for remainder
  function getStatDice(s: number): Array<{ sides: number; cap: number }> {
    if (s <= 20) return [{ sides: dieForValue(s), cap: s }];
    return [{ sides: 20, cap: 20 }, ...getStatDice(s - 20)];
  }

  function rollOneDie(sides: number, cap: number): { rolled: number; result: number; wasCrit: boolean; bonus: number } {
    const rolled = Math.floor(Math.random() * sides) + 1;
    if (rolled > cap) {
      const bonus = Math.floor(Math.random() * sides) + 1;
      return { rolled, result: cap, wasCrit: true, bonus };
    }
    return { rolled, result: rolled, wasCrit: false, bonus: 0 };
  }

  let result: number;
  let total: number;
  let isCrit = false;
  let critBonus: number | null = null;
  let diceTypeStr = parsed.data.diceType;

  if (statValue !== undefined) {
    const dice = getStatDice(statValue);
    diceTypeStr = dice.map(d => `d${d.sides}`).join("+");
    let rollTotal = 0;
    let anyCrit = false;
    let totalCritBonus = 0;
    for (const die of dice) {
      const r = rollOneDie(die.sides, die.cap);
      rollTotal += r.result + r.bonus;
      if (r.wasCrit) { anyCrit = true; totalCritBonus += r.bonus; }
    }
    result = rollTotal;
    isCrit = anyCrit;
    critBonus = anyCrit ? totalCritBonus : null;
    total = rollTotal + modifier;
  } else {
    const sides = parseInt(diceTypeStr.replace("d", ""), 10) || 20;
    const rolled = Math.floor(Math.random() * sides) + 1;
    result = rolled;
    total = rolled + modifier;
  }

  const [roll] = await db
    .insert(rollsTable)
    .values({
      characterId: params.data.id,
      diceType: diceTypeStr,
      result,
      modifier: parsed.data.modifier ?? null,
      total,
      label: parsed.data.label ?? null,
      isCrit,
      critBonus,
    })
    .returning();

  res.status(201).json(roll);
});

export default router;
