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

  const diceSides: Record<string, number> = {
    d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100,
  };

  const sides = diceSides[parsed.data.diceType];
  const result = Math.floor(Math.random() * sides) + 1;
  const modifier = parsed.data.modifier ?? 0;
  const total = result + modifier;

  const [roll] = await db
    .insert(rollsTable)
    .values({
      characterId: params.data.id,
      diceType: parsed.data.diceType,
      result,
      modifier: parsed.data.modifier ?? null,
      total,
      label: parsed.data.label ?? null,
    })
    .returning();

  res.status(201).json(roll);
});

export default router;
