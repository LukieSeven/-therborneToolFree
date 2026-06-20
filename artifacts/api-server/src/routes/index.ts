import { Router, type IRouter } from "express";
import healthRouter from "./health";
import charactersRouter from "./characters";
import rollsRouter from "./rolls";
import notesRouter from "./notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(charactersRouter);
router.use(rollsRouter);
router.use(notesRouter);

export default router;
