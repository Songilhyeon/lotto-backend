import { Router } from "express";
import {
  getPremiumAnalysis,
  rebuildPremiumCache,
} from "../controllers/premiumController";
import { getAiRecommendationController } from "../controllers/aiRecommendController";
import { getAiRecommendNextFreqController } from "../controllers/aiRecommendNextFreqController";
import { getAiRecommenderAdvancedController } from "../controllers/aiRecommenderAdvancedController";

const router = Router();

router.get("/analysis", getPremiumAnalysis);
router.post("/rebuild-cache", rebuildPremiumCache);
router.get("/recommend", getAiRecommendationController);
router.get("/recommend-next", getAiRecommendNextFreqController);
router.post("/recommend-advanced", getAiRecommenderAdvancedController);

export default router;
