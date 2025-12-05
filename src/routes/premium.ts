import { Router } from "express";
import {
  getPremiumAnalysis,
  rebuildPremiumCache,
} from "../controllers/premiumController";

const router = Router();

router.get("/analysis", getPremiumAnalysis);
router.post("/rebuild-cache", rebuildPremiumCache);

export default router;
