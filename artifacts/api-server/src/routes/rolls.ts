import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, rollsTable, charactersTable } from "@workspace/db";
import { ListRecentRollsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/rolls/recent", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: rollsTable.id,
      characterId: rollsTable.characterId,
      characterName: charactersTable.name,
      diceType: rollsTable.diceType,
      result: rollsTable.result,
      modifier: rollsTable.modifier,
      total: rollsTable.total,
      label: rollsTable.label,
      rolledAt: rollsTable.rolledAt,
    })
    .from(rollsTable)
    .innerJoin(charactersTable, eq(rollsTable.characterId, charactersTable.id))
    .orderBy(desc(rollsTable.rolledAt))
    .limit(20);

  res.json(ListRecentRollsResponse.parse(rows));
});

export default router;
