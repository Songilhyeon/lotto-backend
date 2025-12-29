import { Router } from "express";
import {
  getPremiumAnalysis,
  rebuildPremiumCache,
} from "../controllers/premiumController";
import { getAiRecommendationController } from "../controllers/aiRecommendController";
import { getAiRecommendNextFreqController } from "../controllers/aiRecommendNextFreqController";
import { getAiRecommenderAdvancedController } from "../controllers/aiRecommenderAdvancedController";
import { getAiRecommenderVariantController } from "../controllers/aiRecommenderVariantController";
import { analyzeIntervalController } from "../controllers/analyzeIntervalController";
import { analyzeRoundPatternController } from "../controllers/analyzeRoundPatternController";

const router = Router();

router.get("/analysis", getPremiumAnalysis);
router.post("/rebuild-cache", rebuildPremiumCache);
router.get("/recommend", getAiRecommendationController);
router.get("/recommend-next", getAiRecommendNextFreqController);
router.post("/recommend-advanced", getAiRecommenderAdvancedController);
router.post("/recommend-variant", getAiRecommenderVariantController);
router.get("/analysis/interval", analyzeIntervalController);
router.get("/analysis/round-dist", analyzeRoundPatternController);

export default router;
